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

      // 1. BUSCAR EN CACHÉ
      console.log(`[DEBUG_OXA] Fetching for User: ${cleanUserId}, Net: ${cleanNetwork}`);
      try {
        const { data: exist, error: fetchErr } = await supabase
          .from('oxapay_addresses')
          .select('*') // Seleccionar todo para debug
          .eq('user_id', cleanUserId)
          .eq('network', cleanNetwork)
          .maybeSingle();

        if (fetchErr) {
          console.error("[DEBUG_OXA] Fetch Error:", fetchErr);
        }

        if (exist?.address) {
          console.log(`[DEBUG_OXA] HIT! Returning existing address: ${exist.address}`);
          return res.status(200).json({ 
             address: exist.address, 
             source: 'cache_stable', 
             db_id: exist.id 
          });
        }
      } catch (dbErr) {
        console.error("[DEBUG_OXA] Exception in Fetch:", dbErr);
      }

      // 2. PEDIR A OXAPAY (Si no estaba en DB)
      console.log(`[DEBUG_OXA] MISS! Calling OxaPay for fresh address.`);
      const oxaResp = await fetch('https://api.oxapay.com/v1/payment/static-address', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'merchant_api_key': merchantKey 
        },
        body: JSON.stringify({
          network: oxaNetwork,
          currency: cleanCurrency,
          order_id: cleanUserId,
          description: `Static Addr for ${cleanUserId}`
        })
      });

      const oxaData = await oxaResp.json();
      const isOxaSuccess = oxaData.code === 100 || oxaData.message?.toLowerCase().includes('success');
      const newAddress = oxaData.address || oxaData.data?.address;

      if (isOxaSuccess && newAddress) {
        // 4. GUARDAR EN DB
        console.log(`[DEBUG_OXA] Saving new address: ${newAddress}`);
        const { data: savedData, error: upsertErr } = await supabase
          .from('oxapay_addresses')
          .upsert({
            user_id: cleanUserId,
            network: cleanNetwork,
            address: newAddress,
            currency: cleanCurrency,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id,network',
            ignoreDuplicates: false
          })
          .select();

        if (upsertErr) {
          console.error("[DEBUG_OXA] CRITICAL UPSERT ERROR:", upsertErr);
        } else {
          console.log("[DEBUG_OXA] Save Successful:", savedData);
        }

        return res.status(200).json({ 
          address: newAddress, 
          source: 'api_fresh',
          db_persistence: upsertErr ? "FAILED" : "SUCCESS",
          db_error: upsertErr ? upsertErr.message : null,
          debug_user: cleanUserId
        });
      } else {
        console.error("[DEBUG_OXA] OxaPay API Returned Failure:", oxaData);
        return res.status(200).json({ 
          error: "OxaPay Error: " + (oxaData.message || "Unknown"),
          debug_full: oxaData
        });
      }
    }
    
    return res.status(200).send("Endpoint Active");
  } catch (err) {
    return res.status(200).json({ error: "INTERNAL_ERROR: " + err.message });
  }
}



