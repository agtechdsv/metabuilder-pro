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

import { getStudioTeamData } from '@/app/actions/workspace'

/**
 * MetaBuilderPRO - Dashboard Global
 * A primeira tela que o usuário vê após o login.
 */
export default async function GlobalDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  // Busca os Workspaces do usuário
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*, projects(count)')
    .order('created_at', { ascending: false })

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

  if (!isSuperAdmin && !isGuest) {
    if (activeWorkspaces.length === 0) {
      // Se não possui nenhum workspace ativo (nem como dono, nem como convidado),
      // precisamos verificar se ele possui uma assinatura válida para poder criar um.
      // Redireciona para o checkout se não tiver plano, ou se estiver bloqueado/pendente.
      const hasValidPlan = profile?.plan_id && profile?.subscription_status === 'active';
      
      if (!hasValidPlan) {
        redirect('/checkout')
      }
    }
  }

  // Se tiver exatamente 1 workspace ativo, redireciona diretamente para ele
  if (activeWorkspaces.length === 1) {
    redirect(`/admin/${activeWorkspaces[0].slug}`)
  }

  // Busca planos de assinatura ativos
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })

  // Busca dados globais da equipe para o WorkspaceManager
  const teamDataResult = await getStudioTeamData()
  const teamData = teamDataResult.success ? teamDataResult.data : null

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
          plans={plans || []}
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
