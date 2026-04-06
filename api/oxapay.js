import { createClient } from '@supabase/supabase-js';

// Inicialización de Supabase con logging de errores
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;
try {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('CRITICAL: Missing Supabase environment variables');
  } else {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  }
} catch (e) {
  console.error('FAILED to initialize Supabase client:', e);
}

export default async function handler(req, res) {
  const OXAPAY_KEY = process.env.OXAPAY_MERCHANT_KEY;

  if (!OXAPAY_KEY) {
    console.error('CRITICAL: OXAPAY_MERCHANT_KEY is missing in environment variables');
    return res.status(500).json({ error: 'Configuración incompleta', details: 'Falta OXAPAY_MERCHANT_KEY en Vercel' });
  }

  // 1. Handle IPN (CALLBACK FROM OXAPAY)
  if (req.method === 'POST') {
    // Usamos el modulo crypto nativo de Node
    const crypto = await import('crypto');
    const hmac = req.headers['hmac'];
    const body = JSON.stringify(req.body);
    
    const hash = crypto.createHmac('sha512', OXAPAY_KEY).update(body).digest('hex');
    if (hash !== hmac) {
      console.warn('IPN signature mismatch');
      return res.status(401).send('Invalid signature');
    }

    const { status, amount, currency, network, order_id, trackId } = req.body;

    if (status === 'confirming' || status === 'paid' || status === 'success') {
       if (status === 'paid' || status === 'success') {
          try {
            const { data: wallet, error: walletError } = await supabase
              .from('wallets')
              .select('id, user_id, balance_usdc')
              .eq('user_id', order_id)
              .single();

            if (walletError || !wallet) throw new Error('Wallet not found for user: ' + order_id);

            const { data: existingTx } = await supabase
              .from('transactions')
              .select('id')
              .eq('tx_hash', trackId)
              .single();

            if (existingTx) return res.status(200).send('ok');

            const newBalance = parseFloat(wallet.balance_usdc) + parseFloat(amount);
            await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('id', wallet.id);

            await supabase.from('transactions').insert({
              user_id: wallet.user_id,
              type: 'deposit',
              amount: parseFloat(amount),
              description: `Depósito OxaPay: ${amount} ${currency} (${network})`,
              status: 'completed',
              tx_hash: trackId
            });

            await supabase.from('notifications').insert({
              user_id: wallet.user_id,
              title: '💰 Depósito Acreditado',
              message: `Tu depósito de ${amount} ${currency} vía ${network} ha sido procesado con éxito.`,
              type: 'transaction'
            });

            return res.status(200).send('ok');
          } catch (error) {
            console.error('IPN processing error:', error);
            return res.status(200).send('ok');
          }
       }
    }
    return res.status(200).send('ok');
  }

  // 2. Handle GET (REQUEST PERSONAL ADDRESS BY NETWORK)
  if (req.method === 'GET') {
    const { user_id, currency = 'USDT', network = 'TRC20' } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    console.log(`Generating address for User: ${user_id}, Currency: ${currency}, Network: ${network}`);

    try {
      if (!supabase) throw new Error('Supabase not initialized');

      const { data: existing, error: fetchErr } = await supabase
        .from('oxapay_addresses')
        .select('address')
        .eq('user_id', user_id)
        .eq('currency', currency)
        .eq('network', network)
        .maybeSingle();

      if (fetchErr) console.error('Database fetch error:', fetchErr);

      if (existing) {
        return res.status(200).json({ address: existing.address });
      }

      // IMPORTANTE: OxaPay Static Address request
      // Usamos el fetch global (Node 18+)
      const oxaResponse = await fetch('https://api.oxapay.com/merchants/request/staticaddress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: OXAPAY_KEY,
          currency: currency.toUpperCase(),
          network: network.toUpperCase(),
          callback_url: `https://${req.headers.host}/api/oxapay`,
          order_id: user_id
        })
      });

      const data = await oxaResponse.json();
      console.log('OxaPay Response:', data);

      if (data.result !== 100) {
        return res.status(500).json({ 
          error: 'OxaPay Error', 
          details: data.message || 'Error desconocido de OxaPay',
          code: data.result 
        });
      }

      const newAddress = data.address;

      // Save to database
      const { error: insertErr } = await supabase.from('oxapay_addresses').insert({
        user_id,
        currency: currency.toUpperCase(),
        network: network.toUpperCase(),
        address: newAddress
      });

      if (insertErr) {
        console.error('Error saving address to DB:', insertErr);
        // Retornamos la dirección igual, aunque haya fallado el guardado preventivo
      }

      return res.status(200).json({ address: newAddress });
    } catch (error) {
      console.error('Server Handler Error:', error);
      return res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  }

  return res.status(405).send('Method Not Allowed');
}
