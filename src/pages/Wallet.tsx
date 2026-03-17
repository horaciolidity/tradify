import React, { useState } from 'react';
import { motion } from 'framer-motion';
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
  QrCode
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import type { Transaction } from '../types';

const mockTransactions: Transaction[] = [
  { id: '1', user_id: '123', type: 'deposit', amount: 1000, status: 'completed', description: 'External Deposit', created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  { id: '2', user_id: '123', type: 'investment', amount: 500, status: 'completed', description: 'Plan 2 Investment', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { id: '3', user_id: '123', type: 'profit', amount: 45, status: 'completed', description: 'Plan 2 Interest Payout', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
];

const Wallet: React.FC = () => {
  const { wallet } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet?.address || 'T-Ox82...492');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Wallet Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 glass-card bg-gradient-to-br from-primary/30 to-indigo-900/30 p-8 flex flex-col justify-between min-h-[240px] relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:scale-175 transition-transform duration-700">
            <CreditCard size={150} />
          </div>
          
          <div className="relative z-10 flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-xs font-bold text-primary-dark bg-white/10 px-3 py-1 rounded-full uppercase tracking-widest border border-white/10 backdrop-blur-md">Internal Wallet</span>
              <p className="text-slate-400 font-medium">Available Balance</p>
              <h2 className="text-5xl font-bold text-white tracking-tighter">
                {wallet?.balance_usdc.toLocaleString() || '0.00'} <span className="text-2xl font-normal text-slate-400">USDC</span>
              </h2>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <Building2 className="text-white" />
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-4 mt-8">
            <button className="flex items-center space-x-2 bg-white text-dark font-bold px-6 py-3 rounded-xl hover:bg-slate-200 transition-colors shadow-lg shadow-white/10">
              <Plus size={20} />
              <span>Deposit</span>
            </button>
            <button className="flex items-center space-x-2 bg-white/10 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/20 transition-colors border border-white/5 backdrop-blur-lg">
              <ArrowUpRight size={20} />
              <span>Withdraw</span>
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-8 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Your Address</h3>
              <QrCode size={20} className="text-slate-500" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group">
              <span className="text-xs font-mono text-slate-400 break-all pr-4">
                {wallet?.address || 'Ox71C7656EC7ab88b098defB751B7401B5f6d8976F'}
              </span>
              <button 
                onClick={copyAddress}
                className="shrink-0 p-2 hover:bg-white/5 rounded-lg text-primary transition-colors"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
              This is your unique internal Tradify address. Use it for internal transfers and system deposits.
            </p>
          </div>

          <div className="pt-6 border-t border-white/5 mt-6">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500 font-bold uppercase tracking-wider">Network Status</span>
              <span className="text-accent flex items-center"><RefreshCcw size={12} className="mr-1 animate-spin-slow" /> Real-time Sync</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Transactions Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <History size={20} className="text-primary" />
            </div>
            <h3 className="text-xl font-bold text-white">Recent Transactions</h3>
          </div>
          
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            {['all', 'deposits', 'withdrawals'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Description</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {mockTransactions.map((tx, i) => {
                  const isPositive = ['deposit', 'profit', 'reward', 'referral'].includes(tx.type);
                  return (
                    <motion.tr 
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-white/5 transition-colors group cursor-default"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${isPositive ? 'bg-accent/10 text-accent' : 'bg-rose-500/10 text-rose-500'}`}>
                            {isPositive ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>
                          <span className="text-sm font-bold capitalize text-white">{tx.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold font-mono ${isPositive ? 'text-accent' : 'text-slate-400'}`}>
                          {isPositive ? '+' : '-'}{tx.amount.toLocaleString()} USDC
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-400 font-medium">{tx.description}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-accent/20 text-accent rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500 font-medium">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="w-full py-4 text-xs font-bold text-slate-500 hover:text-primary transition-colors bg-white/2 border-t border-white/5 uppercase tracking-widest">
            Load More History
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-900/10 border border-primary/20 rounded-2xl p-6 flex items-start space-x-4">
        <Info className="text-primary shrink-0 mt-1" />
        <div>
          <h4 className="font-bold text-white mb-1">Blockchain Integration Pending</h4>
          <p className="text-sm text-slate-400 leading-relaxed">
            We are currently in a hybrid simulation phase. All internal transactions are instant and secured via Supabase. Web3 integration with Metamask for real USDC deposits/withdrawals is coming in the next update.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
