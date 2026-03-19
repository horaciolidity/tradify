import { create } from 'zustand';
import type { Profile, Wallet } from '../types';
import { supabase } from '../services/supabase';

interface AuthState {
  user: any | null;
  profile: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setUser: (user: any) => void;
  setProfile: (profile: Profile | null) => void;
  setWallet: (wallet: Wallet | null) => void;
  signOut: () => Promise<void>;
  updateBalance: (amount: number) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  wallet: null,
  loading: true,
  setLoading: (loading) => set({ loading }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setWallet: (wallet) => set({ wallet }),
  signOut: async () => {
    // 1. CLEAR LOCAL STORAGE IMMEDIATELY
    // This is the only way to definitely break the "ghost session" Loop
    localStorage.clear();
    sessionStorage.clear();
    
    // 2. Clear state locally
    set({ user: null, profile: null, wallet: null, loading: false });

    // 3. Try to notify Supabase (best effort)
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject('Timeout'), 2000))
      ]);
    } catch (e) {
      console.warn("SignOut: Server call failed or timed out, but local state was cleared.");
    }

    // 4. FORCE HARD RELOAD AND REDIRECT
    window.location.href = '/login';
  },
  updateBalance: (amount) => set((state) => {
    if (state.wallet) {
      return { wallet: { ...state.wallet, balance_usdc: state.wallet.balance_usdc + amount } };
    }
    return state;
  }),
}));
