import { createClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { DynamicDashboard } from '@/components/runtime/DynamicDashboard'
import { findBreadcrumbPath } from '@/lib/navigation-utils'

interface WorkspacePageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
    folder_id?: string[]
  }>
}

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

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspace_slug, project_slug, folder_id } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Resolve Workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', workspace_slug)
    .single()

  if (!workspace) notFound()

  // 2. Resolve Project
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (!project) notFound()

  const rawNavigation = project.navigation || []

  // 3. Resolve ui_views para mapeamento de slug -> view_id
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
  const sessionCookie = cookieStore.get(`client_session_${project.id}`)?.value

  if (!sessionCookie) {
    redirect(`/${workspace_slug}/${project_slug}/login`)
  }

  let allowedViewIds: string[] | null = null
  try {
    const clientUser = JSON.parse(decodeURIComponent(sessionCookie))
    
    // Busca o papel do usuário no projeto
    const { data: userRole } = await supabase
      .from('project_user_roles')
      .select('role_id')
      .eq('project_id', project.id)
      .eq('external_user_id', clientUser.id?.toString())
      .single()
    
    if (userRole?.role_id) {
      // Busca as permissões explicitamente desabilitadas deste papel (can_read = false)
      const { data: deniedPermissions } = await supabase
        .from('project_role_permissions')
        .select('view_id')
        .eq('role_id', userRole.role_id)
        .eq('can_read', false)
      
      const deniedViewIds = deniedPermissions ? deniedPermissions.map(p => p.view_id) : []
      const allViewIds = getAllViewIds(rawNavigation, viewSlugToIdMap)
      allowedViewIds = allViewIds.filter(id => !deniedViewIds.includes(id))
    } else {
      allowedViewIds = []
    }
  } catch (e) {
    console.error('Erro ao ler sessão no dashboard', e)
    allowedViewIds = []
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
  const activeFolderId = folder_id?.[0]

  let displayItems = []
  let title = project.name
  let subtitle = project.description || 'Dashboard Principal'
  let icon = ''

  if (activeFolderId) {
    // Busca a pasta recursivamente
    const findFolder = (items: any[]): any => {
      for (const item of items) {
        if (item.id === activeFolderId) return item
        if (item.children) {
          const found = findFolder(item.children)
          if (found) return found
        }
      }
      return null
    }

    const folder = findFolder(navigation)
    if (!folder) notFound()
    
    // Filtra apenas itens que devem mostrar dashboard
    displayItems = (folder.children || []).filter((item: any) => item.show_dashboard !== false)
    title = folder.label
    subtitle = folder.description || `Explorando ${folder.label}`
    icon = folder.icon
  } else {
    displayItems = navigation.filter((item: any) => item.show_dashboard !== false)
    icon = project.icon || 'Box'
  }

  const baseUrl = `/${workspace_slug}/${project_slug}`
  const breadcrumbs = activeFolderId 
    ? findBreadcrumbPath(navigation, activeFolderId, [], baseUrl) || []
    : []

  return (
    <div className="flex-1 overflow-y-auto">
      <DynamicDashboard 
        items={displayItems}
        workspaceSlug={workspace_slug}
        projectSlug={project_slug}
        title={title}
        subtitle={subtitle}
        icon={icon}
        breadcrumbs={breadcrumbs}
      />
    </div>
  )
}
