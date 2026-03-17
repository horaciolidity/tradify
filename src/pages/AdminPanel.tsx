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

const AdminPanel: React.FC = () => {
  const { profile } = useAuthStore();
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'plans' | 'tokens'>('overview');

  if (profile?.email !== 'horaciowalterortiz@gmail.com') {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass-card">
        <ShieldAlert size={60} className="text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only the master administrator can access this panel.</p>
      </div>
    );
  }

  const stats = [
    { label: 'Total Users', value: '1,284', icon: Users, change: '+12%' },
    { label: 'Total Deposits', value: '$452,190', icon: Database, change: '+5%' },
    { label: 'Active Investments', value: '342', icon: Activity, change: '+18%' },
    { label: 'Liquidity Pool', value: '$500,000', icon: ShieldAlert, change: 'Stable' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Control Center</h1>
          <p className="text-slate-400 mt-1">Manage users, systems, and market parameters.</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><Settings size={20} /></button>
          <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><Database size={20} /></button>
        </div>
      </div>

      {/* Admin Nav */}
      <div className="flex space-x-6 border-b border-white/5">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'plans', label: 'Investment Plans', icon: TrendingUp },
          { id: 'tokens', label: 'Custom Tokens', icon: Database },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id as any)}
            className={`flex items-center space-x-2 pb-4 px-2 text-sm font-bold transition-all relative ${activeSection === item.id ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
            {activeSection === item.id && (
              <motion.div layoutId="admin-nav" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <stat.icon size={20} />
                  </div>
                  <span className={`text-xs font-bold ${stat.change.startsWith('+') ? 'text-accent' : 'text-slate-500'}`}>
                    {stat.change}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-2xl font-bold text-white mt-1">{stat.value}</h3>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="font-bold text-white mb-6 flex items-center">
                <ShieldAlert size={18} className="mr-2 text-primary" />
                Global System Status
              </h3>
              <div className="space-y-4">
                {[
                  { name: 'User Registrations', active: true },
                  { name: 'USDC Deposits', active: true },
                  { name: 'Withdrawals', active: false },
                  { name: 'API Trading', active: true },
                  { name: 'Token Creation', active: true },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-white/2 rounded-xl border border-white/5">
                    <span className="text-sm font-medium text-slate-300">{item.name}</span>
                    <button className={`${item.active ? 'text-accent' : 'text-slate-600'} hover:scale-110 transition-all`}>
                      {item.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="font-bold text-white mb-6">Recent Alerts</h3>
              <div className="space-y-4">
                {[
                  { msg: 'Large withdrawal request: $45,000', type: 'warning', time: '2m ago' },
                  { msg: 'New admin role assigned to car@trade.com', type: 'info', time: '1h ago' },
                  { msg: 'System pool liquidity updated', type: 'success', time: '3h ago' },
                ].map((alert, i) => (
                  <div key={i} className="flex items-center space-x-3 text-sm p-3 border-b border-white/5 last:border-none">
                    <div className={`w-2 h-2 rounded-full ${alert.type === 'warning' ? 'bg-amber-500' : alert.type === 'success' ? 'bg-accent' : 'bg-primary'}`} />
                    <span className="flex-1 text-slate-300 font-medium">{alert.msg}</span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">{alert.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'users' && (
        <div className="glass-card overflow-hidden">
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="font-bold text-white">Active Users</h3>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2.5 text-slate-500" />
              <input type="text" placeholder="Search email or name..." className="input-field pl-10 w-full md:w-64" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/2 border-b border-white/5">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Balance</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { name: 'John Doe', email: 'john@example.com', balance: '12,450', status: 'verified' },
                  { name: 'Sarah Miller', email: 'sarah@trade.io', balance: '2,100', status: 'pending' },
                  { name: 'Mike Ross', email: 'mike@law.com', balance: '45,000', status: 'verified' },
                ].map((user) => (
                  <tr key={user.email} className="hover:bg-white/5 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-primary">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono font-bold text-white">${user.balance}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${user.status === 'verified' ? 'bg-accent/20 text-accent' : 'bg-amber-500/20 text-amber-500'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-primary transition-colors"><Edit2 size={16} /></button>
                        <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"><XCircle size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
