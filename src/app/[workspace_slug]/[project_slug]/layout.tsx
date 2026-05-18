import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { RuntimeLayoutClient } from '@/components/runtime/RuntimeLayoutClient'
import { I18nProvider } from '@/i18n/I18nContext'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ project_slug: string; workspace_slug: string }> }): Promise<Metadata> {
  const { project_slug, workspace_slug } = await params
  const supabase = await createClient()
  
  const { data: workspaces } = await supabase.from('workspaces').select('id').eq('slug', workspace_slug).limit(1)
  const workspace = workspaces?.[0]
  if (!workspace) return {}

  const { data: projects } = await supabase
    .from('projects')
    .select('name, icon')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .limit(1)

  const project = projects?.[0]

  if (!project) return {}

  const metadata: Metadata = {
    title: project.name,
  }

  // Se o ícone for um SVG bruto, já mandamos no header do servidor!
  if (project.icon && project.icon.startsWith('<svg')) {
    metadata.icons = {
      icon: [
        {
          url: `data:image/svg+xml,${encodeURIComponent(project.icon)}`,
          type: 'image/svg+xml',
        }
      ]
    }
  } else {
    // Para evitar o ícone padrão do Next.js (triângulo preto), mandamos um pixel transparente
    metadata.icons = {
      icon: [
        {
          url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
          type: 'image/gif',
        }
      ]
    }
  }

  return metadata
}
import { cookies } from 'next/headers'

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  // 1. Resolve Workspace
  const { data: workspaces, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspace_slug)
    .limit(1)

  const workspace = workspaces?.[0]

  if (workspaceError || !workspace) notFound()

  // 2. Resolve Project (incluindo navegação)
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .limit(1)

  const project = projects?.[0]

  if (projectError || !project) notFound()

  // Se o projeto não tiver navegação, vamos garantir que seja um array vazio
  const navigation = project.navigation || []

  const cookieStore = await cookies()
  const locale = cookieStore.get('app-language')?.value || 'pt'

  return (
    <I18nProvider initialLocale={locale as any}>
      <RuntimeLayoutClient
        project={project}
        workspaceSlug={workspace_slug}
        projectSlug={project_slug}
        navigation={navigation}
      >
        {children}
      </RuntimeLayoutClient>
    </I18nProvider>
  )
}
