-- 20260601000012_auto_assign_creator.sql

-- Cria uma função que será executada automaticamente após a inserção de um projeto
CREATE OR REPLACE FUNCTION public.tr_assign_creator_to_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o usuário atual for um 'developer' (acesso granular), ele precisa ser associado
  -- automaticamente ao projeto que acabou de criar para poder visualizá-lo e editá-lo.
  IF EXISTS (
    SELECT 1 FROM public.workspace_members 
    WHERE workspace_id = NEW.workspace_id AND user_id = auth.uid() AND role = 'developer'
  ) THEN
    INSERT INTO public.workspace_member_projects 
      (workspace_id, project_id, user_id, can_create, can_edit, can_deactivate, can_delete)
    VALUES 
      (NEW.workspace_id, NEW.id, auth.uid(), true, true, true, true)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove a trigger se ela já existir
DROP TRIGGER IF EXISTS on_project_created ON public.projects;

-- Cria a trigger para rodar logo após o INSERT no projeto
CREATE TRIGGER on_project_created
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.tr_assign_creator_to_project();
