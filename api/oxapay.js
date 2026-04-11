import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY || '1CGXHT-VVIJA3-ISZAEU-OC7I5D';

    if (!supabaseKey) {
      return res.status(200).json({ error: "Faltan claves de Supabase en Vercel." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      if (!user_id || !network) {
        return res.status(200).json({ error: "Parámetros insuficientes." });
      }

      // 1. Intentar recuperar desde la cache de la base de datos (oxapay_addresses)
      try {
        const { data: exist } = await supabase
          .from('oxapay_addresses')
          .select('address')
          .eq('user_id', user_id)
          .eq('network', network.toUpperCase())
          .maybeSingle();

        if (exist?.address) {
          return res.status(200).json({ address: exist.address });
        }
      } catch (dbErr) {
        console.warn("DB Cache Error:", dbErr.message);
      }

      // 2. Mapeo de Redes
      const networkMapping = {
        'TRON': 'TRON', 
        'BSC': 'BSC',
        'ETH': 'ETH',
        'OPTIMISM': 'OPTIMISM'
      };

      const oxaNetwork = networkMapping[network.toUpperCase()] || network.toUpperCase();

      // 3. Llamada al API de OxaPay v1
      // Usamos un order_id consistente para evitar duplicados en OxaPay si lo soportan
      const oxaResp = await fetch('https://api.oxapay.com/v1/payment/static-address', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'merchant_api_key': merchantKey 
        },
        body: JSON.stringify({
          network: oxaNetwork,
          currency: (currency || 'USDT').toUpperCase(),
          order_id: `DEP_${user_id.slice(0, 8)}_${network.toUpperCase()}`,
          description: `Deposit address for user ${user_id}`
        })
      });

      const oxaData = await oxaResp.json();
      
      // En OxaPay v1, la respuesta suele estar en oxaData.data.address
      const address = oxaData.address || oxaData.data?.address;

      if (address) {
        // Guardar en la BD para persistencia
        try {
          await supabase.from('oxapay_addresses').upsert({
            user_id,
            network: network.toUpperCase(),
            address: address,
            currency: (currency || 'USDT').toUpperCase(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, network' });
        } catch (saveErr) {
          console.error("Error saving to DB:", saveErr.message);
        }

        return res.status(200).json({ address });
      } else {
        const errorMsg = oxaData.message || oxaData.description || JSON.stringify(oxaData);
        // Si el mensaje es "Operation completed successfully" pero no hay address, es un error de mapeo o params
        return res.status(200).json({ error: `OxaPay Response: ${errorMsg}` });
      }
    }
    
    return res.status(200).send("API Online");
  } catch (err) {
    console.error("Critical Handler Error:", err);
    return res.status(200).json({ error: "Excepción en el servidor: " + err.message });
  }
}

