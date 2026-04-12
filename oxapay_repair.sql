-- REPARACIÓN Y OPTIMIZACIÓN DE PERSISTENCIA OXAPAY
-- Ejecuta este SQL en el Editor SQL de Supabase para asegurar que las direcciones se guarden siempre.

-- 1. Crear tabla con restricción de unicidad para evitar duplicados
CREATE TABLE IF NOT EXISTS public.oxapay_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    network TEXT NOT NULL,
    address TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USDT',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Esta línea es CRÍTICA para que el "upsert" funcione y no repita direcciones
    UNIQUE(user_id, network)
);

-- 2. Habilitar RLS pero permitir todo al Service Role (que usa el API)
ALTER TABLE public.oxapay_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.oxapay_addresses;
CREATE POLICY "Service role full access" ON public.oxapay_addresses 
FOR ALL TO service_role 
USING (true) 
WITH CHECK (true);

-- 3. Índice para búsquedas ultra rápidas
CREATE INDEX IF NOT EXISTS idx_oxapay_user_network ON public.oxapay_addresses(user_id, network);

-- 4. Notificar que el esquema está listo
COMMENT ON TABLE public.oxapay_addresses IS 'Tabla para persistencia de direcciones estáticas de OxaPay Tradify';
