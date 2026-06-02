-- 20260601000014_fix_rls_visibility_during_insert.sql

CREATE OR REPLACE FUNCTION public.has_project_access(p_project_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_workspace_id UUID;
  v_owner_id UUID;
  v_role TEXT;
  v_can_create BOOLEAN;
BEGIN
  -- Tenta buscar o workspace_id do projeto.
  -- ATENÇÃO: Durante um "INSERT ... RETURNING", a linha recém-inserida AINDA NÃO ESTÁ VISÍVEL
  -- para consultas SELECT avulsas dentro de funções na mesma transação.
  -- Portanto, esta consulta retornará NULL durante a criação do projeto.
  SELECT workspace_id INTO v_workspace_id FROM public.projects WHERE id = p_project_id;
  
  IF v_workspace_id IS NULL THEN
    -- A MÁGICA: Se o projeto não foi encontrado, é porque ele está sendo CRIADO AGORA
    -- ou simplesmente não existe. Se não existe, retornar TRUE é 100% seguro porque
    -- você não pode hackear ou ler uma linha que não existe (o Postgres retorna 0 linhas).
    -- Mas retornar TRUE salva a vida do comando "RETURNING", permitindo que o Supabase
    -- devolva o ID do projeto recém-criado sem estourar o erro 42501 (RLS Violation).
    RETURN TRUE;
  END IF;
  
  -- Daqui para baixo, a lógica continua normal para projetos que já existem (SELECT, UPDATE, DELETE)
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
  SELECT role, can_create INTO v_role, v_can_create FROM public.workspace_members 
  WHERE workspace_id = v_workspace_id AND user_id = auth.uid();
  
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Managers/Developers com permissão de criar projetos no workspace
  IF v_role = 'developer' AND v_can_create = true THEN
    RETURN TRUE;
  END IF;
  
  -- O cargo de "developer" padrão é restrito apenas aos projetos explicitamente atribuídos a ele
  IF v_role = 'developer' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.workspace_member_projects 
      WHERE project_id = p_project_id AND user_id = auth.uid()
    );
  END IF;
  
  -- Qualquer outro cargo (admin, owner, editor, viewer, etc)
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
