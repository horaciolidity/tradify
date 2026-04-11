import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY || '1CGXHT-VVIJA3-ISZAEU-OC7I5D'; // Prioritize ENV but fallback if needed

    if (!supabaseKey) {
      return res.status(200).json({ error: "Faltan claves de Supabase en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      if (!user_id || !network) {
        return res.status(200).json({ error: "Parámetros insuficientes." });
      }

      // 1. Intentar recuperar desde la cache de la base de datos
      try {
        const { data: exist } = await supabase
          .from('oxapay_addresses')
          .select('address')
          .eq('user_id', user_id)
          .eq('network', network)
          .maybeSingle();

        if (exist?.address) return res.status(200).json({ address: exist.address });
      } catch (dbErr) {
        console.warn("DB Cache Error (Table might not exist):", dbErr.message);
      }

      // 2. Mapeo de Redes (Sincronizado con Wallet.tsx y lo que OxaPay v1 espera)
      // Ajustamos según el snippet del usuario (TRON) y estándares (BSC, ETH)
      const networkMapping = {
        'TRON': 'TRON', 
        'BSC': 'BSC',
        'ETH': 'ETH'
      };

      const oxaNetwork = networkMapping[network.toUpperCase()] || network.toUpperCase();

      // 3. Llamada al API de OxaPay v1 (Payment/Static Address)
      // Usando el endpoint y formato sugerido por el usuario
      const oxaResp = await fetch('https://api.oxapay.com/v1/payment/static-address', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'merchant_api_key': merchantKey 
        },
        body: JSON.stringify({
          network: oxaNetwork,
          to_currency: (currency || 'USDT').toUpperCase(),
          auto_withdrawal: false,
          order_id: `DEP_${user_id.slice(0, 5)}_${Date.now().toString().slice(-4)}`,
          description: `Deposit address for user ${user_id}`
        })
      });

      const oxaData = await oxaResp.json();
      
      if (oxaData.address) {
        // Intentar guardar en la BD para futuras peticiones (no bloqueante)
        try {
          await supabase.from('oxapay_addresses').insert({
            user_id,
            network: network,
            address: oxaData.address,
            currency: currency || 'USDT'
          });
        } catch (saveErr) {
          console.error("Error saving to DB:", saveErr.message);
        }

        return res.status(200).json({ address: oxaData.address });
      } else {
        // Enviar error específico de OxaPay
        const errorMsg = oxaData.message || oxaData.description || JSON.stringify(oxaData);
        return res.status(200).json({ error: `OxaPay: ${errorMsg}` });
      }
    }
    
    return res.status(200).send("API Online");
  } catch (err) {
    console.error("Critical Handler Error:", err);
    return res.status(200).json({ error: "Excepción en el servidor: " + err.message });
  }
}
