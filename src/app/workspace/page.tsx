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
