-- 20260601000011_fix_has_project_access_logic.sql

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
  
  -- Se o usuário não tem cargo no workspace, ele não tem acesso
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- O cargo de "developer" é restrito apenas aos projetos explicitamente atribuídos a ele
  IF v_role = 'developer' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.workspace_member_projects 
      WHERE project_id = p_project_id AND user_id = auth.uid()
    );
  END IF;
  
  -- Qualquer outro cargo (admin, owner, editor, viewer, etc) tem acesso aos projetos do workspace
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
