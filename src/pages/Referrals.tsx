import React from 'react';
import { motion } from 'framer-motion';
import { Users, Link as LinkIcon, Gift, TrendingUp, Copy, Check, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const Referrals: React.FC = () => {
  const { profile } = useAuthStore();
  const [copied, setCopied] = React.useState(false);

  const copyRef = () => {
    navigator.clipboard.writeText(`https://tradify.io/register?ref=${profile?.referral_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Referral Program</h1>
        <p className="text-slate-400 mt-1">Invite friends and earn up to 5% commission on their investments.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 glass-card p-8 bg-gradient-to-br from-primary/20 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-6"
        >
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Share your link</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Earn passive income from your network. Get commissions from 3 levels: 5%, 3%, and 1% of every investment made by your referrals.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group">
              <span className="text-xs font-mono text-primary font-bold">
                TRADIFY.IO/REF?ID={profile?.referral_code || 'DEMO-123'}
              </span>
              <button 
                onClick={copyRef}
                className="shrink-0 p-2 hover:bg-white/5 rounded-lg text-white transition-colors flex items-center space-x-2"
              >
                {copied ? <Check size={18} className="text-accent" /> : <Copy size={18} />}
                <span className="text-xs font-bold uppercase">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
          <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex flex-col items-center shrink-0">
            <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <Gift size={32} className="text-primary" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rewards Earned</p>
            <p className="text-2xl font-black text-white">450.00 <span className="text-xs font-normal text-slate-500">USDC</span></p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-8 space-y-6"
        >
          <h3 className="font-bold text-white">Program Stats</h3>
          <div className="space-y-4">
            {[
              { label: 'Total Referrals', value: '24', icon: UserPlus },
              { label: 'Active Investors', value: '18', icon: TrendingUp },
              { label: 'Pending Payout', value: '12.50 USDC', icon: Gift },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <div className="flex items-center space-x-3 text-slate-400">
                  <stat.icon size={18} />
                  <span className="text-sm font-medium">{stat.label}</span>
                </div>
                <span className="text-sm font-bold text-white">{stat.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-bold text-white">Recent Referrals</h3>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Page 1 of 3</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/2">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Level</th>
                <th className="px-6 py-4">Commission</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { user: 'alex***@gmail.com', level: '1 (5%)', comm: '25.50 USDC', status: 'Received', date: '2024-03-15' },
                { user: 'marta***@gmail.com', level: '2 (3%)', comm: '12.00 USDC', status: 'Received', date: '2024-03-14' },
                { user: 'kevin***@gmail.com', level: '1 (5%)', comm: '150.00 USDC', status: 'Pending', date: '2024-03-14' },
                { user: 'luna***@gmail.com', level: '3 (1%)', comm: '4.20 USDC', status: 'Received', date: '2024-03-12' },
              ].map((ref, i) => (
                <tr key={i} className="text-sm text-slate-300 hover:bg-white/2 transition-colors">
                  <td className="px-6 py-4 font-medium">{ref.user}</td>
                  <td className="px-6 py-4">{ref.level}</td>
                  <td className="px-6 py-4 font-bold text-white">{ref.comm}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ref.status === 'Received' ? 'bg-accent/20 text-accent' : 'bg-amber-500/20 text-amber-500'}`}>
                      {ref.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono">{ref.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Referrals;
