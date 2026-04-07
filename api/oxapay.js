import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY;

    if (!supabaseKey || !merchantKey) {
      return res.status(200).json({ error: "Faltan claves en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      // 1. Ver si ya existe en nuestra BD
      const { data: exist } = await supabase.from('oxapay_addresses').select('address').eq('user_id', user_id).eq('network', network).single();
      if (exist?.address) return res.status(200).json({ address: exist.address });

      // 2. LLAMADA AL API GENERAL (La de tu captura de pantalla)
      // Endpoint: https://api.oxapay.com/api/v1/get-static-address
      const oxaResp = await fetch('https://api.oxapay.com/api/v1/get-static-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: merchantKey, // Tu clave ZRBIZM...
          currency: (currency || 'USDT').toUpperCase(),
          network: (network === 'BSC' ? 'BNB' : network === 'TRON' ? 'TRX' : network).toUpperCase()
        })
      });

      const oxaData = await oxaResp.json();
      
      if (oxaData.address) {
        await supabase.from('oxapay_addresses').insert({
          user_id,
          network,
          address: oxaData.address,
          currency: currency || 'USDT'
        });
        return res.status(200).json({ address: oxaData.address });
      } else {
        // Si falla este, probamos la versión v2 por si acaso
        return res.status(200).json({ error: "OxaPay: " + (oxaData.message || JSON.stringify(oxaData)) });
      }
    }
    return res.status(200).send("API Online");
  } catch (err) {
    return res.status(200).json({ error: "FIX FINAL: " + err.message });
  }
}
