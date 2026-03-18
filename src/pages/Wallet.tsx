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
  Database
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import type { Transaction } from '../types';
import { supabase } from '../services/supabase';

const Wallet: React.FC = () => {
  const { wallet, profile } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [depositModal, setDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const MASTER_ADDRESS = '0xBAeaDE80A2A1064E4F8f372cd2ADA9a00daB4BBE';

  React.useEffect(() => {
    if (profile) fetchTransactions();
  }, [profile, activeTab]);

  const fetchTransactions = async () => {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', profile?.id)
      .order('created_at', { ascending: false });

    if (activeTab === 'deposits') query = query.eq('type', 'deposit');
    if (activeTab === 'withdrawals') query = query.eq('type', 'withdrawal');

    const { data, error } = await query;
    if (!error && data) setTransactions(data);
  };

  const [depositTab, setDepositTab] = useState<'manual' | 'web3'>('manual');
  const [isWeb3Loading, setIsWeb3Loading] = useState(false);

  const handleWeb3Deposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (!window.ethereum) {
      alert('Metamask not detected. Please install it or use Manual Signal.');
      return;
    }

    setIsWeb3Loading(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const userAddress = accounts[0];

      // Simple transfer of Native (BNB/POL/ETH) or we could do ERC20. 
      // For simplicity in this demo, we'll request a generic transaction or just show the flow.
      // Real USDC transfer would require ABI and Contract Address.
      
      const transactionParameters = {
        to: MASTER_ADDRESS,
        from: userAddress,
        value: '0x0', // 0 if sending token
        // In a real app, we'd add 'data' for the transfer(to, amount) call
      };

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      });

      if (txHash) {
        setTxHash(txHash);
        // Automatically submit to our backend
        const { error } = await supabase.from('transactions').insert({
          user_id: profile?.id,
          type: 'deposit',
          amount: parseFloat(depositAmount),
          description: `Web3 Neural Transmit (${window.ethereum.networkVersion === '56' ? 'BSC' : 'Polygon'})`,
          status: 'pending',
          tx_hash: txHash
        });
        
        if (error) throw error;
        
        alert('Web3 Transaction Detected & Synced! Waiting for protocol confirmation.');
        setDepositModal(false);
        fetchTransactions();
      }
    } catch (err) {
      console.error(err);
      alert('Web3 Transmission Failed or Cancelled.');
    } finally {
      setIsWeb3Loading(false);
    }
  };

  const handleDepositSubmit = async () => {
    if (!depositAmount || !txHash || !profile) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'deposit',
        amount: parseFloat(depositAmount),
        description: `Manual Protocol Signal`,
        status: 'pending',
        tx_hash: txHash
      });

      if (error) throw error;

      alert('Deposit signal transmitted. Waiting for admin review.');
      setDepositModal(false);
      setDepositAmount('');
      setTxHash('');
      fetchTransactions();
    } catch (err) {
      alert('Failed to transmit deposit signal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-10 pb-10">
      {/* Wallet Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Active Protocol Node</span>
              </div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Synchronized Balance</p>
              <h2 className="text-6xl font-black text-white tracking-tighter italic">
                {wallet?.balance_usdc.toLocaleString() || '0.00'} <span className="text-2xl font-normal text-slate-500 not-italic">USDC</span>
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
              <span>Deposit</span>
            </button>
            <button className="flex items-center space-x-3 bg-white/5 text-white font-black px-8 py-4 rounded-2xl hover:bg-white/10 transition-all border border-white/10 backdrop-blur-xl uppercase tracking-widest text-xs">
              <ArrowUpRight size={20} />
              <span>Withdraw</span>
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-10 flex flex-col justify-between border-white/10 relative overflow-hidden"
        >
          <div className="absolute bottom-0 right-0 p-8 opacity-5">
            <QrCode size={120} />
          </div>
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white uppercase tracking-tighter italic text-xl">Deposit ID</h3>
              <QrCode size={24} className="text-primary" />
            </div>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 group/addr relative overflow-hidden backdrop-blur-md">
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/addr:opacity-100 transition-opacity" />
              <span className="text-xs font-mono text-slate-400 break-all text-center leading-relaxed font-bold tracking-tighter">
                {wallet?.address || '0x...'}
              </span>
              <button 
                onClick={() => copyText(wallet?.address || '')}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-white/5 hover:bg-primary/20 hover:text-primary rounded-xl text-slate-500 transition-all border border-white/5"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span className="text-[10px] font-black uppercase tracking-widest">{copied ? 'Copied' : 'Copy Address'}</span>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-wide">
                  This is your unique internal Tradify identifier. 
                </p>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <p className="text-[10px] text-slate-500 leading-relaxed font-bold uppercase tracking-wide">
                  Network: POLYGON / BSC (USDC)
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Deposit Modal */}
      <AnimatePresence>
        {depositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDepositModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="glass-card w-full max-w-xl p-10 relative z-10 border-white/10 bg-gradient-to-br from-dark-lighter to-transparent"
            >
              <button 
                onClick={() => setDepositModal(false)}
                className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
              >
                <X size={28} />
              </button>

              <div className="flex items-center space-x-4 mb-8">
                <div className="w-16 h-16 bg-primary/20 rounded-3xl flex items-center justify-center text-primary border border-primary/20">
                  <ArrowDownLeft size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Protocol Deposit</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Gateway Engine v3.0</p>
                </div>
              </div>

              <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 mb-8">
                <button 
                  onClick={() => setDepositTab('manual')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${depositTab === 'manual' ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'text-slate-500'}`}
                >
                  Manual Signal
                </button>
                <button 
                  onClick={() => setDepositTab('web3')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${depositTab === 'web3' ? 'bg-accent/20 text-accent border border-accent/20' : 'text-slate-500'}`}
                >
                  Web3 Transmit
                </button>
              </div>

              <div className="space-y-8">
                {depositTab === 'manual' ? (
                  <>
                    <div className="bg-primary/5 rounded-2xl p-6 border border-white/5">
                      <ol className="space-y-4">
                        {[
                          { step: 1, text: "Send USDC (Polygon/BSC) to the Master Treasury Address." },
                          { step: 2, text: "Copy the Transaction Hash (TXID) from your wallet." },
                          { step: 3, text: "Paste the Hash below and enter the amount." },
                        ].map((item) => (
                          <li key={item.step} className="flex items-start space-x-4">
                            <span className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary shrink-0 mt-0.5">{item.step}</span>
                            <p className="text-xs text-slate-400 font-bold italic">{item.text}</p>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Master Treasury Address</label>
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group">
                          <span className="text-xs font-mono text-primary font-black truncate mr-4">{MASTER_ADDRESS}</span>
                          <button onClick={() => copyText(MASTER_ADDRESS)} className="p-2 bg-primary/10 text-primary rounded-lg"><Copy size={16} /></button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount</label>
                          <input 
                            type="number"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-black italic focus:border-primary/50 transition-all outline-none"
                          />
                        </div>
                        <div className="space-y-2 text-right">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-1">Network</label>
                          <div className="w-full bg-white/2 border border-white/5 rounded-2xl p-4 text-slate-400 font-black italic flex items-center justify-center space-x-2 uppercase">
                            <span className="text-emerald-500">USDC</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Protocol Hash (TXID)</label>
                        <input 
                          type="text"
                          value={txHash}
                          onChange={(e) => setTxHash(e.target.value)}
                          placeholder="0x..."
                          className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-mono text-xs focus:border-primary/50 transition-all outline-none"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleDepositSubmit}
                      disabled={isSubmitting || !depositAmount || !txHash}
                      className="w-full primary-button py-5 text-xs font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/40"
                    >
                      {isSubmitting ? 'Syncing...' : 'Confirm External Signal'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-8 py-4">
                    <div className="p-8 bg-accent/5 border border-accent/20 rounded-3xl text-center">
                      <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center text-accent mx-auto mb-6 shadow-2xl shadow-accent/10">
                        <ShieldCheck size={40} />
                      </div>
                      <h4 className="text-xl font-black text-white uppercase italic mb-3">Direct Web3 Bridge</h4>
                      <p className="text-slate-400 text-xs font-medium italic leading-relaxed">
                        Securely connect your Metamask wallet and transmit USDC directly to the protocol. 
                        Works on BSC and Polygon networks.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amount to Transmit (USDC)</label>
                      <input 
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-3xl font-black italic text-primary focus:border-primary/50 transition-all outline-none text-center"
                      />
                    </div>

                    <button 
                      onClick={handleWeb3Deposit}
                      disabled={isWeb3Loading || !depositAmount}
                      className="w-full py-6 bg-accent text-dark font-black text-xs uppercase tracking-[0.3em] rounded-3xl shadow-2xl shadow-accent/40 hover:scale-[1.02] transition-all flex items-center justify-center space-x-3"
                    >
                      {isWeb3Loading ? (
                        <RefreshCcw size={20} className="animate-spin" />
                      ) : (
                        <>
                          <Plus size={20} />
                          <span>Transmit via Metamask</span>
                        </>
                      )}
                    </button>
                    
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">
                      Funds are sent directly to the Admin Master Address
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Transactions Section */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
              <History size={24} className="text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">Ledger History</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Protocol Sync: Active</p>
            </div>
          </div>
          
          <div className="flex bg-white/2 p-1.5 rounded-2xl border border-white/5 backdrop-blur-xl">
            {['all', 'deposits', 'withdrawals'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === tab ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden border-white/5 bg-gradient-to-br from-white/2 to-transparent">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Transaction Protocol</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Asset Volume</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Hash / Description</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">System Status</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length > 0 ? transactions.map((tx, i) => {
                  const isPositive = ['deposit', 'profit', 'reward', 'referral', 'cashback'].includes(tx.type);
                  return (
                    <motion.tr 
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-white/2 transition-all group cursor-default"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-xl border ${isPositive ? 'bg-accent/10 text-accent border-accent/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {isPositive ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                          </div>
                          <div>
                            <span className="text-xs font-black uppercase tracking-widest text-white italic">{tx.type}</span>
                            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Network Confirmed</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`text-xl font-black italic tracking-tighter ${isPositive ? 'text-accent' : 'text-slate-300'}`}>
                          {isPositive ? '+' : '-'}{tx.amount.toLocaleString()} <span className="text-[10px] font-normal text-slate-500 not-italic">USDC</span>
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs text-slate-500 font-bold italic tracking-tight">{tx.description}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'completed' ? 'bg-accent' : 'bg-amber-500'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${tx.status === 'completed' ? 'text-accent' : 'text-amber-500'}`}>
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
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">No protocol entries found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {transactions.length > 5 && (
            <button className="w-full py-6 text-[10px] font-black text-slate-600 hover:text-primary transition-all bg-white/2 border-t border-white/5 uppercase tracking-[0.3em] italic">
              Access Full Archive History
            </button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <motion.div 
        whileHover={{ scale: 1.01 }}
        className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8 relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary shrink-0 group-hover:rotate-12 transition-transform shadow-2xl shadow-primary/10">
          <Info size={40} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter italic">Neural Net Protocol Integration</h4>
          <p className="text-sm text-slate-400 leading-relaxed font-medium italic opacity-70">
            We are currently in Phase 2: Hybrid Simulation. All internal neural transactions are executed instantly via the Tradify Core. 
            Direct Polygon Layer-2 Bridge integration is being calibrated for the next synchronization cycle.
          </p>
        </div>
        <button className="px-8 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all">
          Learn More
        </button>
      </motion.div>
    </div>
  );
};

export default Wallet;
