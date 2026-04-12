-- REPARACIÓN DEFINITIVA DE PERSISTENCIA (v2)
-- Esta versión usa TEXT para el ID para evitar errores de casting de UUID

-- Borrar si existe para limpiar cualquier estado inconsistente anterior
-- ADVERTENCIA: Esto borrará las direcciones registradas hasta ahora, pero es necesario para la estabilidad.
DROP TABLE IF EXISTS public.oxapay_addresses CASCADE;

CREATE TABLE public.oxapay_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL, -- Usamos TEXT para máxima compatibilidad
    network TEXT NOT NULL,
    address TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USDT',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, network)
);

-- Permisos totales para el Service Role
ALTER TABLE public.oxapay_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON public.oxapay_addresses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Índices de velocidad
CREATE INDEX idx_oxapay_address_search ON public.oxapay_addresses(address);
CREATE INDEX idx_oxapay_user_network_search ON public.oxapay_addresses(user_id, network);

-- Asegurar función de balance (de nuevo por si acaso)
CREATE OR REPLACE FUNCTION increment_wallet_balance(p_user_id UUID, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
    UPDATE public.wallets
    SET balance_usdc = balance_usdc + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
