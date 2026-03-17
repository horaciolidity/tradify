import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layout/MainLayout';
import TradingDashboard from './pages/TradingDashboard';
import Investments from './pages/Investments';
import Wallet from './pages/Wallet';
import AdminPanel from './pages/AdminPanel';
import Auth from './pages/Auth';
import CustomTokens from './pages/CustomTokens';
import { useAuthStore } from './store/useAuthStore';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const { setUser, setProfile, setWallet, profile } = useAuthStore();

  useEffect(() => {
    const isMockMode = !import.meta.env.VITE_SUPABASE_URL;

    if (isMockMode) {
      // Mock session if Supabase is not configured yet
      const dummyUser = { id: 'dummy-user-id' };
      setUser(dummyUser);
      fetchProfile(dummyUser.id);
      return;
    }

    try {
      // Listen for auth changes
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
      }).catch(console.error);

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setWallet(null);
        }
      });

      return () => subscription.unsubscribe();
    } catch (error) {
      console.error('Supabase init error:', error);
    }
  }, []);

  const fetchProfile = async (userId: string) => {
    // Check if the user is the specific admin
    const session = await supabase.auth.getSession();
    const email = session.data.session?.user?.email || 'user@example.com';
    const isAdmin = email === 'horaciowalterortiz@gmail.com';

    const mockProfile: any = {
      id: userId,
      email: email,
      full_name: isAdmin ? 'Horacio Ortiz' : 'Trader User',
      role: isAdmin ? 'admin' : 'user',
      referral_code: 'TRADIFY-' + userId.slice(0, 5).toUpperCase()
    };
    
    const mockWallet: any = {
      balance_usdc: isAdmin ? 500000 : 1540.25,
      address: 'Ox' + Math.random().toString(16).slice(2, 10).toUpperCase()
    };

    setProfile(mockProfile);
    setWallet(mockWallet);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/register" element={<Auth mode="register" />} />

        {/* Protected Routes */}
        <Route path="/" element={
          <MainLayout>
            <TradingDashboard />
          </MainLayout>
        } />
        <Route path="/trading" element={
          <MainLayout>
            <TradingDashboard />
          </MainLayout>
        } />
        <Route path="/custom-token" element={
          <MainLayout>
            <CustomTokens />
          </MainLayout>
        } />
        <Route path="/investments" element={
          <MainLayout>
            <Investments />
          </MainLayout>
        } />
        <Route path="/wallet" element={
          <MainLayout>
            <Wallet />
          </MainLayout>
        } />
        <Route path="/admin" element={
          profile?.role === 'admin' ? (
            <MainLayout>
              <AdminPanel />
            </MainLayout>
          ) : <Navigate to="/" />
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
