-- ==============================================================================
-- Migration: Move Billing to Profile & Add Account Members (owner_guests)
-- Filename: 20260522000003_billing_to_profile.sql
-- ==============================================================================

-- 1. Adicionar colunas de Faturamento na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'blocked', 'pending', 'canceled'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_cycle TEXT CHECK (subscription_cycle IN ('monthly', 'quarterly', 'semiannual', 'yearly'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS asaas_subscription_id TEXT;

-- 2. Migrar os dados existentes e limpar tabela workspaces
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'plan_id') THEN
    
    -- Atualiza o profile pegando a assinatura do primeiro workspace encontrado daquele owner
    EXECUTE '
      UPDATE public.profiles p
      SET 
        plan_id = w.plan_id,
        subscription_status = w.subscription_status,
        is_blocked = w.is_blocked,
        subscription_cycle = w.subscription_cycle,
        subscription_expires_at = w.subscription_expires_at,
        asaas_customer_id = w.asaas_customer_id,
        asaas_subscription_id = w.asaas_subscription_id
      FROM (
        SELECT DISTINCT ON (owner_id) 
          owner_id, plan_id, subscription_status, is_blocked, subscription_cycle, 
          subscription_expires_at, asaas_customer_id, asaas_subscription_id
        FROM public.workspaces
        WHERE asaas_subscription_id IS NOT NULL OR plan_id IS NOT NULL
        ORDER BY owner_id, created_at ASC
      ) w
      WHERE p.id = w.owner_id
    ';

    -- 3. Remover as colunas de faturamento da tabela workspaces
    -- Atenção: Isso é destrutivo!
    ALTER TABLE public.workspaces DROP COLUMN IF EXISTS plan_id;
    ALTER TABLE public.workspaces DROP COLUMN IF EXISTS subscription_status;
    ALTER TABLE public.workspaces DROP COLUMN IF EXISTS is_blocked;
    ALTER TABLE public.workspaces DROP COLUMN IF EXISTS subscription_cycle;
    ALTER TABLE public.workspaces DROP COLUMN IF EXISTS subscription_expires_at;
    ALTER TABLE public.workspaces DROP COLUMN IF EXISTS asaas_customer_id;
    ALTER TABLE public.workspaces DROP COLUMN IF EXISTS asaas_subscription_id;
    
  END IF;
END $$;

-- 4. Modificar a tabela payments
-- Alterar constraint de NOT NULL se existisse (no script original era FK, não tinha NOT NULL explícito pro workspace_id, mas deixamos claro)
ALTER TABLE public.payments ALTER COLUMN workspace_id DROP NOT NULL;

-- 5. Criar a tabela owner_guests (Membros da Conta / Global Guests)
CREATE TABLE IF NOT EXISTS public.owner_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    access_level TEXT DEFAULT 'granular' CHECK (access_level IN ('global', 'granular')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(owner_id, user_id)
);

-- Habilitar RLS para owner_guests
ALTER TABLE public.owner_guests ENABLE ROW LEVEL SECURITY;

-- Políticas para owner_guests
DROP POLICY IF EXISTS "Owner pode ver seus convidados" ON public.owner_guests;
CREATE POLICY "Owner pode ver seus convidados"
    ON public.owner_guests FOR SELECT
    USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Convidado pode ver seus próprios vínculos" ON public.owner_guests;
CREATE POLICY "Convidado pode ver seus próprios vínculos"
    ON public.owner_guests FOR SELECT
    USING (auth.uid() = user_id);

-- 5.1 Criar função Security Definer para checar global_guest evitando recursão
CREATE OR REPLACE FUNCTION public.is_global_guest(workspace_owner_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.owner_guests
    WHERE owner_id = $1 AND user_id = auth.uid() AND access_level = 'global'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 6. Atualizar a Política de Acesso de Workspaces para considerar 'global' guests
-- Drop policy antiga se existir
DROP POLICY IF EXISTS "Users can access their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can access their workspaces or invited" ON public.workspaces;
DROP POLICY IF EXISTS "Users can access workspaces" ON public.workspaces;

-- Criar nova policy unificada evitando recursão
CREATE POLICY "Users can access workspaces"
    ON public.workspaces FOR ALL
    USING (
        -- O usuário logado é o dono
        auth.uid() = owner_id 
        OR 
        -- Ou ele foi explicitamente adicionado na workspace_members (granular)
        -- (usando a função existente que é security definer para evitar recursão)
        public.is_workspace_member(id)
        OR
        -- Ou ele é um convidado global do dono deste workspace
        public.is_global_guest(owner_id)
    );

-- Fazer o mesmo para Projects (se a policy deles já existia, ajustamos para considerar global)
DROP POLICY IF EXISTS "Users can access projects of their workspaces" ON public.projects;
CREATE POLICY "Users can access projects of their workspaces"
    ON public.projects FOR ALL
    USING (
        -- É membro granular do workspace
        public.is_workspace_member(workspace_id) 
        OR
        -- Ou o dono logado está tentando acessar os projetos de seu próprio workspace
        EXISTS (
            SELECT 1 FROM public.workspaces 
            WHERE id = workspace_id AND owner_id = auth.uid()
        )
        OR
        -- Ou o usuário logado é um convidado global do dono deste workspace
        -- Como o projeto só tem workspace_id, precisamos da subquery com security definer
        EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = workspace_id AND public.is_global_guest(w.owner_id)
        )
    );
