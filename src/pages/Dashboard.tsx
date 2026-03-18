import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Wallet, 
  TrendingUp, 
  Users, 
  Zap, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  ChevronRight,
  ShieldCheck,
  LayoutDashboard
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { profile, wallet } = useAuthStore();
  const [stats, setStats] = useState({
    totalInvested: 0,
    activeInvestments: 0,
    totalReferralEarned: 0,
    recentTransactions: [] as any[]
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Investment Stats
      const { data: investments } = await supabase
        .from('investments')
        .select('amount, status')
        .eq('user_id', profile?.id);
      
      const totalInvested = investments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const activeCount = investments?.filter(i => i.status === 'active').length || 0;

      // 2. Fetch Referral Stats
      const { data: referrals } = await supabase
        .from('referrals')
        .select('commission_earned')
        .eq('referrer_id', profile?.id);
      
      const totalRef = referrals?.reduce((acc, curr) => acc + Number(curr.commission_earned), 0) || 0;

      // 3. Fetch Recent Transactions
      const { data: txs } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalInvested,
        activeInvestments: activeCount,
        totalReferralEarned: totalRef,
        recentTransactions: txs || []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 pb-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 text-primary mb-2">
            <LayoutDashboard size={18} />
            <span className="text-xs font-black uppercase tracking-[0.2em] italic">Member Portal</span>
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">
            Welcome, <span className="text-primary">{profile?.full_name?.split(' ')[0] || 'Trader'}</span>
          </h1>
          <p className="text-slate-500 mt-1 font-medium italic">Your crypto empire at a glance.</p>
        </div>
        
        <Link 
          to="/wallet" 
          className="glass-card flex items-center space-x-4 p-4 pr-6 bg-gradient-to-br from-primary/10 to-transparent hover:border-primary/50 transition-all group"
        >
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available Balance</p>
            <p className="text-2xl font-black text-white italic tracking-tighter">
              {wallet?.balance_usdc.toLocaleString() || '0.00'} <span className="text-xs font-normal text-slate-500">USDC</span>
            </p>
          </div>
          <ChevronRight size={20} className="text-slate-700 ml-4 group-hover:text-primary transition-colors" />
        </Link>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Invested', value: `$${stats.totalInvested.toLocaleString()}`, icon: TrendingUp, color: 'text-primary' },
          { label: 'Active Plans', value: stats.activeInvestments, icon: Zap, color: 'text-accent' },
          { label: 'Network Rewards', value: `$${stats.totalReferralEarned.toLocaleString()}`, icon: Users, color: 'text-indigo-400' },
          { label: 'Safety Score', value: '98%', icon: ShieldCheck, color: 'text-emerald-400' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 relative overflow-hidden group hover:border-white/20 transition-all"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 bg-current/5 blur-[40px] rounded-full -mr-12 -mt-12 transition-all group-hover:bg-current/10 ${stat.color}`} />
            <div className={`p-3 bg-white/2 rounded-2xl w-fit mb-6 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
            <h3 className="text-3xl font-black text-white italic tracking-tighter">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Recent Activity</h3>
            <Link to="/wallet" className="text-xs font-black text-primary hover:text-white transition-colors uppercase tracking-widest">Full Log</Link>
          </div>
          
          <div className="glass-card overflow-hidden">
            {stats.recentTransactions.length > 0 ? (
              <div className="divide-y divide-white/5">
                {stats.recentTransactions.map((tx) => (
                  <div key={tx.id} className="p-5 flex items-center justify-between hover:bg-white/2 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        tx.type === 'deposit' || tx.type === 'profit' || tx.type === 'referral' 
                          ? 'bg-accent/10 text-accent' 
                          : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {tx.type === 'deposit' || tx.type === 'profit' || tx.type === 'referral' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-wide">{tx.type}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
                          {new Date(tx.created_at).toLocaleDateString()} • {tx.description?.slice(0, 30)}...
                        </p>
                      </div>
                    </div>
                    <p className={`text-lg font-black italic tracking-tighter ${
                      tx.type === 'deposit' || tx.type === 'profit' || tx.type === 'referral'
                        ? 'text-accent'
                        : 'text-white'
                    }`}>
                      {tx.type === 'deposit' || tx.type === 'profit' || tx.type === 'referral' ? '+' : '-'}{tx.amount.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">USDC</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center space-y-4">
                <Clock size={40} className="mx-auto text-slate-800" />
                <p className="text-slate-500 font-medium italic">No recent protocols found. Execute your first investment to start tracking.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links / Status */}
        <div className="space-y-8">
          <div className="glass-card p-8 bg-gradient-to-br from-indigo-500/5 to-transparent relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-all duration-700" />
            <h3 className="text-lg font-black text-white mb-6 uppercase tracking-tighter italic">Platform Status</h3>
            <div className="space-y-4">
              {[
                { label: 'Exchange Protocol', active: true },
                { label: 'Investment Gateway', active: true },
                { label: 'Withdrawal Port', active: true },
                { label: 'Referral Engine', active: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.label}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--color-accent),0.5)] animate-pulse" />
                    <span className="text-[10px] font-black text-accent uppercase tracking-widest">Active</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/investments" className="mt-8 block w-full primary-button py-4 text-[10px] font-black uppercase tracking-[0.2em] text-center shadow-2xl shadow-primary/30">
              New Investment Plan
            </Link>
          </div>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="glass-card p-8 border-primary/20 bg-primary/5 cursor-pointer relative group"
          >
            <div className="flex items-center justify-between mb-4">
              <TrendingUp size={24} className="text-primary group-hover:scale-110 transition-transform" />
              <ArrowUpRight size={20} className="text-slate-700 group-hover:text-primary" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">Market Pulse</h3>
            <p className="text-xs text-slate-400 mt-2 font-medium">BTC is currently up 2.4% in the last 24h. Perfect conditions for T-Series plans.</p>
            <Link to="/trading" className="absolute inset-0" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
