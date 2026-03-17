import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Wallet as WalletIcon, 
  PieChart, 
  Users, 
  CheckSquare, 
  Settings, 
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronRight,
  Database
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Trading', href: '/trading', icon: TrendingUp },
  { name: 'Custom Token', href: '/custom-token', icon: Database },
  { name: 'Investments', href: '/investments', icon: PieChart },
  { name: 'Wallet', href: '/wallet', icon: WalletIcon },
  { name: 'Referrals', href: '/referrals', icon: Users },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
];

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { profile, wallet, signOut } = useAuthStore();

  return (
    <div className="min-h-screen bg-dark text-slate-200">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 bottom-0 w-72 bg-dark-lighter border-r border-white/5 z-50 transition-transform duration-300 transform
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
      `}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center space-x-3 mb-10 px-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white italic">Tradify</span>
          </div>

          <nav className="flex-1 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.name}</span>
                  {isActive && <motion.div layoutId="active-pill" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                </Link>
              );
            })}
            
            {profile?.role === 'admin' && (
              <div className="pt-6 mt-6 border-t border-white/5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-4">Admin Only</p>
                <Link to="/admin" className={`sidebar-link ${location.pathname === '/admin' ? 'active' : ''}`}>
                  <Settings size={20} />
                  <span className="font-medium">Admin Panel</span>
                </Link>
              </div>
            )}
          </nav>

          <button 
            onClick={() => signOut()}
            className="sidebar-link mt-auto text-rose-400 hover:text-rose-300 hover:bg-rose-400/5"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen flex flex-col">
        {/* Topbar */}
        <header className="h-20 border-b border-white/5 bg-dark/50 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 lg:px-10">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-white/5 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-2 w-96 group focus-within:border-primary/50 transition-all">
              <Search size={18} className="text-slate-500 group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search markets, assets..." 
                className="bg-transparent border-none focus:ring-0 text-sm ml-3 w-full placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Balance</span>
              <span className="text-lg font-bold text-accent">
                {wallet?.balance_usdc.toLocaleString() ?? '0.00'} <span className="text-xs font-normal">USDC</span>
              </span>
            </div>
            
            <button className="p-2 hover:bg-white/5 rounded-full relative">
              <Bell size={20} className="text-slate-400" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full" />
            </button>
            
            <Link to="/profile" className="flex items-center space-x-3 p-1 rounded-full border border-white/10 hover:border-primary/50 transition-all bg-white/5">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary">{profile?.full_name?.charAt(0) || profile?.email?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="hidden sm:inline-block text-sm font-semibold pr-3">{profile?.full_name || 'User'}</span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <section className="p-6 lg:p-10 flex-1">
          {children}
        </section>
      </main>
    </div>
  );
};

export default MainLayout;
