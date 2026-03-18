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
  XCircle,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Globe,
  DollarSign
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

import { supabase } from '../services/supabase';

const AdminPanel: React.FC = () => {
  const { profile } = useAuthStore();
  const [systemSettings, setSystemSettings] = useState<any>({});
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'deposits' | 'plans' | 'tokens' | 'settings' | 'announcements'>('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingToken, setEditingToken] = useState<any>(null);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [newBalanceValue, setNewBalanceValue] = useState<string>('');
  const [stats, setStats] = useState([
    { label: 'Total Users', value: '0', icon: Users, change: '0' },
    { label: 'Pending Deposits', value: '0', icon: Database, change: 'Critical' },
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
      // 1. Fetch Users & Wallets
      const { data: userData } = await supabase
        .from('profiles')
        .select('*, wallets(balance_usdc)');
      
      // 2. Fetch Pending Deposits
      const { data: depositData } = await supabase
        .from('transactions')
        .select('*, profile:profiles(*)')
        .eq('status', 'pending');
      
      // 3. Fetch Tokens
      const { data: tokenData } = await supabase
        .from('custom_tokens')
        .select('*')
        .order('created_at', { ascending: false });

      // 3.5 Fetch Announcements
      const { data: announceData } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      // 3.7 Fetch Protocols (Plans)
      const { data: planData } = await supabase
        .from('plans')
        .select('*')
        .order('id', { ascending: true });

      if (userData) setUsers(userData);
      if (depositData) setPendingDeposits(depositData);
      if (tokenData) setTokens(tokenData);
      if (announceData) setAnnouncements(announceData);
      if (planData) setPlans(planData);

      // 4. Update Stats
      if (userData) {
        const totalUsers = userData.length;
        const totalDeposits = userData.reduce((acc, curr: any) => acc + (curr.wallets?.[0]?.balance_usdc || 0), 0);
        
        const { count: activeInvs } = await supabase
          .from('investments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        setStats([
          { label: 'Users Network', value: totalUsers.toString(), icon: Users, change: '+2.4%' },
          { label: 'Pending Authorizations', value: (depositData?.length || 0).toString(), icon: Database, change: 'Action Required' },
          { label: 'Active Smart Plans', value: (activeInvs || 0).toString(), icon: Activity, change: '+5.2%' },
          { label: 'Pool Guaranteed', value: `$${(systemSettings.pool_guaranteed?.amount || totalDeposits).toLocaleString()}`, icon: ShieldAlert, change: 'Stable' },
        ]);
      }
    } catch (error) {
      console.error('Admin data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBalance = async (userId: string, newBalance: number) => {
    const { error } = await supabase
      .from('wallets')
      .update({ balance_usdc: newBalance })
      .eq('user_id', userId);
    
    if (!error) {
      alert('Balance updated successfully');
      setEditingUser(null);
      fetchAdminData();
    }
  };

  const approveDeposit = async (transaction: any) => {
    try {
      // 1. Update wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance_usdc')
        .eq('user_id', transaction.user_id)
        .single();
      
      if (!wallet) throw new Error('Wallet not found');

      await supabase
        .from('wallets')
        .update({ balance_usdc: wallet.balance_usdc + transaction.amount })
        .eq('user_id', transaction.user_id);

      // 2. Update transaction status
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('id', transaction.id);
      
      // 3. Notify user
      await supabase.from('notifications').insert({
        user_id: transaction.user_id,
        title: 'Deposit Approved',
        message: `Your deposit of ${transaction.amount} USDC has been confirmed. Network synchronization complete.`,
        type: 'success'
      });

      alert('Transaction approved and funds credited.');
      fetchAdminData();
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  const rejectDeposit = async (id: string, userId: string) => {
    await supabase.from('transactions').update({ status: 'failed' }).eq('id', id);
    await supabase.from('notifications').insert({
      user_id: userId,
      title: 'Deposit Failed',
      message: `Your deposit signal was rejected. Please contact support via neural net if this is an error.`,
      type: 'error'
    });
    alert('Deposit rejected.');
    fetchAdminData();
  };

  const handleTokenSave = async (tokenData: any) => {
    const payload = {
      ...tokenData,
      current_price: tokenData.current_price || 1,
      status: tokenData.status || 'active',
      updated_at: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('custom_tokens')
      .upsert(payload);
    
    if (!error) {
      alert('Token configuration synchronized.');
      setEditingToken(null);
      fetchAdminData();
    }
  };

  const handleAnnouncementSave = async (announceData: any) => {
    const { error } = await supabase
      .from('announcements')
      .upsert({
        ...announceData,
        created_at: announceData.created_at || new Date().toISOString()
      });
    
    if (!error) {
      alert('Announcement broadcasted.');
      setEditingAnnouncement(null);
      fetchAdminData();
    }
  };

  const deleteAnnouncement = async (id: number) => {
    if (!confirm('Abort broadcast?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (!error) fetchAdminData();
  };

  const handlePlanSave = async (planData: any) => {
    const { error } = await supabase
      .from('plans')
      .upsert({
        ...planData,
        updated_at: new Date().toISOString()
      });
    
    if (!error) {
      alert('Protocol parameters synchronized.');
      setEditingPlan(null);
      fetchAdminData();
    }
  };

  const deletePlan = async (id: number) => {
    if (!confirm('Decommission protocol? All active nodes will remain until maturity.')) return;
    const { error } = await supabase.from('plans').delete().eq('id', id);
    if (!error) fetchAdminData();
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
          { id: 'deposits', label: 'Auth Inbox', icon: Database },
          { id: 'plans', label: 'Protocols', icon: TrendingUp },
          { id: 'tokens', label: 'Market Assets', icon: Globe },
          { id: 'announcements', label: 'Broadcasts', icon: Activity },
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
        <div className="glass-card overflow-hidden border-white/5">
          <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Entity Distribution</h3>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Search entities by email or ID..." 
                className="w-full bg-white/2 border border-white/5 rounded-2xl py-3 pl-12 pr-6 text-sm font-bold text-white focus:border-primary/50 outline-none transition-all"
              />
            </div>
          </div>
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/2 border-b border-white/5">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Profile</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Role</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Balance (USDC)</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black italic">
                          {user.email?.[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase">{user.full_name || 'Anonymous Entity'}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${user.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-slate-500'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-lg font-black text-white italic tracking-tighter">
                        ${(user.wallets?.[0]?.balance_usdc || 0).toLocaleString()}
                      </p>
                    </td>
                    <td className="px-8 py-6">
                      <button 
                        onClick={() => {
                          setEditingUser(user);
                          setNewBalanceValue((user.wallets?.[0]?.balance_usdc || 0).toString());
                        }}
                        className="p-3 bg-white/2 hover:bg-primary/20 text-slate-500 hover:text-primary rounded-xl transition-all border border-white/5"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-10 max-w-lg w-full relative">
            <button onClick={() => setEditingUser(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><XCircle size={28} /></button>
            <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-8">Override Balance</h3>
            <div className="space-y-6">
              <div className="p-6 bg-white/2 rounded-3xl border border-white/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Target Entity</p>
                <p className="text-sm font-black text-white uppercase">{editingUser.email}</p>
              </div>
                  <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Volume (USDC)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-4 text-primary" size={20} />
                  <input 
                    type="number" 
                    value={newBalanceValue}
                    onChange={(e) => setNewBalanceValue(e.target.value)}
                    className="w-full bg-black/40 border border-primary/20 rounded-2xl py-4 pl-12 pr-6 text-xl font-black text-white italic outline-none focus:border-primary/50 transition-all"
                  />
                </div>
              </div>
              <button 
                onClick={() => {
                  handleUpdateBalance(editingUser.id, parseFloat(newBalanceValue));
                }}
                className="w-full primary-button py-5 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/40 flex items-center justify-center space-x-3"
              >
                <Save size={18} />
                <span>Override System Ledger</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {activeSection === 'deposits' && (
        <div className="glass-card overflow-hidden">
          <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Auth Inbox (Pending Deposits)</h3>
          </div>
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/2 border-b border-white/5">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Entity</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Amount</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">TXID / Hash</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Authorization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pendingDeposits.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-all">
                    <td className="px-8 py-6">
                      <p className="text-sm font-black text-white uppercase">{tx.profile?.email}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{new Date(tx.created_at).toLocaleString()}</p>
                    </td>
                    <td className="px-8 py-6 font-black text-emerald-500 italic text-lg">+${tx.amount.toLocaleString()}</td>
                    <td className="px-8 py-6">
                      <code className="text-[10px] font-mono text-primary bg-primary/5 px-2 py-1 rounded-lg border border-primary/20">{tx.tx_hash}</code>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => approveDeposit(tx)}
                          className="flex items-center space-x-2 px-4 py-2 bg-accent/20 text-accent border border-accent/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent hover:text-dark transition-all"
                        >
                          <CheckCircle2 size={14} />
                          <span>Approve</span>
                        </button>
                        <button 
                          onClick={() => rejectDeposit(tx.id, tx.user_id)}
                          className="flex items-center space-x-2 px-4 py-2 bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                        >
                          <XCircle size={14} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingDeposits.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-slate-500 italic font-medium uppercase tracking-[0.2em]">No signals detected in queue.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSection === 'plans' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Protocol Orchestration</h3>
            <button 
              onClick={() => setEditingPlan({ name: '', interest_rate: 5, duration_days: 30, interest_period_days: 15, min_amount: 50, max_amount: 1000, max_simultaneous: 5, is_active: true })}
              className="flex items-center space-x-3 px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-105 transition-all"
            >
              <Plus size={18} />
              <span>Initialize Protocol</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div key={plan.id} className="glass-card p-8 border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-30 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-1">{plan.name}</h4>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${plan.is_active ? 'bg-primary/20 text-primary' : 'bg-white/5 text-slate-500'}`}>
                      {plan.is_active ? 'Operational' : 'Decommissioned'}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => setEditingPlan(plan)} className="p-3 bg-white/2 hover:bg-primary/20 text-slate-500 hover:text-primary rounded-xl transition-all"><Edit2 size={16} /></button>
                    <button onClick={() => deletePlan(plan.id)} className="p-3 bg-white/2 hover:bg-error/20 text-slate-500 hover:text-error rounded-xl transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="p-4 bg-white/2 rounded-[1.5rem] border border-white/5">
                    <p className="text-[9px] font-black text-slate-600 uppercase mb-2 tracking-widest">Yield Rate</p>
                    <p className="text-2xl font-black text-primary italic leading-none">{plan.interest_rate}%</p>
                  </div>
                  <div className="p-4 bg-white/2 rounded-[1.5rem] border border-white/5">
                    <p className="text-[9px] font-black text-slate-600 uppercase mb-2 tracking-widest">Maturity</p>
                    <p className="text-xl font-black text-white italic leading-none">{plan.duration_days}D</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>Thresholds</span>
                    <span className="text-white">${plan.min_amount} - ${plan.max_amount}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>Node Capacity</span>
                    <span className="text-white">Max {plan.max_simultaneous}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {editingPlan && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl overflow-y-auto">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-10 max-w-2xl w-full relative my-8">
                <button onClick={() => setEditingPlan(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><XCircle size={28} /></button>
                <div className="flex items-center space-x-4 mb-10">
                  <div className="p-4 bg-primary/20 rounded-3xl text-primary border border-primary/20">
                    <TrendingUp size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">Protocol Configuration</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Interest Engine Parameters</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Protocol Identity</label>
                      <input 
                        type="text" 
                        value={editingPlan.name}
                        onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
                        className="input-field w-full p-4 bg-white/2 font-black italic"
                        placeholder="ALPHA-01"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Daily Yield (%)</label>
                        <input 
                          type="number" 
                          value={editingPlan.interest_rate}
                          onChange={(e) => setEditingPlan({...editingPlan, interest_rate: parseFloat(e.target.value)})}
                          className="input-field w-full p-4 bg-white/2 font-black text-primary"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Cycle Days</label>
                        <input 
                          type="number" 
                          value={editingPlan.interest_period_days}
                          onChange={(e) => setEditingPlan({...editingPlan, interest_period_days: parseInt(e.target.value)})}
                          className="input-field w-full p-4 bg-white/2 font-black"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Maturity Window (Days)</label>
                      <input 
                        type="number" 
                        value={editingPlan.duration_days}
                        onChange={(e) => setEditingPlan({...editingPlan, duration_days: parseInt(e.target.value)})}
                        className="input-field w-full p-4 bg-white/2 font-black"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Min Threshold</label>
                        <input 
                          type="number" 
                          value={editingPlan.min_amount}
                          onChange={(e) => setEditingPlan({...editingPlan, min_amount: parseFloat(e.target.value)})}
                          className="input-field w-full p-4 bg-white/2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Max Threshold</label>
                        <input 
                          type="number" 
                          value={editingPlan.max_amount}
                          onChange={(e) => setEditingPlan({...editingPlan, max_amount: parseFloat(e.target.value)})}
                          className="input-field w-full p-4 bg-white/2"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Simultaneous Nodes</label>
                      <input 
                        type="number" 
                        value={editingPlan.max_simultaneous}
                        onChange={(e) => setEditingPlan({...editingPlan, max_simultaneous: parseInt(e.target.value)})}
                        className="input-field w-full p-4 bg-white/2"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Protocol Gate</label>
                      <button 
                         type="button"
                         onClick={() => setEditingPlan({...editingPlan, is_active: !editingPlan.is_active})}
                         className={`w-full py-4 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest ${editingPlan.is_active ? 'border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_rgba(var(--color-primary),0.2)]' : 'border-white/5 bg-white/2 text-slate-500'}`}
                       >
                         {editingPlan.is_active ? 'OPERATIONAL' : 'DECOMMISSIONED'}
                       </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handlePlanSave(editingPlan)}
                  className="w-full primary-button mt-10 py-5 text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/40 flex items-center justify-center space-x-3"
                >
                  <Save size={18} />
                  <span>Synchronize Protocol</span>
                </button>
              </motion.div>
            </div>
          )}
        </div>
      )}
      {activeSection === 'tokens' && (
        <div className="space-y-8 text-white">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Market Assets Management</h3>
            <button 
              onClick={() => setEditingToken({ name: '', symbol: '', price: 1, supply: 1000000, type: 'custom', simulation_type: 'random', trend_direction: 'neutral', volatility: 0.05 })}
              className="flex items-center space-x-3 px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-105 transition-all"
            >
              <Plus size={18} />
              <span>Register New Asset</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tokens.map((token) => (
              <div key={token.id} className="glass-card p-6 border-white/5 hover:border-primary/30 transition-all group">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-primary border border-white/10 italic font-black">
                      {token.symbol.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-black text-white uppercase tracking-tighter">{token.name}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{token.symbol}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingToken(token)} className="p-2.5 bg-white/2 hover:bg-primary/20 text-slate-500 hover:text-primary rounded-xl transition-all"><Edit2 size={16} /></button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-white/2 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Price</p>
                    <p className="text-sm font-black text-white italic">${token.price.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-white/2 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Volatitity</p>
                    <p className="text-sm font-black text-primary italic">{(token.volatility * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10 flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Simulation Mode</p>
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">{token.simulation_type}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full animate-pulse ${token.simulation_type === 'pump' ? 'bg-accent shadow-[0_0_10px_#10b981]' : token.simulation_type === 'dump' ? 'bg-rose-500' : 'bg-primary'}`} />
                </div>
              </div>
            ))}
          </div>

          {editingToken && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl overflow-y-auto">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-10 max-w-2xl w-full relative my-8">
                <button onClick={() => setEditingToken(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><XCircle size={28} /></button>
                
                <div className="flex items-center space-x-4 mb-10">
                  <div className="p-4 bg-primary/20 rounded-3xl text-primary border border-primary/20">
                    <Globe size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">Asset Configuration</h3>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Neural Market Orchestration</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Asset Status</label>
                       <select 
                         value={editingToken.status || 'active'}
                         onChange={(e) => setEditingToken({...editingToken, status: e.target.value})}
                         className="input-field w-full p-4 bg-black/40 text-sm font-bold"
                       >
                         <option value="active">Active Trading</option>
                         <option value="pre_launch">Pre-launch Protocol</option>
                         <option value="ended">Ended/Delisted</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Asset Identity (Name)</label>
                      <input 
                        type="text" 
                        value={editingToken.name}
                        onChange={(e) => setEditingToken({...editingToken, name: e.target.value})}
                        className="input-field w-full p-4 bg-white/2"
                        placeholder="Neural Token"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Symbol (Ticker)</label>
                      <input 
                        type="text" 
                        value={editingToken.symbol}
                        onChange={(e) => setEditingToken({...editingToken, symbol: e.target.value})}
                        className="input-field w-full p-4 bg-white/2"
                        placeholder="NRL"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Base Price</label>
                        <input 
                          type="number" 
                          value={editingToken.current_price || editingToken.price || 1}
                          onChange={(e) => setEditingToken({...editingToken, current_price: parseFloat(e.target.value)})}
                          className="input-field w-full p-4 bg-white/2 font-black italic"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Volatility (0-1)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          max="1"
                          min="0"
                          value={editingToken.volatility || 0.05}
                          onChange={(e) => setEditingToken({...editingToken, volatility: parseFloat(e.target.value)})}
                          className="input-field w-full p-4 bg-white/2"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Liquidity Pool (USDC)</label>
                      <input 
                        type="number" 
                        value={editingToken.liquidity || 100000}
                        onChange={(e) => setEditingToken({...editingToken, liquidity: parseFloat(e.target.value)})}
                        className="input-field w-full p-4 bg-white/2 font-black text-emerald-500"
                        placeholder="100000"
                      />
                    </div>
                  </div>


                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Simulation Algorithm</label>
                      <select 
                        value={editingToken.simulation_type}
                        onChange={(e) => setEditingToken({...editingToken, simulation_type: e.target.value})}
                        className="input-field w-full p-4 bg-black/40 text-white font-bold"
                      >
                        <option value="random">Random Walk (Natural)</option>
                        <option value="steady">Steady Growth</option>
                        <option value="pump">Institutional Pump</option>
                        <option value="dump">Aggressive Dump</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Trend Direction</label>
                      <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                        {['up', 'neutral', 'down'].map((dir) => (
                          <button 
                            key={dir}
                            onClick={() => setEditingToken({...editingToken, trend_direction: dir})}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingToken.trend_direction === dir ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'text-slate-600'}`}
                          >
                            {dir}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10">
                      <h4 className="text-[10px] font-black text-primary uppercase mb-3 flex items-center">
                        <Activity size={12} className="mr-2" />
                        Live Forecast
                      </h4>
                      <p className="text-slate-400 text-xs italic font-medium">
                        Based on these parameters, the asset will experience a {editingToken.volatility > 0.5 ? 'high' : 'controlled'} volatility with a {editingToken.trend_direction} underlying trend.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex space-x-4">
                  <button 
                    onClick={() => handleTokenSave(editingToken)}
                    className="flex-1 primary-button py-5 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 flex items-center justify-center space-x-3"
                  >
                    <Save size={18} />
                    <span>Synchronize Market Data</span>
                  </button>
                  <button className="px-6 py-5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl hover:bg-rose-500 hover:text-white transition-all">
                    <Trash2 size={24} />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {activeSection === 'announcements' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Broadcast Terminal</h3>
            <button 
              onClick={() => setEditingAnnouncement({ title: '', content: '', image_url: '', type: 'announcement', is_active: true })}
              className="flex items-center space-x-3 px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-105 transition-all"
            >
              <Plus size={18} />
              <span>Broadcast Signal</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {announcements.map((ann) => (
              <div key={ann.id} className="glass-card p-6 border-white/5 hover:border-primary/30 transition-all group overflow-hidden">
                <div className="relative h-32 -mx-6 -mt-6 mb-6 overflow-hidden">
                  <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover brightness-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1e2329]/90 to-transparent" />
                </div>
                <div className="flex items-center justify-between mb-4">
                   <h4 className="font-black text-white uppercase tracking-tighter text-sm">{ann.title}</h4>
                   <div className="flex space-x-2">
                     <button onClick={() => setEditingAnnouncement(ann)} className="p-2 bg-white/5 hover:bg-primary/20 text-slate-500 hover:text-primary rounded-xl transition-all"><Edit2 size={14} /></button>
                     <button onClick={() => deleteAnnouncement(ann.id)} className="p-2 bg-white/5 hover:bg-error/20 text-slate-500 hover:text-error rounded-xl transition-all"><Trash2 size={14} /></button>
                   </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium italic mb-4 line-clamp-2">{ann.content}</p>
                <div className="flex items-center justify-between">
                   <span className={`px-2 py-1 rounded-[4px] text-[7px] font-black uppercase tracking-widest ${ann.type === 'pre_launch' ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/20 text-primary'}`}>
                      {ann.type}
                   </span>
                   <span className="text-[8px] font-bold text-slate-600 italic">{new Date(ann.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>

          {editingAnnouncement && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-10 max-w-lg w-full relative">
                <button onClick={() => setEditingAnnouncement(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><XCircle size={28} /></button>
                <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-8">Broadcast Editor</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Broadcast Title</label>
                    <input 
                      type="text" 
                      value={editingAnnouncement.title}
                      onChange={(e) => setEditingAnnouncement({...editingAnnouncement, title: e.target.value})}
                      className="input-field w-full p-4 bg-white/2"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Content / Body</label>
                    <textarea 
                      value={editingAnnouncement.content}
                      onChange={(e) => setEditingAnnouncement({...editingAnnouncement, content: e.target.value})}
                      className="input-field w-full p-4 bg-white/2 h-32 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Imagery URL</label>
                    <input 
                      type="text" 
                      value={editingAnnouncement.image_url}
                      onChange={(e) => setEditingAnnouncement({...editingAnnouncement, image_url: e.target.value})}
                      className="input-field w-full p-4 bg-white/2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Signal Type</label>
                      <select 
                         value={editingAnnouncement.type}
                         onChange={(e) => setEditingAnnouncement({...editingAnnouncement, type: e.target.value})}
                         className="input-field w-full p-4 bg-black/40 font-bold"
                      >
                         <option value="announcement">Announcement</option>
                         <option value="pre_launch">Pre-Launch</option>
                         <option value="update">Update</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Transmission</label>
                       <button 
                         type="button"
                         onClick={() => setEditingAnnouncement({...editingAnnouncement, is_active: !editingAnnouncement.is_active})}
                         className={`w-full py-4 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest ${editingAnnouncement.is_active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/5 bg-white/2 text-slate-500'}`}
                       >
                         {editingAnnouncement.is_active ? 'Broadcasting ON' : 'Broadcasting OFF'}
                       </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAnnouncementSave(editingAnnouncement)}
                    className="w-full primary-button py-5 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/40"
                  >
                    Authorize Transmission
                  </button>
                </div>
              </motion.div>
            </div>
          )}
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
