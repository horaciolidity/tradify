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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });

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
  }, []);

  const fetchProfile = async (userId: string, retries = 3) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code === 'PGRST116' && retries > 0) {
        // Wait 1 second and retry (for trigger lag)
        setTimeout(() => fetchProfile(userId, retries - 1), 1000);
        return;
      }

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      // 2. Fetch Wallet
      let { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (walletError && walletError.code !== 'PGRST116') {
        throw walletError;
      }

      if (profileData) {
        setProfile(profileData);
      }
      if (walletData) {
        setWallet(walletData);
      }
    } catch (error) {
      console.error('Error fetching real data:', error);
    }
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
