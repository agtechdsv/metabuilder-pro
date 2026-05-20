-- 1. Tabela de Workspaces (Empresas)
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para Workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own workspaces" 
    ON public.workspaces FOR ALL 
    USING (auth.uid() = owner_id);

-- 2. Função SECURITY DEFINER para checar membro sem causar loop infinito (RLS bypass)
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = p_workspace_id
        AND workspace_members.user_id = auth.uid()
    );
$$;

-- 3. Política para visualização usando a função segura
CREATE POLICY "Users can view workspaces they are members of"
    ON public.workspaces FOR SELECT
    USING (
        auth.uid() = owner_id OR public.is_workspace_member(id)
    );

-- 2. Garantir que Projects aponte para Workspace
-- Se a coluna já existir, ele apenas ignora o erro.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='workspace_id') THEN
        ALTER TABLE public.projects ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='slug') THEN
        ALTER TABLE public.projects ADD COLUMN slug TEXT;
    END IF;
END $$;

-- 3. Índice para performance de busca por slug
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON public.projects(slug);
