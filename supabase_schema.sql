-- Tradify Production Schema v2 (Stable)
-- Applied: 2026-03-17

-- 1. Profiles Table
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
    address TEXT UNIQUE NOT NULL,
    balance_usdc DECIMAL(20, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Plans Table
CREATE TABLE IF NOT EXISTS public.plans (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL,
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
    tx_hash TEXT,
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

-- 8. User Tasks Table
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

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Security Function to prevent recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "Users can view their own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- Trigger for New User Enrollment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, referral_code, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'TRADIFY-' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 5)),
    CASE WHEN NEW.email = 'horaciowalterortiz@gmail.com' THEN 'admin' ELSE 'user' END
  );
  
  INSERT INTO public.wallets (user_id, address, balance_usdc)
  VALUES (
    NEW.id,
    '0x' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8)),
    0.00
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
