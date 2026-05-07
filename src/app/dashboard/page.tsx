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
import { HeaderActions } from '@/components/layout/HeaderActions'
import { WorkspaceManager } from '@/components/dashboard/WorkspaceManager'

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
    <div className="min-h-screen bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      
      {/* Header do Dashboard */}
      <header className="border-b border-neutral-200 dark:border-neutral-900 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <LayoutGrid className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">MetaBuilder<span className="text-indigo-500">PRO</span></h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden lg:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Buscar recursos..."
                className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <HeaderActions user={user} profile={profile} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12 space-y-12">
        
        {/* Gerenciador de Workspaces (Lista + Drawers) */}
        <WorkspaceManager 
          initialWorkspaces={workspaces || []} 
          userName={user.email?.split('@')[0] || 'Usuário'} 
        />

      </main>
    </div>
  )
}
