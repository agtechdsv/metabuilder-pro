import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { SettingsDashboardClient } from './SettingsDashboardClient'

interface SettingsDashboardProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function SettingsDashboard({ params }: SettingsDashboardProps) {
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
    notFound()
  }

  // 3. Busca todos os Models com Fields
  const { data: models } = await supabase
    .from('models')
    .select('*, fields(*)')
    .eq('project_id', project.id)
    .order('db_table_name', { ascending: true })

  // 4. Busca relations e enumerations para passar ao client (usado no Drawer de configs)
  const { data: relations } = await supabase
    .from('relations')
    .select('*')
    .eq('project_id', project.id)

  const { data: enumerations } = await supabase
    .from('project_enumerations')
    .select('id, name, values')
    .eq('project_id', project.id)

  return (
    <SettingsDashboardClient
      workspace={workspace}
      project={project}
      models={models || []}
      relations={relations || []}
      enumerations={enumerations || []}
      workspace_slug={workspace_slug}
      project_slug={project_slug}
    />
  )
}
