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
  const { user, loading } = useAuthStore();
  
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
        <Route path="/login" element={<PageTransition><Auth mode="login" /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Auth mode="register" /></PageTransition>} />

        <Route path="/" element={<ProtectedRoute><MainLayout><PageTransition><Dashboard /></PageTransition></MainLayout></ProtectedRoute>} />
        <Route path="/trading" element={<ProtectedRoute><MainLayout><PageTransition><TradingDashboard /></PageTransition></MainLayout></ProtectedRoute>} />
        <Route path="/referrals" element={<ProtectedRoute><MainLayout><PageTransition><Referrals /></PageTransition></MainLayout></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><MainLayout><PageTransition><Tasks /></PageTransition></MainLayout></ProtectedRoute>} />
        <Route path="/custom-token" element={<ProtectedRoute><MainLayout><PageTransition><CustomTokens /></PageTransition></MainLayout></ProtectedRoute>} />
        <Route path="/investments" element={<ProtectedRoute><MainLayout><PageTransition><Investments /></PageTransition></MainLayout></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><MainLayout><PageTransition><Wallet /></PageTransition></MainLayout></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><MainLayout><PageTransition><Profile /></PageTransition></MainLayout></ProtectedRoute>} />
        
        <Route path="/admin" element={
          <ProtectedRoute>
            {profile?.role === 'admin' ? (
              <MainLayout><PageTransition><AdminPanel /></PageTransition></MainLayout>
            ) : <Navigate to="/" />}
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const { setUser, setProfile, setWallet, setLoading } = useAuthStore();

  useEffect(() => {
    initializePushNotifications();
    let mounted = true;

    const setupAuth = async () => {
      const { data: { session: initialSession } } = await supabase.auth.getSession();
      if (initialSession?.user && mounted) {
        setUser(initialSession.user);
        syncIdentity(initialSession);
      } else {
        setLoading(false);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          syncIdentity(session);
        } else {
          setUser(null);
          setProfile(null);
          setWallet(null);
          setLoading(false);
        }
      });
      return subscription;
    };

    const syncIdentity = async (session: any) => {
      try {
         // Obtener perfil y billetera en paralelo para máxima velocidad
         const [profileRes, walletRes] = await Promise.all([
           supabase.from('profiles').select('*').eq('id', session.user.id).single(),
           supabase.from('wallets').select('*').eq('user_id', session.user.id).single()
         ]);
         
         if (profileRes.data) setProfile(profileRes.data);
         if (walletRes.data) setWallet(walletRes.data);
      } catch (e) {
         console.error("Auth Sync Error", e);
      } finally {
         if (mounted) setLoading(false);
      }
    };

    const subPromise = setupAuth();

    const backListener = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else CapApp.exitApp();
    });

    return () => {
      mounted = false;
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
