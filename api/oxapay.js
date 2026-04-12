import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY || '1CGXHT-VVIJA3-ISZAEU-OC7I5D';

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ error: "ERR_CONFIG: Missing Server Credentials (SERVICE_ROLE_KEY)" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      if (!user_id || !network) {
        return res.status(200).json({ error: "ERR_PARAMS: Missing user_id or network." });
      }

      const cleanUserId = user_id.trim();
      const cleanNetwork = network.toUpperCase().trim();
      const cleanCurrency = (currency || 'USDT').toUpperCase().trim();

      // 1. BUSCAR EN CACHÉ (La base de datos siempre manda)
      try {
        const { data: exist, error: fetchErr } = await supabase
          .from('oxapay_addresses')
          .select('address')
          .eq('user_id', cleanUserId)
          .eq('network', cleanNetwork)
          .maybeSingle();

        if (exist?.address) {
          return res.status(200).json({ address: exist.address, source: 'cache_stable' });
        }
      } catch (dbErr) {
        console.error("DB_FETCH_ERROR", dbErr);
      }

      // 2. MAPEO DE REDES PARA OXAPAY
      const networkMap = {
        'TRON': 'TRON', 'TRC20': 'TRON',
        'BSC': 'BSC', 'BEP20': 'BSC',
        'ETH': 'ETH', 'ERC20': 'ETH'
      };
      const oxaNetwork = networkMap[cleanNetwork] || cleanNetwork;

      // 3. PEDIR A OXAPAY (Si no estaba en DB)
      // Usamos el user_id como order_id para que OxaPay asocie la dirección al mismo usuario
      const oxaResp = await fetch('https://api.oxapay.com/v1/payment/static-address', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'merchant_api_key': merchantKey 
        },
        body: JSON.stringify({
          network: oxaNetwork,
          currency: cleanCurrency,
          order_id: `STATIC_${cleanUserId.slice(0, 8)}`,
          description: `Address for User ${cleanUserId}`
        })
      });

      const oxaData = await oxaResp.json();
      const isOxaSuccess = oxaData.code === 100 || oxaData.message?.includes('success');
      const newAddress = oxaData.address || oxaData.data?.address;

      if (isOxaSuccess && newAddress) {
        // 4. GUARDAR EN DB ANTES DE RETORNAR
        const { error: upsertErr } = await supabase
          .from('oxapay_addresses')
          .upsert({
            user_id: cleanUserId,
            network: cleanNetwork,
            address: newAddress,
            currency: cleanCurrency,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,network' });

        if (upsertErr) console.error("DB_SAVE_ERROR", upsertErr);

        return res.status(200).json({ 
          address: newAddress, 
          source: 'api_fresh',
          saved: !upsertErr
        });
      } else {
        return res.status(200).json({ 
          error: "OxaPay Error: " + (oxaData.message || "Unknown"),
          debug: oxaData
        });
      }
    }
    
    return res.status(200).send("Endpoint Active");
  } catch (err) {
    return res.status(200).json({ error: "INTERNAL_ERROR: " + err.message });
  }
}



