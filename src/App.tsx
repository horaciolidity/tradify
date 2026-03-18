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
  const { user, loading } = useAuthStore();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-dark flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-t-2 border-primary rounded-full animate-spin mb-8 shadow-[0_0_30px_rgba(243,186,47,0.2)]" />
        <h2 className="text-xl font-black text-white uppercase tracking-[0.3em] italic animate-pulse">Synchronizing Data</h2>
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

    // Safety timeout: If initialization takes more than 5 seconds, force loading to false
    authTimeout = setTimeout(() => {
      if (mounted && useAuthStore.getState().loading) {
        console.warn("Auth initialization timed out. Forcing UI to ready state.");
        setLoading(false);
      }
    }, 5000);

    const initAuth = async () => {
      try {
        console.log("Synchronizing Identity...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        if (mounted) setLoading(false);
      } finally {
        if (mounted) clearTimeout(authTimeout);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth Event: ${event}`);
      if (mounted) {
        if (session?.user) {
          setUser(session.user);
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            await fetchProfile(session.user.id);
          } else if (event === 'INITIAL_SESSION') {
            // Already handled by initAuth but keeping it as backup
            if (!useAuthStore.getState().profile) {
              await fetchProfile(session.user.id);
            }
          }
        } else {
          setUser(null);
          setProfile(null);
          setWallet(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(authTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      console.log("Fetching core identity data...");
      
      // Parallel fetch for speed
      const [profileResponse, walletResponse] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('wallets').select('*').eq('user_id', userId).single()
      ]);

      if (profileResponse.data) {
        setProfile(profileResponse.data);
      } else if (profileResponse.error) {
        console.warn("Profile fetch warning:", profileResponse.error.message);
      }

      if (walletResponse.data) {
        setWallet(walletResponse.data);
      } else if (walletResponse.error) {
        console.warn("Wallet fetch warning:", walletResponse.error.message);
      }

    } catch (error) {
      console.error('Hydration error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
};

export default App;
