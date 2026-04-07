import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY;

    if (!supabaseUrl || !supabaseKey || !merchantKey) {
      return res.status(200).json({ error: "Faltan variables en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      // 1. Ver si ya existe
      const { data: exist } = await supabase.from('oxapay_addresses').select('address').eq('user_id', user_id).eq('network', network).single();
      if (exist?.address) return res.status(200).json({ address: exist.address });

      // 2. Pedir a OxaPay (NUEVA URL DE RESPALDO)
      const oxaResp = await fetch('https://api.oxapay.com/merchants/get/static-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: merchantKey,
          currency: currency || 'USDT',
          network: network,
          callbackUrl: `https://${req.headers.host}/api/oxapay`
        })
      });

      const oxaData = await oxaResp.json();
      
      // Si OxaPay responde con éxito
      if (oxaData.address) {
        await supabase.from('oxapay_addresses').insert({ user_id, network, address: oxaData.address, currency: currency || 'USDT' });
        return res.status(200).json({ address: oxaData.address });
      } else {
        // Si no, mostramos todo el objeto para ver qué falta
        return res.status(200).json({ error: "OxaPay dice: " + (oxaData.message || JSON.stringify(oxaData)) });
      }
    }

    return res.status(200).send("API Online");
  } catch (err) {
    return res.status(200).json({ error: "CONEXION: " + err.message });
  }
}
