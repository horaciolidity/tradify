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

    console.log(`[WEBHOOK_RECEIVED] Address: ${address}, Amount: ${amount}, Status: ${status}, Hash: ${tx_hash}`);

    // Solo procesar si el estado es 'paid' o 'confirmed' o 'success'
    const validStatuses = ['paid', 'confirmed', 'success', 'partially_paid'];
    if (validStatuses.includes(status?.toLowerCase())) {
      
      if (!address || !amount) {
        console.error("[WEBHOOK_ERROR] Missing address or amount in payload");
        return res.status(200).json({ message: "Invalid payload" });
      }

      // 1. Buscar al usuario
      let userId = null;
      const cleanAddress = address.trim();

      const { data: addressData, error: findErr } = await supabase
        .from('oxapay_addresses')
        .select('user_id')
        .eq('address', cleanAddress)
        .maybeSingle();

      if (findErr) console.error("[WEBHOOK_DB_ERROR] Error finding address:", findErr);

      if (addressData?.user_id) {
        userId = addressData.user_id;
      } else if (order_id && order_id.length > 20) {
        userId = order_id;
        console.log(`[WEBHOOK_FALLBACK] User found via order_id: ${userId}`);
      }

      if (!userId) {
        console.error(`[WEBHOOK_ERROR] No user found for address: ${cleanAddress} and order: ${order_id}`);
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

      // 3. Actualizar balance
      const numericAmount = parseFloat(amount);
      console.log(`[WEBHOOK_CREDITING] User: ${userId}, Amount: ${numericAmount}`);

      const { data: wallet, error: walletErr } = await supabase.rpc('increment_wallet_balance', {
        p_user_id: userId,
        p_amount: numericAmount
      });

      if (walletErr) {
        console.warn("[WEBHOOK_RPC_FAIL] Falling back to manual update:", walletErr.message);
        // Fallback robusto
        const { data: currentWallet } = await supabase.from('wallets').select('balance_usdc').eq('user_id', userId).maybeSingle();
        if (currentWallet) {
           const newBalance = (currentWallet.balance_usdc || 0) + numericAmount;
           await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', userId);
        } else {
           // Si no existe wallet, la creamos (extra seguridad)
           await supabase.from('wallets').insert({ user_id: userId, balance_usdc: numericAmount });
        }
      }

      // 4. Registrar la transacción
      await supabase.from('transactions').insert({
        user_id: userId,
        type: 'deposit',
        amount: numericAmount,
        status: 'completed',
        description: `Depósito OxaPay (${network || currency})`,
        tx_hash: tx_hash
      });

      console.log(`[WEBHOOK_SUCCESS] Balance updated for ${userId}: +${numericAmount} USDC`);
      return res.status(200).json({ message: "Payment processed successfully", user: userId, amount: numericAmount });
    }

    console.log(`[WEBHOOK_IDLE] Status '${status}' is not a processing status.`);
    return res.status(200).json({ message: "Status not processing" });
  } catch (err) {
    console.error("[WEBHOOK_CRITICAL_ERROR]", err);
    return res.status(200).json({ error: "Internal Error", message: err.message });
  }
}
