import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ProjectSourceClient } from './ProjectSourceClient'

interface PageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function SourceStudioPage({ params }: PageProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  // Verifica autenticação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  // Busca projeto
  const { data: project } = await supabase
    .from('projects')
    .select('*, workspace:workspaces(*)')
    .eq('slug', project_slug)
    .single()

  if (!project) {
    redirect(`/admin/${workspace_slug}`)
  }

  return (
    <div className="flex-1 h-screen flex flex-col bg-white dark:bg-neutral-950 overflow-hidden ml-20">
      <ProjectSourceClient 
        project={project} 
        user={user} 
      />
    </div>
  )
}
