import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({ error: "Missing config: SUPABASE_SERVICE_ROLE_KEY" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Verificar registros en oxapay_addresses
    const { data: addresses, error: addrErr } = await supabase
      .from('oxapay_addresses')
      .select('*')
      .limit(10);

    // 2. Verificar si la función RPC existe (intentando una llamada de prueba)
    const { error: rpcErr } = await supabase.rpc('increment_wallet_balance', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_amount: 0
    });

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      database: {
        table_oxapay_addresses: addresses || [],
        table_error: addrErr?.message || "OK",
        rpc_function_status: rpcErr?.message?.includes('not found') ? "MISSING_RPC" : "PRESENT/READY"
      },
      environment: {
        has_supabase_url: !!supabaseUrl,
        has_service_key: !!supabaseKey,
        merchant_key_defined: !!process.env.OXAPAY_MERCHANT_KEY
      }
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
}
