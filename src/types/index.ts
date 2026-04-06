export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  referral_code: string;
  referred_by: string | null;
  role: UserRole;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance_usdc: number;
  oxapay_address?: string;
  created_at: string;
}

export interface Plan {
  id: number;
  name: string;
  interest_rate: number;
  duration_days: number;
  interest_period_days: number;
  min_amount: number;
  max_amount: number;
  max_simultaneous: number;
  is_active: boolean;
}

export interface Investment {
  id: string;
  user_id: string;
  plan_id: number;
  amount: number;
  start_date: string;
  end_date: string;
  last_interest_payment: string;
  status: 'active' | 'completed' | 'cancelled';
  withdrawn_amount?: number;
  plan?: Plan;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  tx_hash?: string;
  created_at: string;
}

export interface CustomToken {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  manual_price: boolean;
  volume_24h: number;
  liquidity: number;
  is_listed: boolean;
  updated_at: string;
}
