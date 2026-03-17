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
    // Listen for auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
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

  const fetchProfile = async (userId: string) => {
    // In a real app, you would fetch from your Supabase tables
    // For now, we'll mock the profile and wallet if not found
    const mockProfile: any = {
      id: userId,
      email: 'user@example.com',
      full_name: 'John Doe',
      role: 'admin', // Default to admin for demo purposes
      referral_code: 'TRADIFY-123'
    };
    
    const mockWallet: any = {
      balance_usdc: 1540.25,
      address: 'Ox71C7656EC7ab88b098defB751B7401B5f6d8976F'
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
