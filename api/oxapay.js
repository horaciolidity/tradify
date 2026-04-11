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
      // Normalizamos el nombre de la red para evitar duplicados por casing
      const normNetwork = network.toUpperCase();

      try {
        const { data: exist, error: fetchErr } = await supabase
          .from('oxapay_addresses')
          .select('address')
          .eq('user_id', user_id)
          .eq('network', normNetwork)
          .maybeSingle();

        if (fetchErr) console.error("Supabase Fetch Error:", fetchErr);
        if (exist?.address) {
          return res.status(200).json({ address: exist.address, source: 'cache' });
        }
      } catch (dbErr) {
        console.warn("DB Cache Query Exception:", dbErr.message);
      }

      // 2. Mapeo de Redes para OxaPay
      // OxaPay v1 para Static Address a veces prefiere TRC20/BEP20/ERC20 o TRON/BSC/ETH
      const networkMapping = {
        'TRON': 'TRON', 
        'BSC': 'BSC',
        'ETH': 'ETH',
        'OPTIMISM': 'OPTIMISM',
        'TRC20': 'TRON',
        'BEP20': 'BSC',
        'ERC20': 'ETH',
        'OP': 'OPTIMISM'
      };

      const oxaNetwork = networkMapping[normNetwork] || normNetwork;

      // 3. Llamada al API de OxaPay v1
      const requestBody = {
        network: oxaNetwork,
        currency: (currency || 'USDT').toUpperCase(),
        order_id: `DEP_${user_id.slice(0, 8)}_${normNetwork}`,
        description: `Deposit address for user ${user_id}`
      };

      const oxaResp = await fetch('https://api.oxapay.com/v1/payment/static-address', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'merchant_api_key': merchantKey 
        },
        body: JSON.stringify(requestBody)
      });

      const oxaData = await oxaResp.json();
      
      const address = oxaData.address || oxaData.data?.address;

      if (address) {
        // Guardar en la BD para persistencia
        try {
          // Usamos upsert para asegurar que si ya existe se actualice, 
          // pero lo ideal es que el query de arriba lo encuentre primero.
          const { error: upsertErr } = await supabase.from('oxapay_addresses').upsert({
            user_id,
            network: normNetwork,
            address: address,
            currency: (currency || 'USDT').toUpperCase(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, network' });

          if (upsertErr) console.error("Supabase Upsert Error:", upsertErr);
        } catch (saveErr) {
          console.error("Critical Save Error:", saveErr.message);
        }

        return res.status(200).json({ address, source: 'api' });
      } else {
        const errorMsg = oxaData.message || oxaData.description || JSON.stringify(oxaData);
        // Debugging logs for the user if they see the response
        return res.status(200).json({ 
          error: `OxaPay Error: ${errorMsg}`, 
          details: { requested_network: oxaNetwork, status: oxaData.status } 
        });
      }
    }
    
    return res.status(200).send("API Online");
  } catch (err) {
    console.error("Critical Handler Error:", err);
    return res.status(200).json({ error: "Excepción en el servidor: " + err.message });
  }
}


