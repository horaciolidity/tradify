import React, { useState } from 'react';
declare global {
  interface Window {
    ethereum?: any;
  }
}

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  RefreshCcw,
  History,
  Info,
  CreditCard,
  Building2,
  QrCode,
  X,
  ShieldCheck,
  Database,
  Wallet2,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import type { Transaction } from '../types';
import { supabase } from '../services/supabase';

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────
const MASTER_ADDRESS = '0xBAeaDE80A2A1064E4F8f372cd2ADA9a00daB4BBE';

// USDC Contract addresses per network
const USDC_CONTRACTS: Record<string, string> = {
  '56':    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC
  '10':    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism
  '1':     '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
};

const NETWORKS: { id: string; name: string; label: string; color: string; }[] = [
  { id: '56',  name: 'BSC',      label: 'BNB Smart Chain',  color: '#F0B90B' },
  { id: '10',  name: 'OP',       label: 'Optimism',         color: '#FF0420' },
  { id: '1',   name: 'ETH',      label: 'Ethereum',         color: '#627EEA' },
];

// Minimal ERC-20 ABI for transfer + balanceOf
const ERC20_ABI = [
  { "constant": true,  "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
  { "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "type": "function" },
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "type": "function" },
];

// Tiny ABI encoder (no ethers dependency)
function encodeTransfer(to: string, amount: bigint): string {
  const selector = '0xa9059cbb';
  const paddedTo = to.replace('0x', '').toLowerCase().padStart(64, '0');
  const paddedAmount = amount.toString(16).padStart(64, '0');
  return selector + paddedTo + paddedAmount;
}

function encodeBalanceOf(owner: string): string {
  const selector = '0x70a08231';
  const padded = owner.replace('0x', '').toLowerCase().padStart(64, '0');
  return selector + padded;
}

// ──────────────────────────────────────────────────────────────────────────────
const Wallet: React.FC = () => {
  const { wallet, profile } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Deposit modal
  const [depositModal, setDepositModal] = useState(false);
  const [depositTab, setDepositTab] = useState<'manual' | 'web3'>('manual');
  const [depositAmount, setDepositAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWeb3Loading, setIsWeb3Loading] = useState(false);
  const [web3Error, setWeb3Error] = useState('');

  // Withdrawal modal
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState(NETWORKS[0]);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  React.useEffect(() => {
    if (profile) fetchTransactions();
  }, [profile, activeTab]);

  const fetchTransactions = async () => {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', profile?.id)
      .order('created_at', { ascending: false });
    if (activeTab === 'deposits')    query = query.eq('type', 'deposit');
    if (activeTab === 'withdrawals') query = query.eq('type', 'withdrawal');
    const { data, error } = await query;
    if (!error && data) setTransactions(data);
  };

  const copyText = (text: string, which: 'addr' | 'master') => {
    navigator.clipboard.writeText(text);
    if (which === 'master') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else                    { setCopiedAddr(true); setTimeout(() => setCopiedAddr(false), 2000); }
  };

  // ── Notify admin helper ────────────────────────────────────────────────────
  const notifyAdmin = async (title: string, message: string) => {
    try {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .single();
      if (adminProfile) {
        await supabase.from('notifications').insert({
          user_id: adminProfile.id,
          title,
          message,
          type: 'transaction'
        });
      }
    } catch (e) {
      console.warn('Could not notify admin:', e);
    }
  };

  // ── Manual deposit submit ──────────────────────────────────────────────────
  const handleDepositSubmit = async () => {
    if (!depositAmount || !txHash || !profile) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'deposit',
        amount: parseFloat(depositAmount),
        description: `Manual USDC deposit — txid: ${txHash.slice(0, 16)}...`,
        status: 'pending',
        tx_hash: txHash
      });
      if (error) throw error;
      // Notify admin
      await notifyAdmin(
        '💰 New Deposit Request',
        `User ${profile.email} submitted a deposit of ${parseFloat(depositAmount).toFixed(2)} USDC. TXID: ${txHash.slice(0, 16)}... Awaiting approval.`
      );
      setDepositModal(false);
      setDepositAmount('');
      setTxHash('');
      fetchTransactions();
    } catch {
      alert('Failed to register deposit. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Web3 USDC deposit ─────────────────────────────────────────────────────
  const handleWeb3Deposit = async () => {
    setWeb3Error('');
    const amount = parseFloat(depositAmount);
    if (!amount || amount <= 0) { setWeb3Error('Enter a valid USDC amount.'); return; }
    if (!window.ethereum) { setWeb3Error('MetaMask not detected. Install it or use Manual mode.'); return; }

    setIsWeb3Loading(true);
    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];
      const chainId: string = await window.ethereum.request({ method: 'eth_chainId' });
      const chainDecimal = parseInt(chainId, 16).toString();

      const usdcContract = USDC_CONTRACTS[chainDecimal];
      if (!usdcContract) {
        setWeb3Error('Unsupported network. Switch to BSC, Optimism or Ethereum in MetaMask.');
        setIsWeb3Loading(false);
        return;
      }

      // 1. Check USDC balance
      const balanceHex: string = await window.ethereum.request({
        method: 'eth_call',
        params: [{ to: usdcContract, data: encodeBalanceOf(userAddress) }, 'latest']
      });
      const balanceBig = BigInt(balanceHex);
      const decimals = 6; // USDC always 6
      const amountBig = BigInt(Math.round(amount * 10 ** decimals));

      if (balanceBig < amountBig) {
        const humanBalance = Number(balanceBig) / 10 ** decimals;
        setWeb3Error(`Insufficient USDC balance. You have ${humanBalance.toFixed(2)} USDC on this network.`);
        setIsWeb3Loading(false);
        return;
      }

      // 2. Send USDC transfer()
      const data = encodeTransfer(MASTER_ADDRESS, amountBig);
      const hash: string = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: userAddress, to: usdcContract, data }]
      });

      // 3. Register in DB
      await supabase.from('transactions').insert({
        user_id: profile?.id,
        type: 'deposit',
        amount,
        description: `Web3 USDC deposit (${NETWORKS.find(n => n.id === chainDecimal)?.name || chainDecimal})`,
        status: 'pending',
        tx_hash: hash
      });

      // Notify admin
      const networkName = NETWORKS.find(n => n.id === chainDecimal)?.name || chainDecimal;
      await notifyAdmin(
        '💰 New Deposit Request',
        `User ${profile?.email} submitted a Web3 deposit of ${amount.toFixed(2)} USDC via ${networkName}. TXID: ${hash.slice(0, 16)}... Awaiting approval.`
      );

      setDepositModal(false);
      setDepositAmount('');
      fetchTransactions();
    } catch (err: any) {
      if (err.code === 4001) setWeb3Error('Transaction rejected by user.');
      else setWeb3Error(err.message || 'Web3 error. Check console.');
      console.error(err);
    } finally {
      setIsWeb3Loading(false);
    }
  };

  // ── Withdrawal request ────────────────────────────────────────────────────
  const handleWithdrawSubmit = async () => {
    setWithdrawError('');
    const amount = parseFloat(withdrawAmount);

    if (!amount || amount <= 0) { setWithdrawError('Enter a valid amount.'); return; }
    if (!withdrawAddress.match(/^0x[0-9a-fA-F]{40}$/)) { setWithdrawError('Invalid wallet address (must be 0x + 40 hex chars).'); return; }
    if (!wallet || amount > wallet.balance_usdc) { setWithdrawError(`Insufficient balance. You have ${wallet?.balance_usdc.toFixed(4)} USDC available.`); return; }
    if (amount < 10) { setWithdrawError('Minimum withdrawal is 10 USDC.'); return; }

    setWithdrawSubmitting(true);
    try {
      // Create the pending withdrawal transaction
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: profile?.id,
        type: 'withdrawal',
        amount,
        description: `Withdrawal request to ${withdrawAddress.slice(0, 10)}... via ${withdrawNetwork.label}`,
        status: 'pending',
        tx_hash: withdrawAddress
      });

      if (txError) throw txError;

      // Notify admin
      await notifyAdmin(
        '🏧 New Withdrawal Request',
        `User ${profile?.email} requested a withdrawal of ${amount.toFixed(2)} USDC to ${withdrawAddress.slice(0, 12)}... via ${withdrawNetwork.label}. Awaiting approval.`
      );

      setWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      fetchTransactions();
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      setWithdrawError('Failed to submit withdrawal. ' + (err.message || 'Try again.'));
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 pb-10">

      {/* ── Wallet Hero ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Balance Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 glass-card bg-gradient-to-br from-primary/30 via-indigo-900/40 to-transparent p-10 flex flex-col justify-between min-h-[280px] relative overflow-hidden group border-white/10"
        >
          <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:scale-175 transition-transform duration-1000">
            <CreditCard size={180} />
          </div>
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-primary bg-primary/10 w-fit px-4 py-1.5 rounded-full border border-primary/20 backdrop-blur-xl mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Live Balance</span>
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Available USDC</p>
              <h2 className="text-6xl font-black text-white tracking-tighter italic">
                {(wallet?.balance_usdc || 0).toFixed(4)} <span className="text-2xl font-normal text-slate-500 not-italic">USDC</span>
              </h2>
            </div>
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center backdrop-blur-2xl border border-white/10 shadow-2xl">
              <Building2 className="text-primary" size={32} />
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-4 mt-10">
            <button
              onClick={() => setDepositModal(true)}
              className="flex items-center space-x-3 bg-white text-dark font-black px-8 py-4 rounded-2xl hover:bg-slate-200 transition-all active:scale-95 shadow-2xl shadow-white/10 uppercase tracking-widest text-xs"
            >
              <Plus size={20} />
              <span>Deposit USDC</span>
            </button>
            <button
              onClick={() => setWithdrawModal(true)}
              className="flex items-center space-x-3 bg-white/5 text-white font-black px-8 py-4 rounded-2xl hover:bg-white/10 transition-all border border-white/10 backdrop-blur-xl uppercase tracking-widest text-xs"
            >
              <ArrowUpRight size={20} />
              <span>Withdraw</span>
            </button>
          </div>
        </motion.div>

        {/* Deposit Address Box — shows MASTER ADDRESS */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-8 flex flex-col justify-between border-white/10 relative overflow-hidden"
        >
          <div className="absolute bottom-0 right-0 p-8 opacity-5"><QrCode size={120} /></div>
          <div className="space-y-5 relative z-10">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white uppercase tracking-tighter italic text-lg">Deposit Address</h3>
              <QrCode size={22} className="text-primary" />
            </div>
            <div className="bg-black/50 border border-primary/20 rounded-2xl p-5 flex flex-col items-center space-y-4 group/addr relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/3 opacity-0 group-hover/addr:opacity-100 transition-opacity" />
              <span className="text-[11px] font-mono text-primary break-all text-center leading-relaxed font-bold">
                {MASTER_ADDRESS}
              </span>
              <button
                onClick={() => copyText(MASTER_ADDRESS, 'master')}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-white/5 hover:bg-primary/20 hover:text-primary rounded-xl text-slate-500 transition-all border border-white/5"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span className="text-[10px] font-black uppercase tracking-widest">{copied ? 'Copied!' : 'Copy Address'}</span>
              </button>
            </div>
            <div className="space-y-2">
              {[
                '✅ Send USDC only to this address',
                '🌐 Supported: BSC · Optimism · Ethereum',
                '⚠️ Do NOT send other tokens — funds may be lost',
              ].map(t => (
                <p key={t} className="text-[10px] text-slate-500 font-bold leading-relaxed">{t}</p>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── DEPOSIT MODAL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {depositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDepositModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="glass-card w-full max-w-xl p-10 relative z-10 border-white/10"
            >
              <button onClick={() => setDepositModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white">
                <X size={28} />
              </button>

              <div className="flex items-center space-x-4 mb-8">
                <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                  <ArrowDownLeft size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Deposit USDC</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">BSC · Optimism · Ethereum</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 mb-8">
                <button onClick={() => { setDepositTab('manual'); setWeb3Error(''); }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${depositTab === 'manual' ? 'bg-primary text-white' : 'text-slate-500'}`}>
                  Manual (paste tx)
                </button>
                <button onClick={() => { setDepositTab('web3'); setWeb3Error(''); }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${depositTab === 'web3' ? 'bg-accent/20 text-accent border border-accent/20' : 'text-slate-500'}`}>
                  MetaMask Web3
                </button>
              </div>

              {depositTab === 'manual' ? (
                <div className="space-y-6">
                  {/* Step list */}
                  <div className="bg-white/3 rounded-2xl p-5 border border-white/5 space-y-3">
                    {[
                      `Send USDC to: ${MASTER_ADDRESS}`,
                      'Supported networks: BSC, Optimism, Ethereum',
                      'Copy the Transaction Hash (TXID) from your wallet app',
                      'Paste below and specify the exact USDC amount sent',
                    ].map((t, i) => (
                      <div key={i} className="flex items-start space-x-3">
                        <span className="w-5 h-5 rounded-lg bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                        <p className="text-xs text-slate-400 font-bold">{t}</p>
                      </div>
                    ))}
                  </div>

                  {/* Master address display */}
                  <div className="bg-black/40 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-xs font-mono text-primary font-black truncate mr-3">{MASTER_ADDRESS}</span>
                    <button onClick={() => copyText(MASTER_ADDRESS, 'master')} className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">USDC Amount</label>
                      <div className="relative">
                        <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-black italic focus:border-primary/50 transition-all outline-none pr-16" />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary italic">USDC</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Network</label>
                      <div className="w-full bg-white/3 border border-white/5 rounded-2xl p-4 text-slate-400 font-black italic flex items-center space-x-2 uppercase">
                        <span className="text-emerald-400">USDC</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-400 text-xs">BSC/OP/ETH</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Transaction Hash (TXID)</label>
                    <input type="text" value={txHash} onChange={(e) => setTxHash(e.target.value)}
                      placeholder="0x..."
                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-mono text-xs focus:border-primary/50 transition-all outline-none" />
                  </div>

                  <button onClick={handleDepositSubmit} disabled={isSubmitting || !depositAmount || !txHash}
                    className="w-full primary-button py-5 text-xs font-black uppercase tracking-[0.3em] disabled:opacity-40">
                    {isSubmitting ? 'Submitting...' : 'Submit Deposit for Review'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 bg-accent/5 border border-accent/20 rounded-2xl text-center">
                    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center text-accent mx-auto mb-4"><ShieldCheck size={36} /></div>
                    <h4 className="text-lg font-black text-white italic mb-2">Direct USDC Transfer via MetaMask</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">Connects to your wallet and sends USDC directly. We verify your balance before sending — no failed transactions.</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Amount (USDC)</label>
                    <input type="number" value={depositAmount} onChange={(e) => { setDepositAmount(e.target.value); setWeb3Error(''); }}
                      placeholder="0.00"
                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-2xl font-black italic text-primary focus:border-primary/50 transition-all outline-none text-center" />
                  </div>

                  {web3Error && (
                    <div className="flex items-start space-x-3 bg-error/10 border border-error/20 rounded-xl p-4">
                      <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />
                      <p className="text-xs text-error font-bold">{web3Error}</p>
                    </div>
                  )}

                  <div className="bg-white/3 rounded-xl p-4 border border-white/5 space-y-1">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Supported Networks</p>
                    <div className="flex gap-2 mt-2">
                      {NETWORKS.map(n => (
                        <span key={n.id} className="px-3 py-1 rounded-full text-[10px] font-black border"
                          style={{ borderColor: n.color + '40', color: n.color, background: n.color + '10' }}>{n.name}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-600 mt-2">⚠️ We check your USDC balance before sending — you must have enough on the selected network.</p>
                  </div>

                  <button onClick={handleWeb3Deposit} disabled={isWeb3Loading || !depositAmount}
                    className="w-full py-5 bg-accent text-dark font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-accent/30 hover:scale-[1.02] transition-all flex items-center justify-center space-x-3 disabled:opacity-40">
                    {isWeb3Loading ? <RefreshCcw size={20} className="animate-spin" /> : <><Plus size={20} /><span>Send USDC via MetaMask</span></>}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── WITHDRAWAL MODAL ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {withdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setWithdrawModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="glass-card w-full max-w-lg p-10 relative z-10 border-white/10"
            >
              <button onClick={() => setWithdrawModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={28} /></button>

              <div className="flex items-center space-x-4 mb-8">
                <div className="w-14 h-14 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <ArrowUpRight size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Withdraw USDC</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Balance: {(wallet?.balance_usdc || 0).toFixed(4)} USDC</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Network Selector */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Select Network</label>
                  <div className="grid grid-cols-3 gap-3">
                    {NETWORKS.map(n => (
                      <button key={n.id} onClick={() => setWithdrawNetwork(n)}
                        className={`py-3 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all flex flex-col items-center space-y-1 ${withdrawNetwork.id === n.id ? 'border-opacity-60' : 'bg-white/3 border-white/10 text-slate-500'}`}
                        style={withdrawNetwork.id === n.id ? { background: n.color + '15', borderColor: n.color + '50', color: n.color } : {}}
                      >
                        <span className="text-lg">{n.name === 'BSC' ? '⚡' : n.name === 'OP' ? '🔴' : '💎'}</span>
                        <span>{n.name}</span>
                        <span className="text-[8px] opacity-60 normal-case font-bold">{n.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destination Address */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-2">
                    <Wallet2 size={12} /> Your {withdrawNetwork.name} Wallet Address
                  </label>
                  <input type="text" value={withdrawAddress}
                    onChange={(e) => { setWithdrawAddress(e.target.value); setWithdrawError(''); }}
                    placeholder="0x..."
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-mono text-xs focus:border-primary/50 transition-all outline-none" />
                  <p className="text-[10px] text-slate-600 mt-1 font-bold">EVM address (0x...) compatible with {withdrawNetwork.label}</p>
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">USDC Amount</label>
                    <button onClick={() => setWithdrawAmount(wallet?.balance_usdc.toFixed(4) || '')}
                      className="text-[10px] font-black text-primary uppercase tracking-widest">MAX</button>
                  </div>
                  <div className="relative">
                    <input type="number" value={withdrawAmount}
                      onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawError(''); }}
                      placeholder="0.00"
                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-black italic text-lg focus:border-primary/50 transition-all outline-none pr-20" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary italic">USDC</span>
                  </div>
                  {withdrawAmount && wallet && parseFloat(withdrawAmount) > wallet.balance_usdc && (
                    <p className="text-[10px] text-error font-bold mt-1">⚠️ Exceeds available balance ({wallet.balance_usdc.toFixed(4)} USDC)</p>
                  )}
                </div>

                {withdrawError && (
                  <div className="flex items-start space-x-3 bg-error/10 border border-error/20 rounded-xl p-4">
                    <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />
                    <p className="text-xs text-error font-bold">{withdrawError}</p>
                  </div>
                )}

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-1">
                  <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest">Important</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed">Withdrawals are processed manually within 24 hours. Minimum: 10 USDC. Always double-check the address — transactions on blockchain are irreversible.</p>
                </div>

                <button onClick={handleWithdrawSubmit} disabled={withdrawSubmitting || !withdrawAmount || !withdrawAddress}
                  className="w-full py-5 bg-rose-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-rose-500/30 hover:scale-[1.02] transition-all disabled:opacity-40 flex items-center justify-center space-x-2">
                  <ArrowUpRight size={18} />
                  <span>{withdrawSubmitting ? 'Submitting...' : `Withdraw ${withdrawAmount || '0'} USDC → ${withdrawNetwork.name}`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Transactions Table ─────────────────────────────────────────────── */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20"><History size={24} className="text-primary" /></div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Transaction History</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">All activity · Real-time</p>
            </div>
          </div>
          <div className="flex bg-white/2 p-1.5 rounded-2xl border border-white/5">
            {['all', 'deposits', 'withdrawals'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === tab ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Type</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Amount</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Description</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length > 0 ? transactions.map((tx, i) => {
                  const isPositive = ['deposit', 'profit', 'reward', 'referral', 'cashback'].includes(tx.type);
                  return (
                    <motion.tr key={tx.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }} className="hover:bg-white/2 transition-all">
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-xl border ${isPositive ? 'bg-accent/10 text-accent border-accent/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {isPositive ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest text-white italic">{tx.type}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-lg font-black italic tracking-tighter ${isPositive ? 'text-accent' : 'text-slate-300'}`}>
                          {isPositive ? '+' : '-'}{tx.amount.toFixed(4)} <span className="text-[10px] font-normal text-slate-500">USDC</span>
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs text-slate-500 font-bold italic">{tx.description}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'completed' ? 'bg-accent' : tx.status === 'failed' ? 'bg-error' : 'bg-amber-500 animate-pulse'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${tx.status === 'completed' ? 'text-accent' : tx.status === 'failed' ? 'text-error' : 'text-amber-500'}`}>
                            {tx.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </td>
                    </motion.tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4 opacity-30">
                        <Database size={48} className="text-slate-500" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">No transactions yet</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Wallet;
