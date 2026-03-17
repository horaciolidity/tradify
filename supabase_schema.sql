-- Tradify Database Schema
-- To be executed in Supabase SQL Editor

-- 1. Profiles Table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES public.profiles(id),
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    address TEXT UNIQUE NOT NULL, -- Internal simulated address
    balance_usdc DECIMAL(20, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Plans Table (Investment Tiers)
CREATE TABLE IF NOT EXISTS public.plans (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL, -- Percentage
    duration_days INTEGER NOT NULL,
    interest_period_days INTEGER DEFAULT 15,
    min_amount DECIMAL(20, 2) NOT NULL,
    max_amount DECIMAL(20, 2) NOT NULL,
    max_simultaneous INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Investments Table
CREATE TABLE IF NOT EXISTS public.investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES public.plans(id),
    amount DECIMAL(20, 2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    last_interest_payment TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('deposit', 'withdrawal', 'investment', 'profit', 'referral', 'reward')),
    amount DECIMAL(20, 2) NOT NULL,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    description TEXT,
    tx_hash TEXT, -- For future real blockchain integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.profiles(id),
    referred_id UUID REFERENCES public.profiles(id),
    commission_earned DECIMAL(20, 2) DEFAULT 0.00,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    reward_amount DECIMAL(20, 2) DEFAULT 0.00,
    task_type TEXT CHECK (task_type IN ('daily_login', 'referral', 'investment', 'custom')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. User Tasks Table (Tracking)
CREATE TABLE IF NOT EXISTS public.user_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES public.tasks(id),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Custom Tokens Table
CREATE TABLE IF NOT EXISTS public.custom_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    symbol TEXT NOT NULL UNIQUE,
    current_price DECIMAL(20, 8) DEFAULT 1.00,
    manual_price BOOLEAN DEFAULT TRUE,
    volume_24h DECIMAL(20, 2) DEFAULT 0.00,
    liquidity DECIMAL(20, 2) DEFAULT 0.00,
    is_listed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Admin Settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security) - Basic setup
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- Initial Plans Data
INSERT INTO public.plans (name, interest_rate, duration_days, interest_period_days, min_amount, max_amount, max_simultaneous) VALUES
('Plan 1', 6.00, 60, 15, 70, 220, 3),
('Plan 2', 9.00, 60, 15, 250, 700, 5),
('Plan 3', 12.00, 30, 15, 800, 2300, 5),
('Plan 4', 16.00, 30, 15, 2500, 7000, 5),
('Plan 5', 21.00, 15, 15, 8000, 23000, 6);

-- Initial Admin Settings
INSERT INTO public.admin_settings (key, value) VALUES
('pool_guaranteed', '{"amount": 500000, "currency": "USDC"}'),
('referral_commissions', '{"level1": 5, "level2": 3, "level3": 1}');
