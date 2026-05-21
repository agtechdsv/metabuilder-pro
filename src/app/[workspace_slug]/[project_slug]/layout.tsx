import { createClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import { RuntimeLayoutClient } from '@/components/runtime/RuntimeLayoutClient'
import { I18nProvider } from '@/i18n/I18nContext'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ project_slug: string; workspace_slug: string }> }): Promise<Metadata> {
  const { project_slug, workspace_slug } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
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

const getAllViewIds = (items: any[], slugToIdMap: Map<string, string>): string[] => {
  const ids: string[] = []
  const traverse = (list: any[]) => {
    for (const item of list) {
      if (item.type === 'view') {
        const resolvedId = item.view_id || (item.target ? slugToIdMap.get(item.target.toLowerCase()) : null)
        if (resolvedId) {
          ids.push(resolvedId)
        }
      }
      if (item.children) {
        traverse(item.children)
      }
    }
  }
  traverse(items)
  return ids
}

interface ProjectLayoutProps {
  children: React.ReactNode
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
  const rawNavigation = project.navigation || []

  // 3. Busca todas as views do projeto para mapeamento de slug -> view_id
  const { data: uiViews } = await supabase
    .from('ui_views')
    .select('id, slug')
    .eq('project_id', project.id)

  const viewSlugToIdMap = new Map<string, string>()
  if (uiViews) {
    uiViews.forEach(v => {
      if (v.slug) viewSlugToIdMap.set(v.slug.toLowerCase(), v.id)
    })
  }

  const cookieStore = await cookies()
  const locale = cookieStore.get('app-language')?.value || 'pt'
  const sessionCookie = cookieStore.get(`client_session_${project.id}`)?.value

  let allowedViewIds: string[] | null = null

  if (sessionCookie) {
    try {
      const clientUser = JSON.parse(decodeURIComponent(sessionCookie))
      
      // 1. Busca o papel do usuário no projeto
      const { data: userRole } = await supabase
        .from('project_user_roles')
        .select('role_id')
        .eq('project_id', project.id)
        .eq('external_user_id', clientUser.id?.toString())
        .single()
      
      if (userRole?.role_id) {
        // 2. Busca as permissões explicitamente desabilitadas deste papel (can_read = false)
        const { data: deniedPermissions } = await supabase
          .from('project_role_permissions')
          .select('view_id')
          .eq('role_id', userRole.role_id)
          .eq('can_read', false)
        
        const deniedViewIds = deniedPermissions ? deniedPermissions.map(p => p.view_id) : []
        const allViewIds = getAllViewIds(rawNavigation, viewSlugToIdMap)
        allowedViewIds = allViewIds.filter(id => !deniedViewIds.includes(id))
      } else {
        // Se não tem grupo, array vazio = acesso a nada
        allowedViewIds = []
      }
    } catch (e) {
      console.error('Erro ao ler sessão do cliente', e)
      allowedViewIds = [] // Sessão inválida = acesso a nada
    }
  } else {
    allowedViewIds = [] // Sem sessão = acesso a nada
  }

  // Filtra itens de navegação com base no RBAC (blacklist-based / default allow)
  const filterNavigation = (items: any[]): any[] => {
    if (!allowedViewIds) return items
    
    return items.map(item => {
      // Se for pasta, filtra os filhos recursivamente
      if (item.type === 'folder' && item.children) {
        const filteredChildren = filterNavigation(item.children)
        // Se a pasta não tem nenhum filho visível restante, oculta a própria pasta
        if (filteredChildren.length === 0) return null
        return { ...item, children: filteredChildren }
      }
      // Se for view, verifica se está no array de permissões
      if (item.type === 'view') {
        const resolvedId = item.view_id || (item.target ? viewSlugToIdMap.get(item.target.toLowerCase()) : null)
        if (resolvedId && !allowedViewIds.includes(resolvedId)) return null
      }
      return item
    }).filter(Boolean) // Remove os nulos (views negadas e pastas vazias)
  }

  const navigation = filterNavigation(rawNavigation)

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
