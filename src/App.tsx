import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import MainLayout from './layout/MainLayout';
import TradingDashboard from './pages/TradingDashboard';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import Wallet from './pages/Wallet';
import AdminPanel from './pages/AdminPanel';
import Auth from './pages/Auth';
import CustomTokens from './pages/CustomTokens';
import Referrals from './pages/Referrals';
import Tasks from './pages/Tasks';
import { useAuthStore } from './store/useAuthStore';
import { supabase } from './services/supabase';

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.4, ease: "easeOut" }}
    className="h-full"
  >
    {children}
  </motion.div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, signOut } = useAuthStore();
  const [showRescue, setShowRescue] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setShowRescue(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin mb-8 shadow-[0_0_30px_rgba(243,186,47,0.2)]" />
        <h2 className="text-xl font-black text-white uppercase tracking-[0.3em] italic animate-pulse">Synchronizing Data</h2>
        {showRescue && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="mt-8 space-y-4"
          >
            <p className="text-rose-500 text-xs font-bold italic">Synchronization is taking longer than usual.</p>
            <button 
              onClick={() => signOut()}
              className="px-6 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl border border-rose-500/20 text-xs font-black uppercase tracking-widest transition-all"
            >
              Force Logout & Reset
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  const { profile } = useAuthStore();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/login" element={<PageTransition><Auth mode="login" /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Auth mode="register" /></PageTransition>} />

        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout>
              <PageTransition><Dashboard /></PageTransition>
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/trading" element={
          <ProtectedRoute>
            <MainLayout>
              <PageTransition><TradingDashboard /></PageTransition>
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/referrals" element={
          <ProtectedRoute>
            <MainLayout>
              <PageTransition><Referrals /></PageTransition>
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/tasks" element={
          <ProtectedRoute>
            <MainLayout>
              <PageTransition><Tasks /></PageTransition>
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/custom-token" element={
          <ProtectedRoute>
            <MainLayout>
              <PageTransition><CustomTokens /></PageTransition>
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/investments" element={
          <ProtectedRoute>
            <MainLayout>
              <PageTransition><Investments /></PageTransition>
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/wallet" element={
          <ProtectedRoute>
            <MainLayout>
              <PageTransition><Wallet /></PageTransition>
            </MainLayout>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute>
            {profile?.role === 'admin' ? (
              <MainLayout>
                <PageTransition><AdminPanel /></PageTransition>
              </MainLayout>
            ) : <Navigate to="/" />}
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const { setUser, setProfile, setWallet, loading, setLoading } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    let authTimeout: any;

    // Safety timeout: Forced UI reset after 8s
    authTimeout = setTimeout(() => {
      if (mounted && useAuthStore.getState().loading) {
        console.warn("Session Recovery: Timeout. Resetting state.");
        setLoading(false);
      }
    }, 8000);

    const setupAuth = async () => {
      console.log("Session Initialization: Monitoring state change...");
      
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`Session Event: ${event}`);
        if (!mounted) return;

        if (session?.user) {
          console.log(`Session Detected: ${session.user.email}. Synchronizing identity...`);
          setUser(session.user);
          
          try {
             // In-block fetch for profiling
             const [pRes, wRes] = await Promise.all([
               supabase.from('profiles').select('*').eq('id', session.user.id).single(),
               supabase.from('wallets').select('*').eq('user_id', session.user.id).single()
             ]);

             if (pRes.data) {
               setProfile(pRes.data);
               setWallet(wRes.data || null);
             } else {
               console.error("Session Integrity Violation: Profile missing.");
               // Session belongs to identity but has no mapping
               if (event !== 'SIGNED_IN') {
                 console.log("Ghost Session: Expelling...");
                 await useAuthStore.getState().signOut();
                 return;
               }
             }
          } catch (e) {
             console.error("Identity Synchronization Error:", e);
          } finally {
             if (mounted) setLoading(false);
          }
        } else {
          console.log("No session detected.");
          if (mounted) {
            setUser(null);
            setProfile(null);
            setWallet(null);
            setLoading(false);
          }
        }
      });

      return subscription;
    };

    const subPromise = setupAuth();

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      subPromise.then(sub => sub.unsubscribe());
    };
  }, []);

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
};

export default App;
