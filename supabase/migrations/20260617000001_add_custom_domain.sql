-- Adiciona a coluna custom_domain na tabela projects
ALTER TABLE public.projects ADD COLUMN custom_domain TEXT UNIQUE;

-- Opcional: Adicionar política para garantir que apenas o owner do workspace pode alterar o custom_domain.
-- No entanto, a tabela projects já deve estar protegida por RLS padrão.
