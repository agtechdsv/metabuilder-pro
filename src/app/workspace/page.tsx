import { createClient } from '@/utils/supabase/server'
import { 
  Building2, 
  Plus, 
  ArrowUpRight, 
  LayoutGrid, 
  Users, 
  Activity,
  ChevronRight,
  Search
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { WorkspaceManager } from '@/components/workspace/WorkspaceManager'
import { Footer } from '@/components/layout/Footer'
import { WorkspaceTunnelControl } from '@/components/workspace/WorkspaceTunnelControl'

import { getStudioTeamData } from '@/app/actions/workspace'

/**
 * MetaBuilderPRO - Dashboard Global
 * A primeira tela que o usuário vê após o login.
 */
export default async function GlobalDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { verifyMfaPolicy } = await import('@/app/auth/actions')
  const mfaRes = await verifyMfaPolicy()
  if (mfaRes.mfaSetupRequired) redirect('/login/mfa/setup')
  if (mfaRes.mfaChallengeRequired) redirect(`/login/mfa?factorId=${mfaRes.factorId}`)

  // Enforce password setup if required
  if (user.user_metadata?.need_password_setup === true) {
    const { data: memberWs } = await supabase
      .from('workspace_members')
      .select('workspaces(slug)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    const wsSlug = (memberWs?.workspaces as any)?.slug || 'default'
    redirect(`/auth/set-password?workspace_slug=${wsSlug}`)
  }

  // Busca perfil para o Header
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Verifica se o usuário é um convidado (guest)
  const { data: guestRecord } = await supabase
    .from('owner_guests')
    .select('access_level')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const isGuest = !!guestRecord
  const guestAccessLevel = guestRecord?.access_level || null

  // Busca a role e permissões do convidado nos workspaces
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, can_create, can_edit, can_delete')
    .eq('user_id', user.id)

  const isGlobalGuest = guestAccessLevel === 'global'

  // Busca os Workspaces do usuário
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*, projects(count)')
    .order('created_at', { ascending: false })

  if (workspaces) {
    workspaces.forEach(w => {
      const isOwner = user.id === w.owner_id
      const mem = memberships?.find(m => m.workspace_id === w.id)
      w.can_edit = isOwner || isGlobalGuest || mem?.can_edit === true
      w.can_delete = isOwner || isGlobalGuest || mem?.can_delete === true
    })
  }

  // 1. Verificar se o usuário possui assinaturas ativas (ou se é Super Admin)
  const isSuperAdmin = profile?.is_super_admin === true
  
  // Buscar os profiles dos donos manualmente para evitar erro de Foreign Key
  let activeWorkspaces = []
  
  if (workspaces && workspaces.length > 0) {
    const ownerIds = Array.from(new Set(workspaces.map(w => w.owner_id)))
    const { data: ownersProfiles } = await supabase
      .from('profiles')
      .select('id, subscription_status, is_blocked')
      .in('id', ownerIds)
      
    const ownersMap = new Map(ownersProfiles?.map(o => [o.id, o]) || [])
    
    // Anexa o profile do owner no workspace para manter compatibilidade
    workspaces.forEach(w => {
      w.profiles = ownersMap.get(w.owner_id) || null
    })
    
    activeWorkspaces = workspaces.filter(w => {
      const ownerProfile = w.profiles
      return !ownerProfile?.is_blocked && (ownerProfile?.subscription_status === 'active' || ownerProfile?.subscription_status === 'canceled')
    })
  }

  // Free tier users stay on /workspace — no redirect to /checkout



  // Busca regras de precificação ativas
  const { data: pricingRules } = await supabase
    .from('pricing_rules')
    .select('*')
    .single()

  // Busca dados globais da equipe para o WorkspaceManager
  const teamDataResult = await getStudioTeamData()
  const teamData = teamDataResult.success ? teamDataResult.data : null

  let totalActiveMembers = teamData ? (teamData.activeGuests || 0) + 1 : 1; // +1 for the owner
  let totalPendingMembers = teamData ? (teamData.pendingGuests || 0) : 0;
  
  if (isGuest) {
    const { createClient: createAdminClient } = await import('@/utils/supabase/server')
    const supabaseAdmin = await createAdminClient()
    
    // Descobre de quem este usuário é convidado
    const { data: myGuestRecords } = await supabaseAdmin
      .from('owner_guests')
      .select('owner_id')
      .eq('user_id', user.id);
      
    if (myGuestRecords && myGuestRecords.length > 0) {
      const ownerIds = Array.from(new Set(myGuestRecords.map(r => r.owner_id)));
      
      // Conta o total de convidados de todos os donos que o usuário faz parte
      const { data: ownersGuests } = await supabaseAdmin
        .from('owner_guests')
        .select('id, user_id')
        .in('owner_id', ownerIds);

      let pendingCount = 0;
      if (ownersGuests && ownersGuests.length > 0) {
        const guestUserIds = ownersGuests.map(g => g.user_id);
        const authUsers = await Promise.all(
          guestUserIds.map((id: string) => supabaseAdmin.auth.admin.getUserById(id).then((res: any) => res.data?.user).catch(() => null))
        );
        pendingCount = authUsers.filter(u => u && !u.last_sign_in_at).length;
      }
        
      totalActiveMembers = ownerIds.length + ((ownersGuests?.length || 0) - pendingCount);
      totalPendingMembers = pendingCount;
    }
  }

  const emailPrefix = user.email?.split('@')[0] || 'Usuário'
  const capitalizedUserName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />

      <main className="w-full mx-auto px-10 pt-4 pb-4 space-y-6 flex-grow">
        
        {/* Gerenciador de Workspaces (Lista + Drawers) */}
        <WorkspaceManager 
          initialWorkspaces={workspaces || []} 
          userName={capitalizedUserName} 
          teamData={teamData}
          totalActiveMembers={totalActiveMembers}
          totalPendingMembers={totalPendingMembers}
          rules={pricingRules}
          user={user}
          profile={profile}
          isGuest={isGuest}
          initialGuestAccessLevel={guestAccessLevel as any}
        />

      </main>
      <Footer />
    </div>
  )
}
