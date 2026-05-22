-- Alterar os valores padrões da tabela workspaces para garantir segurança por padrão.
-- Novas workspaces são criadas como pendentes e bloqueadas, exigindo pagamento imediato no checkout para ativação.
ALTER TABLE public.workspaces ALTER COLUMN subscription_status SET DEFAULT 'pending';
ALTER TABLE public.workspaces ALTER COLUMN is_blocked SET DEFAULT true;
