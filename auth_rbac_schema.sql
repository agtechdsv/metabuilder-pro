-- ==============================================================================
-- MetaBuilder PRO - RBAC & Workspace Members Architecture
-- Cole este script no SQL Editor do seu projeto Supabase e execute.
-- ==============================================================================

-- 1. Workspace Members (Gerenciamento da Equipe no /admin)
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'developer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- RLS: Membros podem ver quem mais está no Workspace
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view members of their workspaces" 
    ON public.workspace_members FOR SELECT 
    USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));


-- ==============================================================================
-- 2. RBAC: Grupos de Acesso (Projeto / Cliente Final)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, name)
);

-- RLS: RBAC Roles
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for project roles" 
    ON public.project_roles FOR SELECT USING (true);
CREATE POLICY "Allow ALL for authenticated on project roles" 
    ON public.project_roles FOR ALL USING (auth.role() = 'authenticated');


-- ==============================================================================
-- 3. RBAC: Associação Usuário Legado <-> Grupo de Acesso
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    external_user_id TEXT NOT NULL, -- ID do banco de dados legado (VARCHAR/TEXT para flexibilidade)
    role_id UUID NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, external_user_id) -- Um usuário tem 1 grupo por projeto (simples e escalável)
);

-- RLS: User Roles Mapping
ALTER TABLE public.project_user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for project user roles mapping" 
    ON public.project_user_roles FOR SELECT USING (true);
CREATE POLICY "Allow ALL for authenticated on project user roles" 
    ON public.project_user_roles FOR ALL USING (auth.role() = 'authenticated');


-- ==============================================================================
-- 4. RBAC: Permissões do Grupo (Quais Telas/Views o grupo acessa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.project_roles(id) ON DELETE CASCADE,
    view_id UUID NOT NULL REFERENCES public.ui_views(id) ON DELETE CASCADE,
    can_read BOOLEAN DEFAULT true,
    can_write BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_id, view_id)
);

-- RLS: Role Permissions
ALTER TABLE public.project_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for role permissions" 
    ON public.project_role_permissions FOR SELECT USING (true);
CREATE POLICY "Allow ALL for authenticated on role permissions" 
    ON public.project_role_permissions FOR ALL USING (auth.role() = 'authenticated');
