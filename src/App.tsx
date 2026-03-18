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
  const fetchInProgress = React.useRef(false);

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
      if (fetchInProgress.current) return;
      try {
        fetchInProgress.current = true;
        setLoading(true);
        console.log("Core: Phase 1 - Initializing session...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted && session?.user) {
          console.log("Core: Session active. Phase 2 - Hydrating identity...");
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else if (mounted) {
          console.log("Core: No active session.");
          setLoading(false);
        }
      } catch (err) {
        console.error("Core Init Failure:", err);
        if (mounted) setLoading(false);
      } finally {
        fetchInProgress.current = false;
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Core Event: ${event}`);
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        
        // Prevent re-fetching if profile is already loaded for non-auth events
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          await fetchProfile(session.user.id);
        } else if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
          if (!useAuthStore.getState().profile && !useAuthStore.getState().loading) {
            await fetchProfile(session.user.id);
          }
        }
      } else {
        console.log("Core: Session Terminated.");
        setUser(null);
        setProfile(null);
        setWallet(null);
        setLoading(false);
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

      if (profileResponse.error) {
        console.error("CRITICAL: Profile fetch failed.", profileResponse.error);
        // If we have a user but no profile, the session is corrupted
        await supabase.auth.signOut();
        return;
      }

      if (profileResponse.data) {
        setProfile(profileResponse.data);
      } else {
        console.warn("Core: Missing profile metadata. Resetting...");
        await supabase.auth.signOut();
        return;
      }
      
      if (walletResponse.data) {
        setWallet(walletResponse.data);
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
