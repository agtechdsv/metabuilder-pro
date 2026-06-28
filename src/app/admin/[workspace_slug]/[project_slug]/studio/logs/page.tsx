import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import LogsDashboardClient from './LogsDashboardClient'

interface LogsPageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function LogsPage({ params }: LogsPageProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) notFound()

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (projectError || !project) notFound()

  return (
    <LogsDashboardClient
      workspace={workspace}
      project={project}
      workspace_slug={workspace_slug}
      project_slug={project_slug}
    />
  )
}
