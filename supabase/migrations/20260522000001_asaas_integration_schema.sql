-- ==============================================================================
-- Migration: Asaas Subscription Integration & Multicyle Pricing
-- Filename: 20260522000001_asaas_integration_schema.sql
-- ==============================================================================

-- 1. Alterar public.subscription_plans para suportar múltiplos ciclos
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10, 2);
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_quarterly NUMERIC(10, 2);
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_semiannually NUMERIC(10, 2);
ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS price_yearly NUMERIC(10, 2);

-- Migrar preços atuais e calcular valores com desconto (~10% trimestral, ~15% semestral, ~20% anual)
UPDATE public.subscription_plans
SET 
    price_monthly = COALESCE(price_monthly, price),
    price_quarterly = COALESCE(price_quarterly, ROUND(price * 3 * 0.90, 2)),
    price_semiannually = COALESCE(price_semiannually, ROUND(price * 6 * 0.85, 2)),
    price_yearly = COALESCE(price_yearly, ROUND(price * 12 * 0.80, 2))
WHERE price IS NOT NULL;

-- 2. Alterar public.workspaces para incluir dados do Asaas e vencimento
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS subscription_cycle TEXT CHECK (subscription_cycle IN ('monthly', 'quarterly', 'semiannual', 'yearly'));
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

-- 3. Criar a tabela de pagamentos (payments)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    cycle TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',
    external_reference TEXT UNIQUE NOT NULL,
    billing_type TEXT,
    idempotency_key TEXT,
    invoice_url TEXT,
    asaas_payment_id TEXT,
    asaas_response JSONB DEFAULT '{}'::jsonb,
    webhook_payload JSONB DEFAULT '{}'::jsonb,
    webhook_received_at TIMESTAMP WITH TIME ZONE,
    webhook_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela de pagamentos
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para pagamentos
DROP POLICY IF EXISTS "Permitir leitura de pagamentos do próprio workspace" ON public.payments;
CREATE POLICY "Permitir leitura de pagamentos do próprio workspace"
    ON public.payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = payments.workspace_id AND w.owner_id = auth.uid()
        )
    );

-- Trigger para atualizar updated_at automaticamente na tabela payments
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
