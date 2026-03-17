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
  Database,
  Moon,
  Sun
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, mobile: true },
  { name: 'Trading', href: '/trading', icon: TrendingUp, mobile: true },
  { name: 'Investments', href: '/investments', icon: PieChart, mobile: true },
  { name: 'Wallet', href: '/wallet', icon: WalletIcon, mobile: true },
  { name: 'Referrals', href: '/referrals', icon: Users, mobile: true },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, mobile: true },
  { name: 'Admin', href: '/admin', icon: Settings, mobile: false, adminOnly: true },
  { name: 'Tokens', href: '/custom-token', icon: Database, mobile: false, adminOnly: true },
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
            <div className="w-10 h-10 flex items-center justify-center">
              <img src="/tradify_logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white italic">Tradify</span>
          </div>

          <nav className="flex-1 space-y-2">
            {navigation.map((item) => {
              if (item.adminOnly && profile?.role !== 'admin') return null;
              
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
            <button 
              onClick={() => {
                const isDark = document.documentElement.classList.toggle('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
              }}
              className="p-2 hover:bg-white/5 rounded-full text-slate-400"
            >
              <Sun size={20} className="hidden dark:block" />
              <Moon size={20} className="block dark:hidden" />
            </button>
            
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
        <section className="p-4 lg:p-10 flex-1 pb-24 lg:pb-10">
          {children}
        </section>

        {/* Mobile Bottom Bar */}
        <div className="lg:hidden fixed bottom-6 left-4 right-4 h-16 bg-dark-lighter/80 border border-white/10 flex items-center justify-around px-2 z-40 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
          {navigation.filter(item => item.mobile).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link 
                key={item.name} 
                to={item.href}
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-300 ${isActive ? 'text-primary' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="mobile-nav-bg"
                    className="absolute inset-0 bg-primary/10 rounded-xl"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon size={22} className={`relative z-10 ${isActive ? 'scale-110' : ''}`} />
                <span className="relative z-10 text-[9px] font-bold uppercase mt-1 tracking-tighter">{item.name}</span>
                {isActive && <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
