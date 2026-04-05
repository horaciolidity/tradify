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
import MarketTicker from '../components/MarketTicker';
import AnnouncementCarousel from '../components/AnnouncementCarousel';

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
      const { data: investments } = await supabase
        .from('investments')
        .select('amount, status')
        .eq('user_id', profile?.id);
      
      const totalInvested = investments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;
      const activeCount = investments?.filter(i => i.status === 'active').length || 0;

      const { data: referrals } = await supabase
        .from('referrals')
        .select('commission_earned')
        .eq('referrer_id', profile?.id);
      
      const totalRef = referrals?.reduce((acc, curr) => acc + Number(curr.commission_earned), 0) || 0;

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
      console.error('Core sync error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 pb-20 -mt-6">
      {/* Dynamic Market Ticker */}
      <div className="-mx-6 md:-mx-12 mb-6 md:mb-12">
        <div className="px-6 md:px-12 mb-3 md:mb-4">
          <div className="flex items-center space-x-3 text-primary">
            <TrendingUp size={14} className="text-primary animate-pulse" />
            <span className="terminal-label !text-primary/70">Real-time Market Updates //</span>
          </div>
        </div>
        <MarketTicker />
      </div>

      {/* Welcome Hero */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8">
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-center space-x-3 text-primary">
            <div className="w-8 md:w-10 h-[2px] bg-primary/30 rounded-full" />
            <span className="terminal-label !text-primary/70">Trading Dashboard //</span>
          </div>
          <h1 className="terminal-label !text-slate-500 flex items-center">
            <span className="w-6 h-[1px] bg-primary/30 mr-4" />
            WELCOME //  
            <span className="ml-3 text-white font-black tracking-[0.2em] text-[12px] md:text-[14px]">
              {profile?.full_name?.toUpperCase() || 'MEMBER'}
            </span>
            <span className="ml-4 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </h1>
          <p className="text-slate-500 font-bold italic tracking-wide flex items-center text-xs md:text-sm">
            <Zap size={14} className="text-accent mr-2" />
            Status: System Online & Protected
          </p>
        </div>
        
        <Link 
          to="/wallet" 
          className="glass-card flex items-center space-x-4 md:space-x-6 p-4 md:p-6 pr-6 md:pr-10 hover:border-primary/40 transition-all group relative overflow-hidden bg-white/2"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/20 rounded-xl md:rounded-[1.5rem] flex items-center justify-center text-primary group-hover:rotate-6 transition-all">
            <Wallet className="w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <p className="terminal-label mb-1">Available Balance //</p>
            <p className="text-xl md:text-4xl font-black text-white italic tracking-tighter">
              {(wallet?.balance_usdc || 0).toLocaleString()} <span className="terminal-label !text-slate-500 ml-2">USDC</span>
            </p>
          </div>
            <ChevronRight size={20} className="text-slate-800 ml-auto md:ml-4 group-hover:text-primary transition-all group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Announcement Segment */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        <AnnouncementCarousel />
      </div>

      {/* Stats Display */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
        {[
          { label: 'Deployed Margin', value: `$${stats.totalInvested.toLocaleString()}`, icon: TrendingUp, color: 'text-primary', delay: 0 },
          { label: 'Running Strategies', value: stats.activeInvestments, icon: Zap, color: 'text-accent', delay: 0.1 },
          { label: 'Referral Credits', value: `$${stats.totalReferralEarned.toLocaleString()}`, icon: Users, color: 'text-indigo-400', delay: 0.2 },
          { label: 'Security Status', value: '100%', icon: ShieldCheck, color: 'text-emerald-400', delay: 0.3 },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: stat.delay, duration: 0.4 }}
            className="glass-card p-5 md:p-10 relative overflow-hidden group hover:border-white/20 transition-all border-white/5 bg-white/2 md:bg-dark-lighter/30"
          >
            <div className={`absolute -top-10 -right-10 w-24 md:w-40 h-24 md:h-40 bg-current/5 blur-[40px] md:blur-[80px] rounded-full transition-all group-hover:bg-current/10 ${stat.color}`} />
            <div className={`p-2.5 md:p-4 bg-white/5 rounded-xl md:rounded-2xl w-fit mb-4 md:mb-8 border border-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-5 h-5 md:w-7 md:h-7" />
            </div>
            <p className="terminal-label mb-2">{stat.label} //</p>
            <h3 className="text-lg md:text-4xl font-black text-white tracking-tighter leading-none">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic flex items-center">
              <Clock size={24} className="text-primary mr-3" />
              Recent Transactions
            </h3>
            <Link to="/wallet" className="text-[10px] font-black text-primary hover:text-white transition-colors uppercase tracking-[0.3em] border-b border-primary/20 pb-1">View All Activity</Link>
          </div>
          
          <div className="glass-card overflow-hidden bg-white/2 border-white/5">
            {stats.recentTransactions.length > 0 ? (
              <div className="divide-y divide-white/5">
                {stats.recentTransactions.map((tx, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + (idx * 0.05) }}
                    key={tx.id} 
                    className="p-4 md:p-8 flex items-center justify-between hover:bg-white/5 transition-all group cursor-default"
                  >
                    <div className="flex items-center space-x-3 md:space-x-6">
                      <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all group-hover:rotate-12 ${
                        tx.type === 'deposit' || tx.type === 'profit' || tx.type === 'referral' 
                          ? 'bg-accent/10 text-accent border border-accent/20' 
                          : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      }`}>
                        {tx.type === 'deposit' || tx.type === 'profit' || tx.type === 'referral' ? <ArrowUpRight className="w-4 h-4 md:w-6 md:h-6" /> : <ArrowDownRight className="w-4 h-4 md:w-6 md:h-6" />}
                      </div>
                      <div>
                        <p className="text-[10px] md:text-sm font-black text-white uppercase tracking-widest italic">{tx.type}</p>
                        <p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-0.5 opacity-60">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm md:text-2xl font-black italic tracking-tighter ${
                        tx.type === 'deposit' || tx.type === 'profit' || tx.type === 'referral'
                          ? 'text-accent'
                          : 'text-white'
                      }`}>
                        {tx.type === 'deposit' || tx.type === 'profit' || tx.type === 'referral' ? '+' : '-'}{(tx.amount || 0).toLocaleString()} <span className="text-[7px] md:text-xs font-normal text-slate-500 not-italic ml-0.5">USDC</span>
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center space-y-6">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
                  <Clock size={40} className="text-slate-800" />
                </div>
                <div className="space-y-2">
                  <p className="text-white font-black uppercase tracking-widest italic">Stream Offline</p>
                  <p className="text-slate-500 font-medium italic text-xs max-w-xs mx-auto">Execute your first trading strategy to initiate the tracking sequence.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-10">
          <motion.div 
            whileHover={{ y: -5 }}
            className="glass-card p-10 bg-gradient-to-br from-primary/10 via-transparent to-transparent relative overflow-hidden group border-primary/20"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 blur-[60px] rounded-full -mr-20 -mt-20 group-hover:bg-primary/30 transition-all duration-700" />
            <div className="flex items-center space-x-3 mb-8">
              <ShieldCheck size={20} className="text-primary" />
              <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Platform Node Status</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Market Engine', active: true },
                { label: 'USDC Bridge', active: true },
                { label: 'Neural Models', active: true },
                { label: 'Referral Mesh', active: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-5 bg-white/2 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                  <span className="terminal-label">{item.label}</span>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse" />
                    <span className="terminal-label !text-accent">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <Link to="/investments" className="block p-10 glass-card bg-primary text-white relative overflow-hidden group text-center shadow-[0_20px_40px_rgba(243,186,47,0.3)] border-none">
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <Zap size={40} className="mx-auto mb-4 group-hover:scale-110 group-hover:rotate-12 transition-transform" />
            <span className="text-xs font-black uppercase tracking-[0.4em]">Get Started</span>
            <h4 className="text-3xl font-black italic tracking-tighter mt-1">NEW STRATEGY</h4>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
