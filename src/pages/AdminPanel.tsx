import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Settings, 
  Database, 
  TrendingUp, 
  Activity, 
  ShieldAlert,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Search,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

import { supabase } from '../services/supabase';

const AdminPanel: React.FC = () => {
  const { profile } = useAuthStore();
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'plans' | 'tokens' | 'settings'>('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([
    { label: 'Total Users', value: '0', icon: Users, change: '0' },
    { label: 'Total Deposits', value: '$0', icon: Database, change: '0' },
    { label: 'Active Investments', value: '0', icon: Activity, change: '0' },
    { label: 'Liquidity Pool', value: '$500,000', icon: ShieldAlert, change: 'Stable' },
  ]);

  React.useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAdminData();
      fetchSystemSettings();
    }
  }, [profile]);

  const fetchSystemSettings = async () => {
    const { data } = await supabase.from('admin_settings').select('*');
    if (data) {
      const settingsMap = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
      setSystemSettings(settingsMap);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    const { error } = await supabase
      .from('admin_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() });
    
    if (!error) {
      setSystemSettings({ ...systemSettings, [key]: value });
      alert('Settings updated successfully');
    }
  };

  const toggleGate = async (gateName: string) => {
    const currentGates = systemSettings.system_gates || {};
    const updatedGates = { ...currentGates, [gateName]: !currentGates[gateName] };
    await updateSetting('system_gates', updatedGates);
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const { data: userData } = await supabase
        .from('profiles')
        .select('*, wallets(balance_usdc)');
      
      if (userData) {
        setUsers(userData);
        
        // 2. Fetch Global Stats
        const totalUsers = userData.length;
        const totalDeposits = userData.reduce((acc, curr: any) => acc + (curr.wallets?.[0]?.balance_usdc || 0), 0);
        
        const { count: activeInvs } = await supabase
          .from('investments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        // Get guaranteed pool from settings or use a fallback
        const poolReserve = systemSettings.pool_guaranteed?.amount || totalDeposits;

        setStats([
          { label: 'Network Total Users', value: totalUsers.toString(), icon: Users, change: '+2.4%' },
          { label: 'Global Liquidity', value: `$${totalDeposits.toLocaleString()}`, icon: Database, change: '+12.5%' },
          { label: 'Active Smart Plans', value: (activeInvs || 0).toString(), icon: Activity, change: '+5.2%' },
          { label: 'Protocol Reserve', value: `$${poolReserve.toLocaleString()}`, icon: ShieldAlert, change: 'Stable' },
        ]);
      }
    } catch (error) {
      console.error('Admin data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-card text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-rose-500/5 animate-pulse" />
        <ShieldAlert size={80} className="text-rose-500 mb-8 animate-bounce relative z-10" />
        <h2 className="text-4xl font-black text-white uppercase tracking-tighter italic relative z-10">Restricted Access</h2>
        <p className="text-slate-500 mt-6 max-w-lg font-medium italic relative z-10 text-lg">
          Attention: You have attempted to access the protocol's master core. Unauthorized access is strictly prohibited and monitored by Tradify Security.
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          className="mt-10 px-10 py-4 bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-rose-500 hover:text-white transition-all relative z-10"
        >
          Return to Safety
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div>
          <div className="flex items-center space-x-2 text-primary mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">System Core Connected</span>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
            Control <span className="text-primary">Center</span>
          </h1>
          <p className="text-slate-500 mt-2 font-medium italic text-sm">Advanced neural terminal for Tradify platform orchestration.</p>
        </div>
        <div className="flex bg-white/2 p-2 rounded-3xl border border-white/5 backdrop-blur-xl">
          <button className="flex items-center space-x-3 px-6 py-3 hover:bg-white/5 rounded-2xl text-slate-400 group transition-all">
            <Database size={18} className="group-hover:text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-white">Backups</span>
          </button>
          <div className="w-px h-10 bg-white/5 mx-1" />
          <button className="flex items-center space-x-3 px-6 py-3 hover:bg-white/5 rounded-2xl text-slate-400 group transition-all">
            <Settings size={18} className="group-hover:text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-white">API Keys</span>
          </button>
        </div>
      </div>

      {/* Admin Nav */}
      <div className="flex space-x-10 border-b border-white/5 overflow-x-auto pb-px scrollbar-hide">
        {[
          { id: 'overview', label: 'Telemetry', icon: Activity },
          { id: 'users', label: 'Entities', icon: Users },
          { id: 'plans', label: 'Protocols', icon: TrendingUp },
          { id: 'tokens', label: 'Market Assets', icon: Database },
          { id: 'settings', label: 'System Gates', icon: ShieldAlert },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id as any)}
            className={`flex items-center space-x-3 pb-6 px-1 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeSection === item.id ? 'text-primary' : 'text-slate-600 hover:text-slate-300'}`}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
            {activeSection === item.id && (
              <motion.div layoutId="admin-nav" className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary rounded-t-2xl shadow-[0_-4px_20px_rgba(var(--color-primary),0.6)]" />
            )}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <div className="space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-8 group hover:border-primary/40 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-primary/10 transition-all duration-700" />
                <div className="flex items-center justify-between mb-8">
                  <div className="p-4 bg-primary/10 rounded-[2rem] text-primary group-hover:scale-110 group-hover:rotate-6 transition-transform shadow-xl shadow-primary/5">
                    <stat.icon size={28} />
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-accent/10 text-accent' : 'bg-white/5 text-slate-500'}`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">{stat.label}</p>
                <h3 className="text-4xl font-black text-white tracking-tighter italic">{stat.value}</h3>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="glass-card p-10 bg-gradient-to-br from-primary/5 to-transparent">
              <h3 className="text-xl font-black text-white mb-10 flex items-center uppercase tracking-tighter italic">
                <ShieldAlert size={24} className="mr-4 text-primary" />
                System Core Gates
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { key: 'reg_gate', name: 'User Registrations' },
                  { key: 'deposit_gate', name: 'USDC Deposits' },
                  { key: 'withdraw_gate', name: 'Withdrawals' },
                  { key: 'yield_gate', name: 'Yield Distribution' },
                  { key: 'asset_gate', name: 'Asset Creation' },
                  { key: 'ref_gate', name: 'Referral Engine' },
                ].map((item) => {
                  const isActive = (systemSettings.system_gates || {})[item.key] !== false;
                  return (
                    <div key={item.key} className="flex items-center justify-between p-5 bg-white/2 rounded-3xl border border-white/5 hover:bg-white/5 transition-colors group">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-white transition-colors">{item.name}</span>
                      <button 
                        onClick={() => toggleGate(item.key)}
                        className={`${isActive ? 'text-accent shadow-[0_0_15px_rgba(var(--color-accent),0.3)]' : 'text-slate-800'} transition-all hover:scale-110 active:scale-95`}
                      >
                        {isActive ? <ToggleRight size={44} /> : <ToggleLeft size={44} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-card p-8 bg-gradient-to-br from-indigo-500/5 to-transparent">
              <h3 className="text-lg font-black text-white mb-8 uppercase tracking-tighter italic">Neural Alert Stream</h3>
              <div className="space-y-4">
                {[
                  { msg: 'Security firewall intercepted suspicious request', type: 'warning', time: '1m ago' },
                  { msg: 'System wide liquidity re-balanced', type: 'success', time: '45m ago' },
                  { msg: 'New admin role assigned to car@trade.com', type: 'info', time: '2h ago' },
                  { msg: 'Daily tasks verified for 1,240 users', type: 'success', time: '4h ago' },
                ].map((alert, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 rounded-2xl bg-white/2 border border-white/5">
                    <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentcolor] ${alert.type === 'warning' ? 'bg-amber-500' : alert.type === 'success' ? 'bg-accent' : 'bg-primary'}`} />
                    <span className="flex-1 text-xs font-bold text-slate-300 uppercase tracking-wide leading-tight">{alert.msg}</span>
                    <span className="text-[10px] font-black text-slate-600 italic whitespace-nowrap uppercase">{alert.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'users' && (
        <div className="glass-card overflow-hidden">
          <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">User Base Management</h3>
            <div className="relative group">
              <Search size={20} className="absolute left-4 top-3 text-slate-500 group-focus-within:text-primary transition-colors" />
              <input type="text" placeholder="Search by identity..." className="input-field pl-12 py-3 w-full md:w-80 bg-white/2" />
            </div>
          </div>
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/2 border-b border-white/5">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Balance (USDC)</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Rank</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Protocols</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.email} className="hover:bg-white/5 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-black text-primary border border-white/10 group-hover:border-primary/50 transition-all">
                          {user.full_name?.charAt(0) || user.email.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-wide">{user.full_name || 'Anonymous'}</p>
                          <p className="text-xs font-bold text-slate-500 lowercase opacity-60">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-lg font-black text-white tracking-tighter italic">${user.wallets?.[0]?.balance_usdc?.toLocaleString() || '0.00'}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest leading-none ${user.role === 'admin' ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-accent/20 text-accent border border-accent/20'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2.5 bg-white/5 hover:bg-primary/20 text-slate-400 hover:text-primary rounded-xl transition-all"><Edit2 size={16} /></button>
                        {user.email !== 'horaciowalterortiz@gmail.com' && (
                          <button className="p-2.5 bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded-xl transition-all"><XCircle size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'settings' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass-card p-8">
              <h3 className="text-xl font-black text-white mb-8 uppercase tracking-tighter italic">Referral Protocol Settings</h3>
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { key: 'level1', label: 'Primary Level', icon: '1' },
                    { key: 'level2', label: 'Secondary Level', icon: '2' },
                    { key: 'level3', label: 'Tertiary Level', icon: '3' },
                  ].map((lvl) => (
                    <div key={lvl.key} className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{lvl.label}</label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={systemSettings.referral_commissions?.[lvl.key] || 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setSystemSettings({
                              ...systemSettings,
                              referral_commissions: {
                                ...systemSettings.referral_commissions,
                                [lvl.key]: val
                              }
                            });
                          }}
                          className="input-field w-full pl-6 pr-10 py-3 text-lg font-black italic bg-white/2 border-white/5"
                        />
                        <span className="absolute right-4 top-3.5 text-slate-500 font-black">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => updateSetting('referral_commissions', systemSettings.referral_commissions)}
                  className="w-full primary-button py-4 text-xs font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30"
                >
                  Synchronize Commissions
                </button>
              </div>
            </div>

            <div className="glass-card p-8 bg-gradient-to-br from-indigo-500/5 to-transparent">
              <h3 className="text-xl font-black text-white mb-8 uppercase tracking-tighter italic">Global Liquidity Parameters</h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Guaranteed Pool Amount (USDC)</label>
                  <div className="relative">
                    <Database className="absolute left-4 top-3.5 text-primary" size={20} />
                    <input 
                      type="number" 
                      value={systemSettings.pool_guaranteed?.amount || 500000}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setSystemSettings({
                          ...systemSettings,
                          pool_guaranteed: { ...systemSettings.pool_guaranteed, amount: val }
                        });
                      }}
                      className="input-field w-full pl-12 py-4 text-xl font-black italic bg-white/2 border-primary/20"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => updateSetting('pool_guaranteed', systemSettings.pool_guaranteed)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl shadow-xl transition-all text-xs font-black uppercase tracking-[0.2em]"
                >
                  Update Reserve Values
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-8 border-rose-500/20 bg-rose-500/5">
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tighter italic flex items-center">
              <ShieldAlert size={24} className="mr-3 text-rose-500 animate-pulse" />
              Emergency Protocols
            </h3>
            <div className="flex flex-wrap gap-4">
              <button className="px-6 py-3 bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Freeze Withdrawals
              </button>
              <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Maintenance Mode
              </button>
              <button className="px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                API Lockdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
