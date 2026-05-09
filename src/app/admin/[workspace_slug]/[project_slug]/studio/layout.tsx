import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Footer } from '@/components/layout/Footer'
import { StudioSidebar } from '@/components/layout/StudioSidebar'

interface StudioLayoutProps {
  children: React.ReactNode
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function StudioLayout({ children, params }: StudioLayoutProps) {
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

  if (workspaceError || !workspace) notFound()

  // 2. Resolve Project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (projectError || !project) notFound()

  return (
    <div className="flex bg-white dark:bg-[#050505]">
      {/* Sidebar - Persists across studio pages */}
      <StudioSidebar 
        workspaceSlug={workspace_slug} 
        projectSlug={project_slug} 
      />

      <div className="pl-20 min-h-screen flex flex-col pt-16 bg-white dark:bg-[#050505] text-black dark:text-white transition-colors duration-300 w-full overflow-hidden">
        <Navbar user={user} profile={profile} isStudio={true} />
        
        {/* Breadcrumbs - Also persists, but content inside depends on page (viewName) */}
        {/* Note: children pages can also render their own specialized Breadcrumbs if needed, 
            but for now we'll let each page pass props to a shared Breadcrumbs if we want.
            Actually, the best way in Next.js layouts for dynamic breadcrumbs is often 
            to have the breadcrumbs INSIDE the page OR use a state management.
            But to keep it SMOOTH, the breadcrumbs structure should be here.
        */}

        {children}
        
        <Footer />
      </div>
    </div>
  )
}
