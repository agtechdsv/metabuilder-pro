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
    <div className="min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300">
      
      <Navbar user={user} profile={profile} />
      <Breadcrumbs 
        workspaceName={workspace.name} 
        workspaceSlug={workspace.slug} 
      />

      <main className="w-full px-10 pt-4 pb-4 flex-grow">
        
        <ProjectManager 
          initialProjects={projects || []} 
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
        />

      </main>
      <Footer />
    </div>
  )
}
