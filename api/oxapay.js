import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dummy.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY;

    if (!supabaseKey || !merchantKey) {
      return res.status(200).json({ error: "Faltan variables en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      const { data: exist } = await supabase.from('oxapay_addresses').select('address').eq('user_id', user_id).eq('network', network).single();
      if (exist?.address) return res.status(200).json({ address: exist.address });

      // LLAMADA CON GUION (Endpoint oficial unificado)
      // https://api.oxapay.com/merchants/get-static-address
      const oxaResp = await fetch('https://api.oxapay.com/merchants/get-static-address', {
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
      
      // Si funciona, guardamos y devolvemos
      if (oxaData.address) {
        await supabase.from('oxapay_addresses').insert({
          user_id,
          network,
          address: oxaData.address,
          currency: currency || 'USDT'
        });
        return res.status(200).json({ address: oxaData.address });
      } else {
        // Si falla, probamos la ruta de RESPALDO (request)
        const backupResp = await fetch('https://api.oxapay.com/merchants/request/static-address', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             merchant: merchantKey,
             currency: currency || 'USDT',
             network: network
           })
        });
        const backupData = await backupResp.json();
        
        if (backupData.address) {
           await supabase.from('oxapay_addresses').insert({ user_id, network, address: backupData.address });
           return res.status(200).json({ address: backupData.address });
        }

        return res.status(200).json({ error: "OxaPay: " + (oxaData.message || backupData.message || "Endpoint no disponible.") });
      }
    }

    return res.status(200).send("API OK");
  } catch (err) {
    return res.status(200).json({ error: "ERR: " + err.message });
  }
}
