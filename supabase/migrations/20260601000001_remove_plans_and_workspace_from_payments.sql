-- ==============================================================================
-- Migration: Remove workspace_id from payments and drop subscription_plans
-- ==============================================================================

-- 1. Remove Foreign Key para workspace_id na tabela payments
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_workspace_id_fkey;

-- 2. Remove Foreign Key para plan_id na tabela payments (caso exista)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_plan_id_fkey;

-- 2.5 Atualizar a política RLS antes de excluir a coluna (remover a dependência)
DROP POLICY IF EXISTS "Permitir leitura de pagamentos do próprio workspace" ON public.payments;

CREATE POLICY "Permitir usuário ler próprios pagamentos"
    ON public.payments FOR SELECT
    USING (user_id = auth.uid());

-- 3. Remove a coluna workspace_id da tabela payments
ALTER TABLE public.payments DROP COLUMN IF EXISTS workspace_id CASCADE;

-- 4. Remove a coluna plan_id da tabela payments (por precaução)
ALTER TABLE public.payments DROP COLUMN IF EXISTS plan_id;

-- 5. Remover referências a plan_id de outras tabelas (se existirem)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS plan_id CASCADE;
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS plan_id CASCADE;

-- 6. Dropar a tabela subscription_plans inteiramente
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
