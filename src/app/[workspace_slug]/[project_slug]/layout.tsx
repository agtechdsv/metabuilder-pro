import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { RuntimeLayoutClient } from '@/components/runtime/RuntimeLayoutClient'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  // 1. Resolve Workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) notFound()

  // 2. Resolve Project (incluindo navegação)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (projectError || !project) notFound()

  // Se o projeto não tiver navegação, vamos garantir que seja um array vazio
  const navigation = project.navigation || []

  return (
    <RuntimeLayoutClient
      project={project}
      workspaceSlug={workspace_slug}
      projectSlug={project_slug}
      navigation={navigation}
    >
      {children}
    </RuntimeLayoutClient>
  )
}
