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
import Profile from './pages/Profile';
import { useAuthStore } from './store/useAuthStore';
import { supabase } from './services/supabase';
import { App as CapApp } from '@capacitor/app';
import { initializePushNotifications } from './services/pushNotifications';


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
    // If we're still loading after 3 seconds, show the escape hatch
    const timer = setTimeout(() => {
      if (loading) setShowRescue(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, [loading]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-primary rounded-full animate-spin shadow-[0_0_30px_rgba(243,186,47,0.15)]" />
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
        <Route path="/profile" element={
          <ProtectedRoute>
            <MainLayout>
              <PageTransition><Profile /></PageTransition>
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
    initializePushNotifications();
    let mounted = true;

    let authTimeout: any;

    // Safety failsafe: If state is truly stuck, force ready after 20s
    authTimeout = setTimeout(() => {
      if (mounted && useAuthStore.getState().loading) {
        setLoading(false);
      }
    }, 20000);

    const setupAuth = async () => {
      // 1. Proactive check for existing session on page load
      console.log("Core: Checking initial session integrity...");
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      
      if (initialSession?.user && mounted) {
        console.log("Core: Active session recovered from cache.");
        setUser(initialSession.user);
        syncIdentity(initialSession, 'INITIAL_SESSION');
      }

      // 2. Monitor for all subsequent state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        console.log(`Core Auth Event: ${event}`);

        if (session?.user) {
          setUser(session.user);
          syncIdentity(session, event);
        } else {
          console.log("Core: Clean state (No session).");
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

    const syncIdentity = async (session: any, event: string) => {
      try {
         // Sequential fetch with Timeout protection
         const fetchWithTimeout = async (query: Promise<any>, timeoutMs: number) => {
           return Promise.race([
             query,
             new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs))
           ]);
         };

         console.log("Phase 1: Fetching Profile...");
         const { data: pData, error: pErr } = await fetchWithTimeout(
            supabase.from('profiles').select('*').eq('id', session.user.id).single() as any,
            8000
         );
         
         if (pErr) throw pErr;
         if (pData) setProfile(pData);

         console.log("Phase 2: Fetching Wallet...");
         const { data: wData } = await fetchWithTimeout(
            supabase.from('wallets').select('*').eq('user_id', session.user.id).single() as any,
            8000
         ).catch(() => ({ data: null }));

         if (wData) setWallet(wData);

         console.log("Core: Identity Synchronized.");
      } catch (e: any) {
         console.warn("Core: Identity Fetch Issue -", e.message);
      } finally {
         if (mounted) setLoading(false);
      }
    };

    const subPromise = setupAuth();

    // Android Back Button Logic
    const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      subPromise.then(sub => sub.unsubscribe());
      backListener.then(l => l.remove());
    };
  }, []);

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
};

export default App;
