import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY || '1CGXHT-VVIJA3-ISZAEU-OC7I5D';

    if (!supabaseKey) {
      return res.status(200).json({ error: "ERR_CONFIG: Supabase key missing in environment." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      if (!user_id || !network) {
        return res.status(200).json({ error: "ERR_PARAMS: Missing user_id or network." });
      }

      const normNetwork = network.toUpperCase();

      // 1. CACHE FETCH
      try {
        const { data: exist, error: fetchErr } = await supabase
          .from('oxapay_addresses')
          .select('address')
          .eq('user_id', user_id)
          .eq('network', normNetwork)
          .maybeSingle();

        if (fetchErr) {
          console.error("DB Fetch Error:", fetchErr);
        } else if (exist?.address) {
          return res.status(200).json({ address: exist.address, source: 'cache_stable' });
        }
      } catch (dbErr) {
        console.warn("DB Exception:", dbErr.message);
      }

      // 2. NETWORK MAPPING
      const networkMapping = {
        'TRON': 'TRON', 
        'BSC': 'BSC',
        'ETH': 'ETH',
        'TRC20': 'TRON',
        'BEP20': 'BSC',
        'ERC20': 'ETH'
      };

      const oxaNetwork = networkMapping[normNetwork] || normNetwork;

      // 3. OXAPAY CALL
      const oxaResp = await fetch('https://api.oxapay.com/v1/payment/static-address', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'merchant_api_key': merchantKey 
        },
        body: JSON.stringify({
          network: oxaNetwork,
          currency: (currency || 'USDT').toUpperCase(),
          order_id: `DEP_${user_id.slice(0, 8)}_${normNetwork}`,
          description: `Static for ${user_id}`
        })
      });

      const oxaData = await oxaResp.json();
      const address = oxaData.address || oxaData.data?.address;

      if (address) {
        // 4. PERSISTENCE SAVE
        try {
          const { error: upsertErr } = await supabase.from('oxapay_addresses').upsert({
            user_id,
            network: normNetwork,
            address: address,
            currency: (currency || 'USDT').toUpperCase(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id, network' });

          if (upsertErr) {
            console.error("Critical Persistence Failure:", upsertErr);
          }
        } catch (saveErr) {
          console.error("Upsert Exception:", saveErr.message);
        }

        return res.status(200).json({ address, source: 'api_fresh' });
      } else {
        const errorMsg = oxaData.message || oxaData.description || "Unknown OxaPay Error";
        return res.status(200).json({ 
          error: `OxaPay: ${errorMsg}`,
          debug: { sent_net: oxaNetwork, user: user_id }
        });
      }
    }
    
    return res.status(200).send("Endpoint Active");
  } catch (err) {
    return res.status(200).json({ error: "SERVER_EXC: " + err.message });
  }
}



