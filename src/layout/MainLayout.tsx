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
import { useNotificationStore } from '../store/useNotificationStore';
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
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, subscribeToNotifications, lastNotification, clearLastNotification } = useNotificationStore();

  React.useEffect(() => {
    if (profile) {
      fetchNotifications(profile.id);
      const unsubscribe = subscribeToNotifications(profile.id);
      return () => unsubscribe();
    }
  }, [profile, fetchNotifications, subscribeToNotifications]);

  React.useEffect(() => {
    if (lastNotification) {
      const timer = setTimeout(() => {
        clearLastNotification();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastNotification, clearLastNotification]);

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

        {/* Global Toast Notification */}
        {lastNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className={`fixed top-24 right-4 md:right-8 lg:right-12 z-[100] p-4 rounded-2xl flex items-center space-x-4 shadow-2xl backdrop-blur-2xl border min-w-[300px] max-w-sm ${
              lastNotification.type === 'success' ? 'bg-accent/10 border-accent/20 text-accent' :
              lastNotification.type === 'error' ? 'bg-error/10 border-error/20 text-error' :
              lastNotification.type === 'transaction' ? 'bg-primary/20 border-primary/40 text-primary shadow-[0_0_30px_rgba(243,186,47,0.2)]' :
              'bg-slate-800/80 border-slate-700 text-white'
            }`}
          >
            <div className={`p-2 rounded-xl ${
              lastNotification.type === 'success' ? 'bg-accent/20' :
              lastNotification.type === 'error' ? 'bg-error/20' :
              lastNotification.type === 'transaction' ? 'bg-primary/20' :
              'bg-slate-700'
            }`}>
              <Bell size={20} />
            </div>
            <div className="flex-1">
               <h4 className="text-[10px] font-black uppercase tracking-widest">{lastNotification.title}</h4>
               <p className="text-xs font-semibold opacity-90 mt-1">{lastNotification.message}</p>
            </div>
            <button 
              onClick={clearLastNotification}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
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
            <span className="text-xl md:text-2xl font-bold tracking-tight text-white italic">Tradify</span>
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
            
            <div className="hidden sm:flex flex-col items-end mr-2 text-right">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Live Balance</span>
              <span className="text-sm md:text-xl font-black text-accent italic tracking-tighter">
                {(wallet?.balance_usdc ?? 0).toLocaleString()} <span className="text-[10px] md:text-xs font-normal text-slate-500">USDC</span>
              </span>
            </div>
            
            <div className="relative group/notif">
              <button className="p-2.5 hover:bg-white/5 rounded-full relative transition-all active:scale-95 group-hover/notif:bg-white/10">
                <Bell size={22} className="text-slate-400 group-hover/notif:text-white transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-dark flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {/* Notification Dropdown */}
              <div className="absolute right-[-60px] md:right-0 mt-2 w-[calc(100vw-40px)] sm:w-[400px] bg-dark-lighter border border-white/10 rounded-3xl shadow-2xl opacity-0 translate-y-4 pointer-events-none group-hover/notif:opacity-100 group-hover/notif:translate-y-0 group-hover/notif:pointer-events-auto transition-all duration-300 z-50 overflow-hidden backdrop-blur-2xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
                  <h3 className="font-black text-white uppercase tracking-tighter italic">Notifications</h3>
                  <button 
                    onClick={() => profile && markAllAsRead(profile.id)}
                    className="text-[10px] font-black text-primary hover:text-white uppercase tracking-[0.2em] transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                
                <div className="max-h-[450px] overflow-y-auto scrollbar-hide divide-y divide-white/5">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => markAsRead(n.id)}
                        className={`p-6 hover:bg-white/2 transition-all cursor-pointer relative group/item ${!n.is_read ? 'bg-primary/5' : ''}`}
                      >
                        {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                        <div className="flex items-start space-x-4">
                          <div className={`mt-1 p-2 rounded-xl ${
                            n.type === 'success' ? 'bg-accent/10 text-accent' : 
                            n.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 
                            'bg-primary/10 text-primary'
                          }`}>
                            <Bell size={16} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-black text-white uppercase tracking-wide">{n.title}</p>
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{new Date(n.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed group-hover/item:text-slate-300 transition-colors">
                              {n.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center space-y-4">
                      <Bell size={40} className="mx-auto text-slate-800" />
                      <p className="text-slate-500 font-medium italic text-sm">No new notifications. Everything is on track.</p>
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-t border-white/5 bg-white/2">
                  <button className="w-full py-3 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-[0.3em] transition-all">
                    System Stable
                  </button>
                </div>
              </div>
            </div>
            
            <Link to="/profile" className="flex items-center space-x-2 md:space-x-3 p-1 pr-2 md:pr-4 rounded-full border border-white/10 hover:border-primary/50 transition-all bg-white/5">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-primary">{profile?.full_name?.charAt(0) || profile?.email?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="hidden sm:inline-block text-xs md:text-sm font-semibold">{profile?.full_name?.split(' ')[0] || 'Profile'}</span>
            </Link>

          </div>
        </header>

        {/* Page Content */}
        <section className="p-4 md:p-8 lg:p-12 flex-1 pb-32 lg:pb-12 max-w-7xl mx-auto w-full">
          {children}
        </section>

        {/* Mobile Bottom Bar */}
        <div className="lg:hidden fixed bottom-4 left-4 right-4 h-20 bg-dark-lighter/40 border border-white/10 flex items-center justify-around px-2 z-[60] backdrop-blur-3xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {navigation.filter(item => (item.mobile || (item.adminOnly && profile?.role === 'admin'))).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link 
                key={item.name} 
                to={item.href}
                className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-500 ${isActive ? 'text-primary' : 'text-slate-500'}`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="mobile-nav-bg"
                    className="absolute inset-0 bg-primary/10 rounded-2xl"
                    transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
                  />
                )}
                <Icon size={24} className={`relative z-10 transition-transform duration-500 ${isActive ? 'scale-110' : ''}`} />
                {isActive && <motion.div layoutId="mobile-dot" className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
