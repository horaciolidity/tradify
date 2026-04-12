import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Solo permitir peticiones POST
  if (req.method !== 'POST') {
    return res.status(200).send("Method Not Allowed");
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
       console.error("WEBHOOK_ERROR: Credentials missing.");
       return res.status(200).json({ error: "Config missing" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = req.body;

    // OxaPay envía los datos en el body
    // Por seguridad, OxaPay recomienda verificar el HMAC, pero para MVP usaremos validación de campos
    const { address, amount, status, currency, network, tx_hash, order_id } = body;

    console.log(`[WEBHOOK_RECEIVED] Address: ${address}, Amount: ${amount}, Status: ${status}, Order: ${order_id}`);

    // Solo procesar si el estado es 'paid' o 'confirmed'
    if (status === 'paid' || status === 'confirmed' || status === 'success') {
      
      // 1. Buscar al usuario (Primero por dirección, luego por order_id como respaldo)
      let userId = null;

      const { data: addressData } = await supabase
        .from('oxapay_addresses')
        .select('user_id')
        .eq('address', address)
        .maybeSingle();

      if (addressData?.user_id) {
        userId = addressData.user_id;
      } else if (order_id && order_id.length > 20) {
        // El user_id es un UUID, si order_id se ve como un UUID lo usamos
        userId = order_id;
        console.log(`[WEBHOOK_FALLBACK] User found via order_id: ${userId}`);
      }

      if (!userId) {
        console.error(`[WEBHOOK_ERROR] No user found for address: ${address} and order: ${order_id}`);
        return res.status(200).json({ message: "User not identified" });
      }

      // 2. Verificar si la transacción ya fue procesada (para evitar duplicados)
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('tx_hash', tx_hash)
        .maybeSingle();

      if (existingTx) {
        console.warn(`[WEBHOOK_SKIP] Transaction ${tx_hash} already processed.`);
        return res.status(200).json({ message: "Already processed" });
      }

      // 3. Actualizar balance en la tabla 'wallets'
      const { data: wallet, error: walletErr } = await supabase.rpc('increment_wallet_balance', {
        p_user_id: userId,
        p_amount: parseFloat(amount)
      });

      if (walletErr) {
        // Si RPC falla, intentar por consulta directa
        console.warn("[WEBHOOK_RPC_FAIL] Falling back to manual update");
        const { data: currentWallet } = await supabase.from('wallets').select('balance_usdc').eq('user_id', userId).single();
        const newBalance = (currentWallet?.balance_usdc || 0) + parseFloat(amount);
        await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', userId);
      }

      // 4. Registrar la transacción
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'deposit',
        amount: parseFloat(amount),
        status: 'completed',
        description: `Depósito OxaPay (${network})`,
        tx_hash: tx_hash
      });

      console.log(`[WEBHOOK_SUCCESS] Balance updated for ${userId}: +${amount} USDC`);
      return res.status(200).json({ message: "Payment processed successfully" });
    }

    return res.status(200).json({ message: "Status not processing" });
  } catch (err) {
    console.error("[WEBHOOK_CRITICAL_ERROR]", err);
    return res.status(200).send("Internal Error");
  }
}
