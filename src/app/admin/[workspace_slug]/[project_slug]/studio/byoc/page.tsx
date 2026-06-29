import { ByocClient } from './ByocClient'

export default async function ByocPage({ params }: { params: Promise<{ project_slug: string, workspace_slug: string }> }) {
  const { project_slug, workspace_slug } = await params
  
  return (
    <div className="w-full h-full p-8 bg-neutral-50/50">
       <ByocWrapper projectSlug={project_slug} workspaceSlug={workspace_slug} />
    </div>
  )
}

import { createClient } from '@/utils/supabase/server'

async function ByocWrapper({ projectSlug, workspaceSlug }: { projectSlug: string, workspaceSlug: string }) {
  const supabase = await createClient()
  
  const { data: workspace } = await supabase.from('workspaces').select('id').eq('slug', workspaceSlug).single()
  if (!workspace) return <div>Workspace não encontrado</div>

  const { data: project } = await supabase.from('projects').select('id').eq('slug', projectSlug).eq('workspace_id', workspace.id).single()

  if (!project) return <div>Projeto não encontrado</div>

  return <ByocClient projectId={project.id} />
}
