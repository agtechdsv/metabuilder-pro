const { Client } = require('pg');

const dbConnectionString = "postgresql://postgres.chmstvtepzmjhpyxjjam:Goeta815617%40@aws-1-sa-east-1.pooler.supabase.com:6543/postgres";

async function run() {
  const client = new Client({ connectionString: dbConnectionString });
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database.');

    const sql = `
      CREATE TABLE IF NOT EXISTS public.project_enumerations (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          values JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(project_id, name)
      );

      ALTER TABLE public.project_enumerations ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can view enumerations of their projects" ON public.project_enumerations;
      DROP POLICY IF EXISTS "Users can insert enumerations to their projects" ON public.project_enumerations;
      DROP POLICY IF EXISTS "Users can update enumerations of their projects" ON public.project_enumerations;
      DROP POLICY IF EXISTS "Users can delete enumerations of their projects" ON public.project_enumerations;

      CREATE POLICY "Users can view enumerations of their projects" 
          ON public.project_enumerations FOR SELECT 
          USING (
            EXISTS (
              SELECT 1 FROM public.projects p
              WHERE p.id = project_enumerations.project_id
              AND public.has_project_access(p.id, p.workspace_id)
            )
          );

      CREATE POLICY "Users can insert enumerations to their projects" 
          ON public.project_enumerations FOR INSERT 
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.projects p
              WHERE p.id = project_id
              AND public.has_project_access(p.id, p.workspace_id)
            )
          );

      CREATE POLICY "Users can update enumerations of their projects" 
          ON public.project_enumerations FOR UPDATE 
          USING (
            EXISTS (
              SELECT 1 FROM public.projects p
              WHERE p.id = project_enumerations.project_id
              AND public.has_project_access(p.id, p.workspace_id)
            )
          );

      CREATE POLICY "Users can delete enumerations of their projects" 
          ON public.project_enumerations FOR DELETE 
          USING (
            EXISTS (
              SELECT 1 FROM public.projects p
              WHERE p.id = project_enumerations.project_id
              AND public.has_project_access(p.id, p.workspace_id)
            )
          );
    `;

    console.log('Creating project_enumerations table and applying RLS policies...');
    await client.query(sql);
    console.log('Success: Table and policies created successfully!');
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await client.end();
  }
}

run();
