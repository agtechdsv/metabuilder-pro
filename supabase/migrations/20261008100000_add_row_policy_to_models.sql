-- Acesso por linha do usuário final, por tabela (Studio > Dados & Schemas > "Acesso por linha").
-- Formato: { "rules": [ { "id", "column", "op": "eq|in|related", "source": "user.email|user.name|user.attr", "attr",
--                          "related": { "table", "key", "column" }, "bypass": { "source", "attr", "values": [...] } } ] }
-- Sem valor (NULL) a tabela não tem regra: todos os usuários veem todas as linhas (comportamento anterior).
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS row_policy jsonb;

COMMENT ON COLUMN public.models.row_policy IS 'Regras de acesso por linha do usuário final (aplicadas pelo servidor e pelo Agente CLI).';
