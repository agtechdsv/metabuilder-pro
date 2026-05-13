import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { DynamicDashboard } from '@/components/runtime/DynamicDashboard'

interface WorkspacePageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
    folder_id?: string[]
  }>
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspace_slug, project_slug, folder_id } = await params
  const supabase = await createClient()

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

  const navigation = project.navigation || []
  const activeFolderId = folder_id?.[0]

  let displayItems = []
  let title = project.name
  let subtitle = 'Dashboard Principal'

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
    subtitle = `Explorando ${folder.label}`
  } else {
    // Dashboard Raiz
    displayItems = navigation.filter((item: any) => item.show_dashboard !== false)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <DynamicDashboard 
        items={displayItems}
        workspaceSlug={workspace_slug}
        projectSlug={project_slug}
        title={title}
        subtitle={subtitle}
      />
    </div>
  )
}
