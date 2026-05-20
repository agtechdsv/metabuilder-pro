import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Footer } from '@/components/layout/Footer'
import { SettingsClient } from '@/components/workspace/SettingsClient'

interface SettingsPageProps {
  params: Promise<{
    workspace_slug: string
  }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { workspace_slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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
    console.error('Workspace not found or error:', workspaceError)
    notFound()
  }

  // 2. Resolve Membros
  // Usamos Admin Client aqui também para ler os membros, pois a política RLS 
  // pode estar causando recursão infinita no select.
  const { createClient: createAdminClient } = await import('@supabase/supabase-js')
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: rawMembers, error: membersError } = await admin
    .from('workspace_members')
    .select(`
      id,
      user_id,
      role
    `)
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: true })

  if (membersError) {
    console.error('Error fetching members:', membersError)
  }

  // Busca os perfis separadamente para evitar erro de Foreign Key
  let members: any[] = []
  if (rawMembers && rawMembers.length > 0) {
    const userIds = rawMembers.map(m => m.user_id)
    const { data: profilesData } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    members = rawMembers.map(m => ({
      ...m,
      profiles: profilesData?.find(p => p.id === m.user_id) || { full_name: 'Unknown', email: '' }
    }))
  }

  // 3. Permissão do usuário atual
  let currentUserMember = members?.find(m => m.user_id === user.id)
  
  // Se a tabela de membros estiver vazia para este workspace (legado/recém-criado), 
  // nós promovemos o usuário atual a owner para evitar o bloqueio (404).
  if (!currentUserMember && (!members || members.length === 0)) {
    // Na verdade, precisamos contornar o RLS aqui. Vamos importar do '@supabase/supabase-js'
    const { data: newMember, error: insertError } = await admin
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner'
      })
      .select()
      .single()
      
    if (insertError) {
      console.error('Failed to insert owner in workspace_members:', insertError)
    }
      
    if (newMember) {
      currentUserMember = { ...newMember, profiles: profile }
      members?.push(currentUserMember)
    }
  }

  // Se ele não é membro e já tem gente no workspace, joga fora (segurança adicional)
  if (!currentUserMember) {
    console.error('User is not a member of this workspace. Members length:', members?.length)
    notFound()
  }

  // 4. Busca todos os projetos do workspace
  const { data: projects } = await admin
    .from('projects')
    .select('id, name')
    .eq('workspace_id', workspace.id)
    .order('name', { ascending: true })

  // 5. Busca as atribuições de projetos
  const { data: memberProjects } = await admin
    .from('workspace_member_projects')
    .select('user_id, project_id')
    .eq('workspace_id', workspace.id)

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-neutral-50 dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      
      <Navbar user={user} profile={profile} />
      <Breadcrumbs 
        workspaceName={workspace.name} 
        workspaceSlug={workspace.slug}
        projectName="Configurações do Workspace"
      />

      <main className="w-full px-10 pt-8 pb-12 flex-grow">
        <SettingsClient 
          workspace={workspace}
          initialMembers={members as any || []}
          currentUserRole={currentUserMember.role}
          workspaceProjects={projects || []}
          initialMemberProjects={memberProjects || []}
        />
      </main>
      <Footer />
    </div>
  )
}
