import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SyncResolutionClient from './SyncResolutionClient'
import { Navbar } from '@/components/layout/Navbar'
import { StudioSidebar } from '@/components/layout/StudioSidebar'
import { Footer } from '@/components/layout/Footer'

export default async function SyncResolutionPage(props: { params: Promise<{ workspace_slug: string, project_slug: string }> }) {
  const resolvedParams = await props.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/session-expired')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 1. Fetch Workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', resolvedParams.workspace_slug)
    .single()

  if (!workspace) redirect('/admin')

  // 2. Fetch Project and Payload
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', resolvedParams.project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (!project || project.sync_status !== 'draft_pending' || !project.last_sync_payload) {
    // Se não estiver em draft pending, manda de volta pro painel do projeto
    redirect(`/admin/${resolvedParams.workspace_slug}/${resolvedParams.project_slug}/studio`)
  }

  // 3. Fetch Missing Models
  const { data: existingModels } = await supabase
    .from('models')
    .select('id, db_table_name, display_name, is_missing')
    .eq('project_id', project.id)
    .eq('is_missing', true)

  // Modelos que não estão mais no payload
  const missingModels = existingModels || [];

  // Busca todas as tabelas (models) do projeto para podermos verificar os fields
  const { data: allModels } = await supabase
    .from('models')
    .select('id, db_table_name')
    .eq('project_id', project.id);

  const allDbTables = allModels?.map(m => m.db_table_name) || [];

  // 4. Fetch Missing Fields (de todos os models do projeto, não apenas dos models ausentes)
  const { data: existingFields } = await supabase
    .from('fields')
    .select('id, db_column_name, display_name, model_id')
    .eq('is_missing', true)
    .in('model_id', allModels?.map(m => m.id) || [])

  const incomingPayload = project.last_sync_payload;
  const incomingTableNames = incomingPayload.map((t: any) => t.name);


  const newTables = incomingTableNames.filter((name: string) => !allDbTables.includes(name));

  return (
    <div className="flex bg-white dark:bg-[#050505]">
      <StudioSidebar workspaceSlug={resolvedParams.workspace_slug} projectSlug={resolvedParams.project_slug} />
      
      <div className="pl-20 min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300 w-full overflow-hidden">
        <Navbar user={user} profile={profile} isStudio={true} />
        
        <div className="container mx-auto p-6 max-w-5xl flex-1 mt-8">
          <SyncResolutionClient 
            projectId={project.id}
            missingModels={missingModels}
            missingFields={existingFields || []}
            allModels={allModels || []}
            incomingPayload={incomingPayload}
            newTables={newTables}
            workspaceSlug={resolvedParams.workspace_slug}
            projectSlug={resolvedParams.project_slug}
          />
        </div>

        <Footer />
      </div>
    </div>
  )
}
