import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { EnumerationsClient } from './EnumerationsClient'
import { StudioSidebar } from '@/components/layout/StudioSidebar'

export default async function EnumerationsPage({
  params
}: {
  params: Promise<{ workspace_slug: string, project_slug: string }>
}) {
  const resolvedParams = await params;
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/session-expired')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', resolvedParams.workspace_slug)
    .single()

  if (!workspace) redirect('/admin')

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', resolvedParams.project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (!project) redirect(`/admin/${resolvedParams.workspace_slug}`)

  if (project.sync_status === 'draft_pending') {
    redirect(`/admin/${resolvedParams.workspace_slug}/${resolvedParams.project_slug}/sync-resolution`)
  }

  return (
    <div className="flex bg-white dark:bg-[#050505]">
      <StudioSidebar workspaceSlug={resolvedParams.workspace_slug} projectSlug={resolvedParams.project_slug} />
      
      <div className="pl-20 min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300 w-full overflow-hidden">
        
        <div className="container mx-auto p-6 flex-1 mt-8">
          <EnumerationsClient 
            projectId={project.id} 
            workspace_slug={resolvedParams.workspace_slug} 
            project_slug={resolvedParams.project_slug}
          />
        </div>
      </div>
    </div>
  )
}
