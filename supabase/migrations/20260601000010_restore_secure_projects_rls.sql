-- 20260601000010_restore_secure_projects_rls.sql

-- 1. Remover o God Mode
DROP POLICY IF EXISTS "God mode for projects" ON public.projects;

-- 2. Garantir que as duas funções de segurança existam corretamente
-- Função para checar acesso por projeto (SELECT, UPDATE, DELETE)
CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_workspace_id UUID;
  v_owner_id UUID;
  v_role TEXT;
BEGIN
  -- Get project workspace and owner
  SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = p_project_id;
  IF v_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  SELECT owner_id INTO v_owner_id FROM public.workspaces WHERE id = v_workspace_id;
  
  -- 1. Owner of the workspace has full access
  IF auth.uid() = v_owner_id THEN
    RETURN TRUE;
  END IF;
  
  -- 2. Global guest of the workspace owner has full access
  IF EXISTS (
    SELECT 1 FROM public.owner_guests 
    WHERE owner_id = v_owner_id AND user_id = auth.uid() AND access_level = 'global'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- 3. Check workspace members role
  SELECT role INTO v_role FROM public.workspace_members 
  WHERE workspace_id = v_workspace_id AND user_id = auth.uid();
  
  -- Admin role has full access to all projects in the workspace
  IF v_role = 'admin' OR v_role = 'owner' THEN
    RETURN TRUE;
  END IF;
  
  -- Developer role is restricted to projects explicitly assigned to them
  IF v_role = 'developer' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.workspace_member_projects 
      WHERE project_id = p_project_id AND user_id = auth.uid()
    );
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para checar membro de workspace (Para INSERT)
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.owner_guests og
    JOIN public.workspaces w ON w.owner_id = og.owner_id
    WHERE w.id = p_workspace_id AND og.user_id = auth.uid() AND og.access_level = 'global'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recriar as políticas corretas e seguras
CREATE POLICY "Users can view projects based on membership"
    ON public.projects FOR SELECT
    USING (public.has_project_access(id));

CREATE POLICY "Users can update projects based on membership"
    ON public.projects FOR UPDATE
    USING (public.has_project_access(id));

CREATE POLICY "Users can delete projects based on membership"
    ON public.projects FOR DELETE
    USING (public.has_project_access(id));

CREATE POLICY "Users can insert projects into their workspaces"
    ON public.projects FOR INSERT
    WITH CHECK (
        public.is_workspace_member(workspace_id)
    );
