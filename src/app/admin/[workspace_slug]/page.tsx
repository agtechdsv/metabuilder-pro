import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { 
  ArrowLeft,
  Box,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { ProjectManager } from '@/components/dashboard/ProjectManager'
import { HeaderActions } from '@/components/layout/HeaderActions'

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

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      
      {/* Navbar Superior */}
      <nav className="h-20 border-b border-neutral-200 dark:border-neutral-900 bg-white/50 dark:bg-neutral-950/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <Box className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none text-neutral-900 dark:text-white">{workspace.name}</h1>
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">Workspace</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <HeaderActions user={user} profile={profile} />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12">
        
        <ProjectManager 
          initialProjects={projects || []} 
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
        />

      </main>
    </div>
  )
}
