-- ==============================================================================
-- Migration: iClub Schema & Loyalty Rules
-- Filename: 20260527000001_create_iclub_schema.sql
-- ==============================================================================

-- 1. Adicionar coluna referral_code na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Função auxiliar para gerar códigos de indicação de 8 caracteres
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := lower(substring(md5(random()::text) from 1 for 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para automatizar a geração de referral_code ao inserir novo perfil
DROP TRIGGER IF EXISTS tr_set_referral_code ON public.profiles;
CREATE TRIGGER tr_set_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION generate_referral_code();

-- Atualizar perfis existentes que estão sem código de indicação
UPDATE public.profiles
SET referral_code = lower(substring(md5(id::text || random()::text) from 1 for 8))
WHERE referral_code IS NULL;

-- 2. Tabela de Regras do iClub (iclub_rules)
CREATE TABLE IF NOT EXISTS public.iclub_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('volume_license', 'referral_discount')),
    target_count INTEGER NOT NULL,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('free_license', 'percent_discount')),
    reward_value NUMERIC(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e políticas na tabela de regras
ALTER TABLE public.iclub_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura pública de regras ativas" ON public.iclub_rules;
CREATE POLICY "Permitir leitura pública de regras ativas" 
    ON public.iclub_rules FOR SELECT 
    USING (is_active = TRUE OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ));

DROP POLICY IF EXISTS "Permitir gerenciamento total por super admins" ON public.iclub_rules;
CREATE POLICY "Permitir gerenciamento total por super admins" 
    ON public.iclub_rules FOR ALL 
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ));

-- 3. Tabela de Indicações (iclub_referrals)
CREATE TABLE IF NOT EXISTS public.iclub_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    referred_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    referred_email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('registered', 'subscribed', 'reward_applied')) DEFAULT 'registered',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e políticas na tabela de indicações
ALTER TABLE public.iclub_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de indicações pelo próprio padrinho" ON public.iclub_referrals;
CREATE POLICY "Permitir leitura de indicações pelo próprio padrinho"
    ON public.iclub_referrals FOR SELECT
    USING (referrer_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ));

DROP POLICY IF EXISTS "Permitir inserção de indicação por usuários autenticados" ON public.iclub_referrals;
CREATE POLICY "Permitir inserção de indicação por usuários autenticados"
    ON public.iclub_referrals FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Permitir atualização de indicações por super admins" ON public.iclub_referrals;
CREATE POLICY "Permitir atualização de indicações por super admins"
    ON public.iclub_referrals FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ));

-- 4. Tabela de Recompensas iClub (iclub_rewards)
CREATE TABLE IF NOT EXISTS public.iclub_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('free_license', 'percent_discount')),
    reward_value NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'applied', 'expired')) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e políticas na tabela de recompensas
ALTER TABLE public.iclub_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de recompensas pelo próprio usuário" ON public.iclub_rewards;
CREATE POLICY "Permitir leitura de recompensas pelo próprio usuário"
    ON public.iclub_rewards FOR SELECT
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ));

DROP POLICY IF EXISTS "Permitir controle de recompensas por super admins" ON public.iclub_rewards;
CREATE POLICY "Permitir controle de recompensas por super admins"
    ON public.iclub_rewards FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = TRUE
    ));

-- 5. Seeding Inicial de Regras
INSERT INTO public.iclub_rules (name, benefit_type, target_count, reward_type, reward_value, is_active)
VALUES 
    ('Licença Grátis por Volume', 'volume_license', 12, 'free_license', 1.00, true),
    ('Desconto por Indicação Ativa', 'referral_discount', 1, 'percent_discount', 5.00, true)
ON CONFLICT DO NOTHING;

-- 6. Triggers para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_iclub_rules_updated_at ON public.iclub_rules;
CREATE TRIGGER update_iclub_rules_updated_at
    BEFORE UPDATE ON public.iclub_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_iclub_referrals_updated_at ON public.iclub_referrals;
CREATE TRIGGER update_iclub_referrals_updated_at
    BEFORE UPDATE ON public.iclub_referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_iclub_rewards_updated_at ON public.iclub_rewards;
CREATE TRIGGER update_iclub_rewards_updated_at
    BEFORE UPDATE ON public.iclub_rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
