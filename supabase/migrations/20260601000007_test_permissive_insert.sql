-- 20260601000007_test_permissive_insert.sql

DROP POLICY IF EXISTS "Users can insert projects into their workspaces" ON public.projects;

CREATE POLICY "Users can insert projects into their workspaces"
    ON public.projects FOR INSERT
    WITH CHECK (true);
