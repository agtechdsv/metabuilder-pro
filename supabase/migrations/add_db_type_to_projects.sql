-- Tipo do banco do cliente (dialeto do SQL gerado pelo front: BI, listas, formulários).
-- Antes só o Agente CLI sabia; o front tratava todo projeto como PostgreSQL.
-- O Agente CLI passa a informar o tipo a cada sincronização (/api/metadata/sync).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS db_type text NOT NULL DEFAULT 'postgres'
  CHECK (db_type IN ('postgres', 'oracle', 'mysql', 'sqlserver'));

-- Projetos que já usam outro banco (ajuste os slugs):
-- UPDATE public.projects SET db_type = 'oracle' WHERE slug = 'vendas-ora';
