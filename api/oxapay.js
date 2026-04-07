import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY;

    if (!supabaseUrl || !supabaseKey || !merchantKey) {
      return res.status(500).json({ error: "Faltan variables en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Webhook ---
    if (req.method === 'POST') {
      const hmac = crypto.createHmac('sha512', merchantKey);
      const calculated = hmac.update(JSON.stringify(req.body)).digest('hex');
      if (calculated !== req.headers['x-signature']) return res.status(401).send('Bad Signature');
      
      const { status, amount, userId, network } = req.body;
      if (status === 'paid' || status === 'confirmed') {
        const { data: w } = await supabase.from('wallets').select('balance_usdc').eq('user_id', userId).single();
        await supabase.from('wallets').update({ balance_usdc: (w?.balance_usdc || 0) + parseFloat(amount) }).eq('user_id', userId);
        await supabase.from('transactions').insert({ user_id: userId, type: 'deposit', amount: parseFloat(amount), description: `Depósito OxaPay (${network})`, status: 'completed' });
      }
      return res.status(200).send('OK');
    }

    // --- Obtener Dirección ---
    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;
      if (!user_id || !network) return res.status(400).json({ error: 'Data missing.' });

      const { data: exist } = await supabase.from('oxapay_addresses').select('address').eq('user_id', user_id).eq('network', network).single();
      if (exist?.address) return res.status(200).json({ address: exist.address });

      // LLAMADA A OXAPAY (URL PLURAL CORRECTA)
      const oxaResp = await fetch('https://api.oxapay.com/merchants/get/static-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: merchantKey,
          currency: currency || 'USDT',
          network: network,
          callbackUrl: `https://${req.headers.host}/api/oxapay`
        })
      });

      // Validar si la respuesta es JSON antes de parsear
      const contentType = oxaResp.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const textError = await oxaResp.text();
        return res.status(500).json({ error: `OxaPay no devolvió JSON. Status: ${oxaResp.status}. Body: ${textError.slice(0, 50)}` });
      }

      const oxaData = await oxaResp.json();
      if ((oxaData.status === 200 || oxaData.address) && oxaData.address) {
        await supabase.from('oxapay_addresses').insert({ user_id, network, address: oxaData.address, currency: currency || 'USDT' });
        return res.status(200).json({ address: oxaData.address });
      } else {
        return res.status(500).json({ error: `OxaPay Error: ${oxaData.message || 'Sin mensaje'}` });
      }
    }
    return res.status(405).send('Not Allowed');
  } catch (err) {
    return res.status(500).json({ error: `Crash: ${err.message}` });
  }
}
