-- 20260601000009_god_mode_test.sql

-- 1. Removemos TODAS as possíveis políticas que possam existir na tabela projects
DROP POLICY IF EXISTS "Users can access projects of their workspaces" ON public.projects;
DROP POLICY IF EXISTS "Users can access projects based on membership" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects based on membership" ON public.projects;
DROP POLICY IF EXISTS "Users can update projects based on membership" ON public.projects;
DROP POLICY IF EXISTS "Users can delete projects based on membership" ON public.projects;
DROP POLICY IF EXISTS "Users can insert projects into their workspaces" ON public.projects;

-- 2. Criamos uma política "God Mode" que permite TUDO
CREATE POLICY "God mode for projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
