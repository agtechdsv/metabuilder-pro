import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { 
  ArrowLeft,
  Box,
  Settings
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { ProjectManager } from '@/components/workspace/ProjectManager'
import { Footer } from '@/components/layout/Footer'
import { WorkspaceTunnelControl } from '@/components/workspace/WorkspaceTunnelControl'

interface WorkspaceDashboardProps {
  params: Promise<{
    workspace_slug: string
  }>
}

export default async function WorkspaceDashboard({ params }: WorkspaceDashboardProps) {
  const { workspace_slug } = await params
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

  if (workspaceError || !workspace) notFound()

  // 2. Busca Projetos deste Workspace
  const { data: projects } = await supabase
    .from('projects')
    .select('*, models(count)')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })

  // 3. Busca a role e permissões do usuário logado neste workspace
  const { data: memberData } = await supabase
    .from('workspace_members')
    .select('role, can_create, can_delete')
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

  // Busca as permissões específicas do usuário nos projetos deste workspace
  const { data: projectPermissions } = await supabase
    .from('workspace_member_projects')
    .select('project_id, can_create, can_edit, can_deactivate, can_delete')
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)

  // Map individual permissions to each project
  const mappedProjects = (projects || []).map(project => {
    const perm = projectPermissions?.find(p => p.project_id === project.id)
    return {
      ...project,
      can_create: isOwner || isGlobalGuest || userRole === 'admin' || perm?.can_create === true,
      can_edit: isOwner || isGlobalGuest || userRole === 'admin' || perm?.can_edit === true,
      can_deactivate: isOwner || isGlobalGuest || userRole === 'admin' || perm?.can_deactivate === true,
      can_delete: isOwner || isGlobalGuest || userRole === 'admin' || perm?.can_delete === true
    }
  })

  // Owner e Global Guest têm permissão total; granular respeita as colunas do workspace_members
  const canCreateProjects = isOwner || isGlobalGuest || userRole === 'admin' || memberData?.can_create === true
  const canDeleteProjects = isOwner || isGlobalGuest || userRole === 'admin' || memberData?.can_delete === true

  // Exibe "Equipe & Configurações" apenas para owner ou global guest
  const showTeamSettings = isOwner || isGlobalGuest

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      
      <Navbar user={user} profile={profile} />
      <Breadcrumbs 
        workspaceName={workspace.name} 
        workspaceSlug={workspace.slug} 
      />

      <main className="w-full px-10 pt-4 pb-4 flex-grow">
        
        <WorkspaceTunnelControl workspaceSlug={workspace.slug} />

        <ProjectManager 
          initialProjects={mappedProjects} 
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
          workspaceThemeConfig={workspace.theme_config || {}}
          workspaceCustomDomain={workspace.custom_domain || ''}
          canCreate={canCreateProjects}
          canDelete={canDeleteProjects}
          showTeamSettings={showTeamSettings}
        />

      </main>
      <Footer />
    </div>
  )
}
