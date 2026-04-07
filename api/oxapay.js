import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY;

    if (!supabaseUrl || !supabaseKey || !merchantKey) {
      return res.status(500).json({ error: "Faltan variables de entorno en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Webhook (POST) ---
    if (req.method === 'POST') {
      const hmac = crypto.createHmac('sha512', merchantKey);
      const bodyStr = JSON.stringify(req.body);
      const calculated = hmac.update(bodyStr).digest('hex');
      if (calculated !== req.headers['x-signature']) return res.status(401).send('Bad Signature');
      
      const { status, amount, userId, network } = req.body;
      if (status === 'paid' || status === 'confirmed') {
        const { data: w } = await supabase.from('wallets').select('balance_usdc').eq('user_id', userId).single();
        await supabase.from('wallets').update({ balance_usdc: (w?.balance_usdc || 0) + parseFloat(amount) }).eq('user_id', userId);
        await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: parseFloat(amount), description: `Depósito OxaPay (${network})`, status: 'completed' });
      }
      return res.status(200).send('OK');
    }

    // --- Obtener Dirección (GET) ---
    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;
      if (!user_id || !network) return res.status(400).json({ error: 'Falta user_id o network.' });

      // 1. Ver si ya tiene dirección guardada
      const { data: exist } = await supabase.from('oxapay_addresses').select('address').eq('user_id', user_id).eq('network', network).single();
      if (exist?.address) return res.status(200).json({ address: exist.address });

      // 2. Pedir a OxaPay (NUEVA URL CORREGIDA)
      // Endpoint oficial: https://api.oxapay.com/merchant/generate-address
      const oxaResp = await fetch('https://api.oxapay.com/merchant/generate-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: merchantKey,
          currency: currency || 'USDT',
          network: network,
          callbackUrl: `https://${req.headers.host}/api/oxapay`
        })
      });

      const oxaData = await oxaResp.json();
      
      // Si la API responde OK (mensaje de éxito o código 200)
      if (oxaData.status === 200 || oxaData.address) {
        await supabase.from('oxapay_addresses').insert({
          user_id,
          network,
          address: oxaData.address,
          currency: currency || 'USDT'
        });
        return res.status(200).json({ address: oxaData.address });
      } else {
        // Reportar el mensaje exacto de OxaPay
        return res.status(500).json({ error: `OxaPay dice: ${oxaData.message || 'Error API'}` });
      }
    }

    return res.status(405).send('Not Allowed');
  } catch (err) {
    return res.status(500).json({ error: `Crash Servidor: ${err.message}` });
  }
}
