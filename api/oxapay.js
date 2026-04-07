import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    // 1. Carga de variables (Las 3 que usa el backend)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY;

    if (!supabaseUrl || !supabaseKey || !merchantKey) {
      return res.status(500).json({ error: "Configuración incompleta en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- MANEJADOR DE WEBHOOK (POST) ---
    if (req.method === 'POST') {
      const hmac = crypto.createHmac('sha512', merchantKey);
      const calculated = hmac.update(JSON.stringify(req.body)).digest('hex');
      if (calculated !== req.headers['x-signature']) return res.status(401).send('Firma inválida');
      
      const { status, amount, userId, network } = req.body;
      if (status === 'paid' || status === 'confirmed') {
        const { data: wallet } = await supabase.from('wallets').select('balance_usdc').eq('user_id', userId).single();
        if (wallet) {
          await supabase.from('wallets').update({ balance_usdc: wallet.balance_usdc + parseFloat(amount) }).eq('user_id', userId);
          await supabase.from('transactions').insert({
            user_id: userId,
            type: 'deposit',
            amount: parseFloat(amount),
            description: `Depósito OxaPay (${network})`,
            status: 'completed'
          });
        }
      }
      return res.status(200).send('OK');
    }

    // --- GENERADOR DE DIRECCIONES (GET) ---
    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;
      if (!user_id || !network) return res.status(400).json({ error: 'Faltan parámetros.' });

      // Verificamos si el usuario ya tiene esta red asignada en la BD
      const { data: existing } = await supabase.from('oxapay_addresses').select('address').eq('user_id', user_id).eq('network', network).single();
      if (existing?.address) return res.status(200).json({ address: existing.address });

      // Si no existe, pedimos una nueva a OxaPay
      const oxaResp = await fetch('https://api.oxapay.com/merchants/get/static-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: merchantKey, // Clave de comercio
          currency: currency || 'USDT',
          network: network, // Ahora llegará como 'TRON', 'BSC', etc.
          callbackUrl: `https://${req.headers.host}/api/oxapay`
        })
      });

      const oxaData = await oxaResp.json();
      
      if (oxaData.status === 200 && oxaData.address) {
        // Guardamos la nueva dirección para siempre
        await supabase.from('oxapay_addresses').insert({
          user_id,
          network,
          address: oxaData.address,
          currency: currency || 'USDT'
        });
        return res.status(200).json({ address: oxaData.address });
      } else {
        return res.status(500).json({ error: `OxaPay: ${oxaData.message || 'Falla de comunicación'}` });
      }
    }
    return res.status(405).send('Método no permitido');
  } catch (err) {
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
}
