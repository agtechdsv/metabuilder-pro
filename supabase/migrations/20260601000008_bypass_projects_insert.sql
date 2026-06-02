-- 20260601000008_bypass_projects_insert.sql

-- Se o script anterior falhou por erro de sintaxe, o banco ficou SEM regra de INSERT e bloqueou tudo.
-- Este script limpa a regra quebrada e cria uma regra limpa usando a função is_workspace_member que já sabíamos que funcionava (ou cria ela caso não exista).

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

DROP POLICY IF EXISTS "Users can insert projects into their workspaces" ON public.projects;

CREATE POLICY "Users can insert projects into their workspaces"
ON public.projects FOR INSERT
WITH CHECK (
    public.is_workspace_member(workspace_id)
);
