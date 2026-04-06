import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const OXAPAY_KEY = process.env.OXAPAY_MERCHANT_KEY;

  // 1. Handle IPN (CALLBACK FROM OXAPAY)
  if (req.method === 'POST') {
    const hmac = req.headers['hmac'];
    const body = JSON.stringify(req.body);
    
    // Validate HMAC
    const hash = crypto.createHmac('sha512', OXAPAY_KEY).update(body).digest('hex');
    if (hash !== hmac) {
      return res.status(401).send('Invalid signature');
    }

    const { status, amount, currency, network, order_id, trackId } = req.body;

    // OxaPay statuses matching paid/success
    if (status === 'confirming' || status === 'paid' || status === 'success') {
       if (status === 'paid' || status === 'success') {
          try {
            // 1. Find user and wallet
            const { data: wallet, error: walletError } = await supabase
              .from('wallets')
              .select('id, user_id, balance_usdc')
              .eq('user_id', order_id)
              .single();

            if (walletError || !wallet) throw new Error('Wallet not found for user_id: ' + order_id);

            // 2. Check if transaction already processed
            const { data: existingTx } = await supabase
              .from('transactions')
              .select('id')
              .eq('tx_hash', trackId)
              .single();

            if (existingTx) return res.status(200).send('ok');

            // 3. Update balance
            const newBalance = parseFloat(wallet.balance_usdc) + parseFloat(amount);
            await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('id', wallet.id);

            // 4. Record transaction
            await supabase.from('transactions').insert({
              user_id: wallet.user_id,
              type: 'deposit',
              amount: parseFloat(amount),
              description: `Depósito OxaPay: ${amount} ${currency} (${network})`,
              status: 'completed',
              tx_hash: trackId
            });

            // 5. Notify user
            await supabase.from('notifications').insert({
              user_id: wallet.user_id,
              title: '💰 Depósito Acreditado',
              message: `Tu depósito de ${amount} ${currency} vía ${network} ha sido procesado con éxito.`,
              type: 'transaction'
            });

            return res.status(200).send('ok');
          } catch (error) {
            console.error('IPN Error:', error);
            return res.status(200).send('ok'); // Still return ok to stop redelivery if it's a logic error
          }
       }
    }
    return res.status(200).send('ok');
  }

  // 2. Handle GET (REQUEST PERSONAL ADDRESS BY NETWORK)
  if (req.method === 'GET') {
    const { user_id, currency = 'USDT', network = 'TRC20' } = req.query;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    try {
      // Check if already has an address for this specific currency/network
      const { data: existing } = await supabase
        .from('oxapay_addresses')
        .select('address')
        .eq('user_id', user_id)
        .eq('currency', currency)
        .eq('network', network)
        .maybeSingle();

      if (existing) {
        return res.status(200).json({ address: existing.address });
      }

      // Generate new static address via OxaPay
      const response = await fetch('https://api.oxapay.com/merchants/request/staticaddress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: OXAPAY_KEY,
          currency: currency,
          network: network,
          callback_url: `https://${req.headers.host}/api/oxapay`,
          order_id: user_id
        })
      });

      const data = await response.json();
      if (data.result !== 100) {
        return res.status(500).json({ error: 'OxaPay Error', details: data.message });
      }

      const newAddress = data.address;

      // Save to NEW table
      await supabase.from('oxapay_addresses').insert({
        user_id,
        currency,
        network,
        address: newAddress
      });

      return res.status(200).json({ address: newAddress });
    } catch (error) {
      console.error('API Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).send('Method Not Allowed');
}
