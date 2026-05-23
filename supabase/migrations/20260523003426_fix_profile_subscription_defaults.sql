-- Alterar os valores padrões da tabela profiles para garantir segurança por padrão.
-- Novos perfis são criados como pendentes e bloqueados, exigindo pagamento imediato no checkout para ativação.

ALTER TABLE public.profiles ALTER COLUMN subscription_status SET DEFAULT 'pending';
ALTER TABLE public.profiles ALTER COLUMN is_blocked SET DEFAULT true;

-- Adicionalmente, vamos corrigir qualquer usuário que já esteja no banco com o status errado (criado recentemente), exceto super admins
UPDATE public.profiles 
SET subscription_status = 'pending', is_blocked = true 
WHERE plan_id IS NULL AND subscription_status = 'active' AND is_super_admin = false;
