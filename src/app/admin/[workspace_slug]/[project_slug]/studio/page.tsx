import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { StudioDashboardClient } from './StudioDashboardClient'

interface StudioDashboardProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function StudioDashboard({ params }: StudioDashboardProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Busca perfil para o Header
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 1. Resolve Workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) {
    console.error('Workspace error in studio/page.tsx:', workspaceError)
    console.error('Workspace data:', workspace)
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
    console.error('Project error in studio/page.tsx:', projectError)
    console.error('Project data:', project)
    notFound()
  }

  // 3. Busca a role do usuário no workspace e permissões granulares de projeto
  const { data: memberData, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .maybeSingle()

  const isOwner = user.id === workspace.owner_id
  const userRole = isOwner ? 'owner' : (memberData?.role || 'guest')

  // Para convidados, verifica o nível de acesso global
  let guestAccessLevel: string | null = null
  if (!isOwner) {
    const { data: guestRecord } = await supabase
      .from('owner_guests')
      .select('access_level')
      .eq('user_id', user.id)
      .maybeSingle()
    guestAccessLevel = guestRecord?.access_level ?? null
  }

  const isGlobalGuest = guestAccessLevel === 'global'

  let canCreate = false
  let canDelete = false

  if (isOwner || isGlobalGuest || userRole === 'admin') {
    canCreate = true
    canDelete = true
  } else if (userRole === 'developer') {
    const { data: projPerm } = await supabase
      .from('workspace_member_projects')
      .select('can_create, can_delete')
      .eq('project_id', project.id)
      .eq('user_id', user.id)
      .maybeSingle()
      
    canCreate = projPerm?.can_create === true
    canDelete = projPerm?.can_delete === true
  }


  // 4. Busca todos os Models (Tabelas Sincronizadas) + Views associadas
  const { data: models } = await supabase
    .from('models')
    .select('*, fields(id), ui_views(slug)')
    .eq('project_id', project.id)
    .order('db_table_name', { ascending: true })

  // 4.1 Busca todos os Relacionamentos do Projeto (Santo Graal)
  const { data: projectRelations } = await supabase
    .from('relations')
    .select('*')
    .eq('project_id', project.id)
    .order('source', { ascending: false })
    .order('name', { ascending: true })

  // 5. Busca Views já criadas para mostrar no dashboard
  const { data: views } = await supabase
    .from('ui_views')
    .select('*')
    .eq('project_id', project.id)
    .order('name', { ascending: true })

  const viewsList = views || []
  const hasDownloads = viewsList.some(v => v.slug === 'downloads')
  if (!hasDownloads) {
    const { data: newView } = await supabase
      .from('ui_views')
      .upsert({
        project_id: project.id,
        model_id: null,
        name: 'Central de Downloads',
        slug: 'downloads',
        logic_type: 'personalizado',
        view_type: 'advanced_use_case',
        layout_config: { is_active: true }
      }, { onConflict: 'project_id, slug' })
      .select()
      .single()

    if (newView) {
      viewsList.push(newView)
    }
  }

  return (
    <StudioDashboardClient 
      workspace={workspace}
      project={project}
      models={models || []}
      views={viewsList}
      workspace_slug={workspace_slug}
      project_slug={project_slug}
      user={user}
      profile={profile}
      canCreate={canCreate}
      canDelete={canDelete}
      projectRelations={projectRelations || []}
    />
  )
}
