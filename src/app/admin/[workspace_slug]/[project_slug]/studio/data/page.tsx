import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { DataDashboardClient } from './DataDashboardClient'

interface DataDashboardProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function DataDashboard({ params }: DataDashboardProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/session-expired')

  // 1. Resolve Workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) {
    console.error('Workspace error in studio/data/page.tsx:', workspaceError)
    notFound()
  }

  // 2. Resolve Project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (projectError || !project) {
    console.error('Project error in studio/data/page.tsx:', projectError)
    notFound()
  }

  // 3. Busca todos os Models (Tabelas Sincronizadas) + Fields + Views
  const { data: models } = await supabase
    .from('models')
    .select('*, fields(id), ui_views(slug)')
    .eq('project_id', project.id)
    .order('db_table_name', { ascending: true })

  return (
    <DataDashboardClient
      workspace={workspace}
      project={project}
      models={models || []}
      workspace_slug={workspace_slug}
      project_slug={project_slug}
    />
  )
}
