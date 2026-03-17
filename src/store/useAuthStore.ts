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
    try {
      if (import.meta.env.VITE_SUPABASE_URL) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn("SignOut failed or Supabase not configured");
    }
    set({ user: null, profile: null, wallet: null });
  },
  updateBalance: (amount) => set((state) => {
    if (state.wallet) {
      return { wallet: { ...state.wallet, balance_usdc: state.wallet.balance_usdc + amount } };
    }
    return state;
  }),
}));
