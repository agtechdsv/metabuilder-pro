import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ProjectDashboardClient } from './ProjectDashboardClient'

interface ProjectDashboardProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function ProjectDashboard({ params }: ProjectDashboardProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Redireciona diretamente para o Studio, que agora é a central única do projeto
  redirect(`/admin/${workspace_slug}/${project_slug}/studio`)

  // Busca perfil para o Header
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  // 1. Resolve Workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspace_slug)
    .single()

  if (!workspace) notFound()

  // 2. Resolve Project
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace?.id)
    .single()

  if (!project) notFound()

  // 3. Busca Views (Casos de Uso) do Projeto
  const { data: views } = await supabase
    .from('ui_views')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  return (
    <ProjectDashboardClient 
      workspace={workspace}
      project={project}
      profile={profile}
      views={views || []}
      workspace_slug={workspace_slug}
      project_slug={project_slug}
      user={user!}
    />
  )
}
