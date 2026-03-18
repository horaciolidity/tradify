import React, { useState } from 'react';
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
                  Network: POLYGON (USDC)
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
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Smart Gateway v2.4</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <ShieldCheck size={20} className="text-rose-500" />
                    <h4 className="font-black text-white uppercase tracking-widest text-xs">Security Synchronization</h4>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed font-medium italic">
                    All deposits are automatically audited and swept to the Tradify Treasury master node. 
                    Your unique personal identifier must be active for instant credit.
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block ml-1">Master Treasury Address</label>
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-6 flex items-center justify-between group">
                      <span className="text-sm font-mono text-primary font-black tracking-tighter truncate mr-4">
                        {MASTER_ADDRESS}
                      </span>
                      <button 
                        onClick={() => copyText(MASTER_ADDRESS)}
                        className="shrink-0 p-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-all border border-primary/10"
                      >
                        {copied ? <Check size={20} /> : <Copy size={20} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 block ml-1">Your Personal Node Identifier</label>
                    <div className="bg-white/2 border border-white/5 rounded-2xl p-6 flex items-center justify-between group">
                      <span className="text-sm font-mono text-slate-300 font-bold truncate mr-4 italic">
                        {wallet?.address}
                      </span>
                      <div className="p-2 bg-white/5 rounded-lg">
                        <Check size={16} className="text-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-2xl p-6 border border-white/5">
                  <ol className="space-y-4">
                    {[
                      { step: 1, text: "Send USDC (Polygon Network) to the Master Treasury Address." },
                      { step: 2, text: "Wait for 3 Network Confirmations (Approx 1 minute)." },
                      { step: 3, text: "Protocol balance will reflect the deposit automatically." },
                    ].map((item) => (
                      <li key={item.step} className="flex items-start space-x-4">
                        <span className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary shrink-0 mt-0.5">{item.step}</span>
                        <p className="text-xs text-slate-400 font-bold italic">{item.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                <button 
                  onClick={() => setDepositModal(false)}
                  className="w-full primary-button py-5 text-xs font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/40"
                >
                  Confirm Instructions
                </button>
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
