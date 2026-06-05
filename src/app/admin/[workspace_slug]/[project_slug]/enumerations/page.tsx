import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { EnumerationsClient } from './EnumerationsClient'

export default async function EnumerationsPage(props: { params: Promise<{ workspace_slug: string, project_slug: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', params.workspace_slug)
    .single()

  if (!workspace) redirect('/admin')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', params.project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (!project) redirect(`/admin/${params.workspace_slug}`)

  if (project.sync_status === 'draft_pending') {
    redirect(`/admin/${params.workspace_slug}/${params.project_slug}/sync-resolution`)
  }

  return (
    <EnumerationsClient 
      workspace={workspace} 
      project={project} 
      workspace_slug={params.workspace_slug} 
      project_slug={params.project_slug}
    />
  )
}
