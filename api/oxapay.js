import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://dummy.supabase.co';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY;

    if (!supabaseKey || !merchantKey) {
      return res.status(200).json({ error: "Configuración incompleta en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      // 1. Ver si ya existe
      const { data: exist } = await supabase.from('oxapay_addresses').select('address').eq('user_id', user_id).eq('network', network).single();
      if (exist?.address) return res.status(200).json({ address: exist.address });

      // 2. Pedir a OxaPay (NUEVA RUTA DE RESPALDO UNIVERSAL)
      // Si falla la de merchants, usamos la de request básica
      const oxaResp = await fetch('https://api.oxapay.com/merchants/request/static-address', {
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
      
      if (oxaData.address) {
        await supabase.from('oxapay_addresses').insert({ user_id, network, address: oxaData.address, currency: currency || 'USDT' });
        return res.status(200).json({ address: oxaData.address });
      } else {
        // ULTIMO INTENTO: ¿Quizás están usando una API Key personal en lugar de Merchant Key?
        const personalResp = await fetch('https://api.oxapay.com/api/get-static-address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: merchantKey,
            currency: currency || 'USDT',
            network: network
          })
        });
        const personalData = await personalResp.json();
        if (personalData.address) {
             await supabase.from('oxapay_addresses').insert({ user_id, network, address: personalData.address, currency: currency || 'USDT' });
             return res.status(200).json({ address: personalData.address });
        }
        
        return res.status(200).json({ error: "OxaPay dice: " + (oxaData.message || personalData.message || "No se pudo generar.") });
      }
    }

    return res.status(200).send("Online");
  } catch (err) {
    return res.status(200).json({ error: "ERROR: " + err.message });
  }
}
