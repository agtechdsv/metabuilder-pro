const { Client } = require('pg');

const dbConnectionString = "postgresql://postgres.chmstvtepzmjhpyxjjam:Goeta815617%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    const sql = `
      DROP POLICY IF EXISTS "Users can access projects based on membership" ON public.projects;
      DROP POLICY IF EXISTS "Users can access projects of their workspaces" ON public.projects;
      DROP POLICY IF EXISTS "Users can view projects of their workspaces" ON public.projects;
      DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
      DROP POLICY IF EXISTS "Users can view projects" ON public.projects;
      DROP POLICY IF EXISTS "Users can update projects" ON public.projects;
      DROP POLICY IF EXISTS "Users can insert projects" ON public.projects;
      DROP POLICY IF EXISTS "Users can delete projects" ON public.projects;
      
      DROP POLICY IF EXISTS "Users can view projects based on membership" ON public.projects;
      DROP POLICY IF EXISTS "Users can update projects based on membership" ON public.projects;
      DROP POLICY IF EXISTS "Users can delete projects based on membership" ON public.projects;
      DROP POLICY IF EXISTS "Users can insert projects based on workspace membership" ON public.projects;

      CREATE POLICY "Users can view projects based on membership"
          ON public.projects FOR SELECT
          USING (
              public.has_project_access(id)
          );

      CREATE POLICY "Users can update projects based on membership"
          ON public.projects FOR UPDATE
          USING (
              public.has_project_access(id)
          );

      CREATE POLICY "Users can delete projects based on membership"
          ON public.projects FOR DELETE
          USING (
              public.has_project_access(id)
          );

      CREATE POLICY "Users can insert projects based on workspace membership"
          ON public.projects FOR INSERT
          WITH CHECK (
              EXISTS (
                  SELECT 1 FROM public.workspaces w
                  WHERE w.id = workspace_id AND (
                      -- Owner
                      w.owner_id = auth.uid()
                      -- Global Guest
                      OR EXISTS (
                          SELECT 1 FROM public.owner_guests g
                          WHERE g.owner_id = w.owner_id AND g.user_id = auth.uid() AND g.access_level = 'global'
                      )
                      -- Workspace member with admin/owner role
                      OR EXISTS (
                          SELECT 1 FROM public.workspace_members m
                          WHERE m.workspace_id = w.id AND m.user_id = auth.uid() AND (m.role = 'admin' OR m.role = 'owner')
                      )
                  )
              )
          );
    `;

    console.log('Applying RLS fixes to projects table...');
    await client.query(sql);
    console.log('Success: RLS policies applied to projects table successfully!');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
