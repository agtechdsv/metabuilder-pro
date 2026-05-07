import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { StudioDashboardClient } from './StudioDashboardClient'

interface StudioDashboardProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function StudioDashboard({ params }: StudioDashboardProps) {
  const { workspace_slug, project_slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Resolve Workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) notFound()

  // 2. Resolve Project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (projectError || !project) notFound()

  // 3. Busca todos os Models (Tabelas Sincronizadas) + Views associadas
  const { data: models } = await supabase
    .from('models')
    .select('*, fields(id), ui_views(slug)')
    .eq('project_id', project.id)
    .order('db_table_name', { ascending: true })

  // 4. Busca Views já criadas para mostrar no dashboard
  const { data: views } = await supabase
    .from('ui_views')
    .select('*')
    .eq('project_id', project.id)

  return (
    <StudioDashboardClient 
      workspace={workspace}
      project={project}
      models={models || []}
      views={views || []}
      workspace_slug={workspace_slug}
      project_slug={project_slug}
    />
  )
}
