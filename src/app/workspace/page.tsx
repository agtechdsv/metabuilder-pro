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

/**
 * MetaBuilderPRO - Dashboard Global
 * A primeira tela que o usuário vê após o login.
 */
export default async function GlobalDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Busca perfil para o Header
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Busca os Workspaces do usuário
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*, projects(count)')
    .order('created_at', { ascending: false })

  // 1. Verificar se o usuário possui assinaturas ativas (ou se é Super Admin)
  const isSuperAdmin = profile?.is_super_admin === true
  
  if (!isSuperAdmin) {
    const activeWorkspaces = workspaces?.filter(
      (w) => !w.is_blocked && (w.subscription_status === 'active' || w.subscription_status === 'canceled')
    ) || []

    if (activeWorkspaces.length === 0) {
      // Redireciona para o checkout. Se tiver algum workspace bloqueado dele, passa o slug para pagamento
      const ownedBlockedWorkspace = workspaces?.find(
        (w) => w.owner_id === user.id && (w.is_blocked || w.subscription_status === 'blocked' || w.subscription_status === 'pending')
      )

      if (ownedBlockedWorkspace) {
        redirect(`/checkout?workspace_slug=${ownedBlockedWorkspace.slug}`)
      } else {
        redirect('/checkout')
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      
      <Navbar user={user} profile={profile} />
      <Breadcrumbs />

      <main className="w-full mx-auto px-10 pt-4 pb-4 space-y-6 flex-grow">
        
        {/* Gerenciador de Workspaces (Lista + Drawers) */}
        <WorkspaceManager 
          initialWorkspaces={workspaces || []} 
          userName={user.email?.split('@')[0] || 'Usuário'} 
        />

      </main>
      <Footer />
    </div>
  )
}
