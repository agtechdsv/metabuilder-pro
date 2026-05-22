-- ==============================================================================
-- MetaBuilder PRO - Admin Control Center & Subscription Plans
-- ==============================================================================

-- 1. Adicionar coluna is_super_admin na tabela public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- 2. Tabela de Planos de Assinatura (subscription_plans)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    licenses_count INTEGER NOT NULL UNIQUE,
    price NUMERIC(10, 2) NOT NULL,
    description TEXT,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela de planos
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para planos
DROP POLICY IF EXISTS "Permitir leitura pública de planos ativos" ON public.subscription_plans;
CREATE POLICY "Permitir leitura pública de planos ativos" 
    ON public.subscription_plans FOR SELECT 
    USING (is_active = TRUE OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ));

DROP POLICY IF EXISTS "Permitir gerenciamento total por super admins" ON public.subscription_plans;
CREATE POLICY "Permitir gerenciamento total por super admins" 
    ON public.subscription_plans FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ));

-- 3. Adicionar colunas de plano em public.workspaces
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'blocked', 'pending', 'canceled'));
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;

-- 4. Seeding inicial de planos
INSERT INTO public.subscription_plans (name, licenses_count, price, description, features, is_active)
VALUES 
    ('Start', 1, 450.00, 'Ideal para profissionais autônomos ou pequenos negócios que precisam de uma licença de acesso.', '["1 Licença Ativa", "Acesso Ilimitado ao App Studio", "Conexão com Banco de Dados SQL", "Criação de Telas e BI via IA", "Exportação de Dados (CSV/PDF)", "Suporte Técnico Integrado"]'::jsonb, true),
    ('Professional', 3, 1190.00, 'Nosso plano mais popular. Perfeito para equipes em crescimento que colaboram no mesmo projeto.', '["3 Licenças Ativas", "Acesso Ilimitado ao App Studio", "Conexão com Banco de Dados SQL", "Criação de Telas e BI via IA", "Exportação de Dados (CSV/PDF)", "Suporte Técnico Integrado"]'::jsonb, true),
    ('Enterprise', 5, 1500.00, 'Para empresas consolidadas que exigem mais usuários, segurança Zero-Trust avançada e controles de BI.', '["5 Licenças Ativas", "Acesso Ilimitado ao App Studio", "Conexão com Banco de Dados SQL", "Criação de Telas e BI via IA", "Exportação de Dados (CSV/PDF)", "Suporte Técnico Integrado"]'::jsonb, true)
ON CONFLICT (licenses_count) DO UPDATE 
SET name = EXCLUDED.name, 
    price = EXCLUDED.price, 
    description = EXCLUDED.description, 
    features = EXCLUDED.features;

-- 5. Definir Alexandre como Super Admin e os demais como false
UPDATE public.profiles SET is_super_admin = FALSE;
UPDATE public.profiles SET is_super_admin = TRUE WHERE email = 'agtechtrade@gmail.com';
