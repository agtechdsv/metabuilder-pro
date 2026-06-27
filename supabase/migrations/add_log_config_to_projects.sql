-- MetaBuilderPRO: Adiciona coluna log_config na tabela projects
-- Esta coluna armazena apenas as PREFERÊNCIAS do dev (o que logar, retenção)
-- Os logs em si ficam no banco LOCAL do cliente (tabela __mb_logs)

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS log_config JSONB DEFAULT '{
    "enabled": false,
    "types": ["SQL_ERROR"],
    "retention_days": 7
  }'::jsonb;

COMMENT ON COLUMN public.projects.log_config IS 
  'Configurações de log do projeto: { enabled, types[], retention_days }. Os dados de log ficam no banco local do cliente.';
