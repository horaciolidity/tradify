import React from 'react';
import { motion } from 'framer-motion';
import { Users, Link as LinkIcon, Gift, TrendingUp, Copy, Check, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

import { supabase } from '../services/supabase';

const Referrals: React.FC = () => {
  const { profile } = useAuthStore();
  const [copied, setCopied] = React.useState(false);
  const [commissions, setCommissions] = React.useState({ level1: 5, level2: 3, level3: 1 });
  const [referrals, setReferrals] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState({ total: 0, active: 0, rewards: 0 });

  React.useEffect(() => {
    if (profile) {
      fetchReferralData();
      fetchCommissions();
    }
  }, [profile]);

  const fetchCommissions = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'referral_commissions')
      .single();
    
    if (data?.value) {
      setCommissions(data.value);
    }
  };

  const fetchReferralData = async () => {
    // 1. Get commissions (from the referrals table)
    const { data: commissionsData, error: commError } = await supabase
      .from('referrals')
      .select('*, referred:profiles!referred_id(email, full_name)')
      .eq('referrer_id', profile?.id);

    // 2. Get registered users (from the profiles table)
    const { data: networkData, error: networkError } = await supabase
      .from('profiles')
      .select('email, created_at, id')
      .eq('referred_by', profile?.id);

    if (!commError && !networkError && networkData) {
      const totalEarned = (commissionsData || []).reduce((acc: number, curr: any) => acc + (curr.commission_earned || 0), 0);
      
      // Combine info: If a profile is in the commissions list, mark as active
      const processedNetwork = networkData.map(user => {
        const commsForUser = (commissionsData || []).filter(c => c.referred_id === user.id);
        const earnedFromUser = commsForUser.reduce((acc, c) => acc + (c.commission_earned || 0), 0);
        return {
          ...user,
          total_earned: earnedFromUser,
          status: earnedFromUser > 0 ? 'Active Investor' : 'Registered',
          is_active: earnedFromUser > 0
        };
      });

      setReferrals(processedNetwork);
      setStats({
        total: networkData.length,
        active: processedNetwork.filter(u => u.is_active).length,
        rewards: totalEarned
      });
    }
  };

  const copyRef = () => {
    const url = `${window.location.origin}/register?ref=${profile?.referral_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 text-slate-200">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Referral Nexus</h1>
        <p className="text-[10px] md:text-xs text-slate-500 mt-1.5 font-medium">Expand the Tradify network and harvest passive generational rewards.</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 glass-card p-10 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent relative overflow-hidden group border-white/10"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -mr-32 -mt-32 rounded-full group-hover:bg-primary/20 transition-all duration-700" />
          
          <div className="relative z-10 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">Your Neural Gateway</h3>
                <p className="text-[10px] md:text-xs text-slate-500 mt-2 max-w-xl leading-relaxed font-medium">
                  Invite your friends to the Tradify ecosystem and earn continuous passive rewards from every protocol activation they start.
                </p>
              </div>
              <div className="bg-white/5 p-4 md:p-6 rounded-2xl border border-white/10 flex flex-col items-center shrink-0">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-3 border border-primary/20 shadow-lg shadow-primary/10">
                  <Gift size={24} className="text-primary" />
                </div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 leading-none">Total Harvested</p>
                <p className="text-xl md:text-2xl font-black text-white tracking-tighter leading-none">{stats.rewards.toFixed(2)} <span className="text-[10px] font-normal text-slate-600 ml-1">USDC</span></p>
              </div>
            </div>

            {/* Referral Link */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] italic">Unique Access Protocol</p>
              <div className="bg-black/60 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-xl group/link active:scale-[0.98] transition-all">
                <span className="text-sm font-black text-primary font-mono tracking-widest break-all select-all">
                  {window.location.origin}/JOIN?REF={profile?.referral_code || 'TRADIFY-X'}
                </span>
                <button 
                  onClick={copyRef}
                  className="w-full md:w-auto px-8 py-4 bg-primary text-black rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-primary/20 active:scale-95"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* 3-Level Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { level: 'Level 1', rate: commissions.level1, sub: 'Direct Partners', desc: 'People who join via your link' },
                { level: 'Level 2', rate: commissions.level2, sub: 'Secondary Flow', desc: 'Invited by your Level 1 partners' },
                { level: 'Level 3', rate: commissions.level3, sub: 'Global Reach', desc: 'Invited by your Level 2 partners' },
              ].map((tier, i) => (
                <div key={i} className="bg-white/3 border border-white/5 rounded-2xl p-5 hover:bg-white/5 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{tier.level}</span>
                    <span className="text-base font-black text-primary">{tier.rate}%</span>
                  </div>
                  <h4 className="text-white font-black text-[11px] mb-1 uppercase tracking-tighter">{tier.sub}</h4>
                  <p className="text-[9px] text-slate-600 leading-relaxed font-medium">{tier.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-8 bg-black/40 border-white/5 h-fit"
          >
            <h3 className="text-sm font-black text-white uppercase italic mb-6 flex items-center justify-between">
              <span>Program Insights</span>
              <TrendingUp size={16} className="text-primary" />
            </h3>
            <div className="space-y-6">
              {[
                { label: 'Total Referrals', value: stats.total.toString(), icon: UserPlus, color: 'text-primary' },
                { label: 'Active Investors', value: stats.active.toString(), icon: TrendingUp, color: 'text-accent' },
                { label: 'Total Commissions', value: `${stats.rewards.toFixed(2)} USDC`, icon: Gift, color: 'text-primary' },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center space-x-3 text-slate-400">
                    <div className={`p-2 bg-white/5 rounded-lg ${stat.color}`}>
                      <stat.icon size={16} />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <span className="text-xs font-black text-white">{stat.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* New Success Steps */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-8 bg-gradient-to-r from-accent/10 to-transparent border-accent/20"
          >
            <h3 className="text-[10px] font-black text-accent uppercase tracking-[0.3em] mb-6 flex items-center">
              <Gift size={14} className="mr-2" /> Expansion Guide
            </h3>
            <div className="space-y-4">
              {[
                { step: '01', title: 'Share Link', desc: 'Promote your access key.' },
                { step: '02', title: 'Onboard Partners', desc: 'Friends initiate protocol.' },
                { step: '03', title: 'Harvest 24/7', desc: 'Earn USDC on every cycle.' },
              ].map((s, i) => (
                <div key={i} className="flex items-start space-x-4">
                   <div className="text-lg font-black text-white opacity-20 italic">{s.step}</div>
                   <div>
                     <p className="text-xs font-black text-white uppercase tracking-tighter">{s.title}</p>
                     <p className="text-[10px] text-slate-500">{s.desc}</p>
                   </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
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
              <tr className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/2">
                <th className="px-6 py-4">Network Entity</th>
                <th className="px-6 py-4">Operational Status</th>
                <th className="px-6 py-4">Yield Harvested</th>
                <th className="px-6 py-4">Node Status</th>
                <th className="px-6 py-4">Genesis Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {referrals.map((ref, i) => (
                <tr key={i} className="text-sm text-slate-300 hover:bg-white/2 transition-colors">
                  <td className="px-6 py-4 font-medium italic break-all">
                    {ref.email?.split('@')[0]}***@{ref.email?.split('@')[1]}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${ref.is_active ? 'bg-accent/10 text-accent border-accent/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                      {ref.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black italic text-white tracking-widest">
                    {ref.total_earned.toFixed(2)} USDC
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border ${ref.is_active ? 'bg-primary/20 text-primary border-primary/20 shadow-[0_0_10px_rgba(252,186,44,0.1)]' : 'bg-white/5 text-slate-600 border-white/5'}`}>
                      {ref.is_active ? 'Verified' : 'Pending Node'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-[10px] italic">{new Date(ref.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic">No referrals found yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
};

export default Referrals;
