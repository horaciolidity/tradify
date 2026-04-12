import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // 1. CONFIGURATION & ENV DETECTION
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY || '1CGXHT-VVIJA3-ISZAEU-OC7I5D';

    if (!supabaseUrl || !supabaseKey) {
      console.error("OXAPAY_API_ERROR: Supabase credentials missing.");
      return res.status(200).json({ error: "ERR_CONFIG: Server configuration incomplete." });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      const { user_id, network, currency } = req.query;

      if (!user_id || !network) {
        return res.status(200).json({ error: "ERR_PARAMS: Missing user_id or network." });
      }

      const cleanNetwork = network.toUpperCase().trim();
      const cleanCurrency = (currency || 'USDT').toUpperCase().trim();

      // 1. CACHE FETCH (Try to find existing static address)
      try {
        const { data: exist, error: fetchErr } = await supabase
          .from('oxapay_addresses')
          .select('address')
          .eq('user_id', user_id)
          .eq('network', cleanNetwork)
          .maybeSingle();

        if (fetchErr) {
          console.warn(`[CACHE_FETCH_WARN] for user ${user_id}:`, fetchErr.message);
        } else if (exist?.address) {
          console.log(`[CACHE_HIT] user ${user_id} on ${cleanNetwork}`);
          return res.status(200).json({ address: exist.address, source: 'cache_stable' });
        }
      } catch (dbErr) {
        console.error("[CACHE_FETCH_FATAL]:", dbErr.message);
      }

      // 2. NETWORK MAPPING (Map internal labels to OxaPay strings)
      const networkMap = {
        'TRON': 'TRON', 
        'BSC': 'BSC',
        'ETH': 'ETH',
        'TRC20': 'TRON',
        'BEP20': 'BSC',
        'ERC20': 'ETH'
      };

      const oxaNetwork = networkMap[cleanNetwork] || cleanNetwork;

      // 3. OXAPAY API CALL
      console.log(`[API_REQUEST] Generating fresh address for ${user_id} on ${oxaNetwork}`);
      
      const oxaResp = await fetch('https://api.oxapay.com/v1/payment/static-address', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'merchant_api_key': merchantKey 
        },
        body: JSON.stringify({
          network: oxaNetwork,
          currency: cleanCurrency,
          order_id: `DEP_${user_id.split('-')[0]}_${Date.now()}`,
          description: `Static Deposit for ID: ${user_id}`
        })
      });

      const oxaData = await oxaResp.json();
      
      if (oxaData.code === 100 && oxaData.address) {
        const newAddress = oxaData.address;

        // 4. PERSISTENCE SAVE (UPSERT)
        const { error: upsertErr } = await supabase
          .from('oxapay_addresses')
          .upsert({
            user_id,
            network: cleanNetwork, // Save with the label used by the frontend
            address: newAddress,
            currency: cleanCurrency,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id,network' 
          });

        if (upsertErr) {
          console.error("[PERSISTENCE_ERROR]: Failed to save address.", upsertErr);
          // Return the address anyway so the user can pay, but log the failure
        } else {
          console.log(`[PERSISTENCE_SUCCESS] Address saved for user ${user_id}`);
        }

        return res.status(200).json({ 
          address: newAddress, 
          source: 'api_fresh',
          status: upsertErr ? 'saved_failed' : 'saved_ok'
        });
      } else {
        const errorDetail = oxaData.description || oxaData.message || "Unknown OxaPay error";
        console.error(`[OXAPAY_FAILURE]: ${errorDetail}`, oxaData);
        return res.status(200).json({ 
          error: `OxaPay Direct: ${errorDetail}`,
          debug: { sent_network: oxaNetwork, user: user_id }
        });
      }
    }
    
    return res.status(200).send("Tradify OxaPay Gateway Ready");
  } catch (err) {
    console.error("[CRITICAL_SERVER_ERROR]:", err);
    return res.status(200).json({ error: "INTERNAL_SERVER_ERROR: " + err.message });
  }
}



