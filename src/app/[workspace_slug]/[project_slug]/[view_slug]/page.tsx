import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Table, LayoutGrid, Plus, Search, Filter } from 'lucide-react'
import DynamicGrid from '@/components/DynamicGrid'
import ViewPageContent from '@/components/runtime/ViewPageContent'
import { TranslationProvider } from '@/i18n/TranslationProvider'
import { getLocale } from '@/i18n/get-locale'
import { HeaderActions } from '@/components/layout/HeaderActions'
import ViewContainer from '@/components/runtime/ViewContainer'
import { RuntimeHeader } from '@/components/runtime/RuntimeHeader'
import { findBreadcrumbPath, findNavigationItem } from '@/lib/navigation-utils'
import { RuntimeBreadcrumbs } from '@/components/runtime/RuntimeBreadcrumbs'

interface PageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
    view_slug: string
  }>
}

/**
 * MetaBuilderPRO - Página Dinâmica com Slugs Amigáveis
 * Rota: /[workspace_slug]/[project_slug]/[view_slug]
 */
export default async function SlugPage({ params }: PageProps) {
  const { workspace_slug, project_slug, view_slug } = await params

  // Usamos a Service Role para resolver os slugs e metadados com bypass de RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const locale = await getLocale()

  // 1. Resolve o Workspace pelo Slug
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) {
    console.error('Workspace not found:', workspace_slug)
    notFound()
  }

  // 2. Resolve o Projeto pelo Slug e Workspace ID (incluindo navegação)
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, navigation')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (projectError || !project) {
    console.error('Project not found:', project_slug)
    notFound()
  }

  const navigation = project.navigation || []
  const baseUrl = `/${workspace_slug}/${project_slug}`
  const breadcrumbs = findBreadcrumbPath(navigation, view_slug, [], baseUrl) || [{ label: view_slug, href: '#' }]
  const navItem = findNavigationItem(navigation, view_slug)
  const navDescription = navItem?.description
  const navIcon = navItem?.icon

  // 3. Resolve a View (Caso de Uso) ou faz fallback para o Model (Tabela Bruta)
  let viewName = ''
  let modelName = ''
  let modelId = ''
  let displayFields: any[] = []
  let displayType: 'list' | 'card' | 'both' = 'list'

  // Tenta buscar na tabela de Views customizadas, trazendo os componentes e os fields relacionados
  const { data: view, error: viewError } = await supabase
    .from('ui_views')
    .select(`
      *, 
      model:models (*, fields (*)),
      ui_components (
        label,
        order_index,
        is_visible,
        config,
        field:fields (*)
      )
    `)
    .eq('slug', view_slug)
    .eq('project_id', project.id)
    .single()

  if (view && !viewError && view.layout_config?.is_active !== false) {
    viewName = view.name
    modelName = view.model?.db_table_name || ''
    modelId = view.model_id
    displayType = view.layout_config?.display_type || 'list'
    
    const allComponents = view.ui_components || []
    
    const { data: allModels } = await supabase.from('models').select('id, display_name, db_table_name').eq('project_id', project.id)
    const dictionary = allModels?.reduce((acc: any, m: any) => ({ ...acc, [m.id]: m.display_name }), {}) || {}

    const resolveSqlExpression = (field: any) => {
      const dbColName = field.db_column_name
      if (field.model_id && field.model_id !== view.model_id) {
        const joinedTable = allModels?.find(m => m.id === field.model_id)?.db_table_name
        if (joinedTable) {
          return `${joinedTable}.${dbColName} AS "${joinedTable}.${dbColName}"`
        }
      }
      return dbColName
    }

    const resolveResultKey = (field: any) => {
      const dbColName = field.db_column_name
      if (field.model_id && field.model_id !== view.model_id) {
        const joinedTable = allModels?.find(m => m.id === field.model_id)?.db_table_name
        if (joinedTable) {
          return `${joinedTable}.${dbColName}`
        }
      }
      return dbColName
    }
    
    // Transforma os componentes em fields para o Grid (Zona Grid)
    displayFields = allComponents
      .filter((c: any) => c.is_visible && (c.config?.zones?.includes('grid') || !c.config?.zones))
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((c: any) => ({
        id: c.field.id,
        model_id: c.field.model_id,
        model_name: dictionary[c.field.model_id],
        display_name: c.label || c.field.display_name || c.field.db_column_name,
        db_column_name: resolveResultKey(c.field),
        sql_expression: resolveSqlExpression(c.field),
        is_primary_key: c.field.is_primary_key,
        data_type: c.field.data_type,
        config: c.config
      }))

    // Extrai os campos do Formulário (Zona Form)
    const formFields = allComponents
      .filter((c: any) => c.is_visible && c.config?.zones?.includes('form'))
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((c: any) => ({
        id: c.field.id,
        model_id: c.field.model_id,
        model_name: dictionary[c.field.model_id],
        display_name: c.label || c.field.display_name || c.field.db_column_name,
        db_column_name: resolveResultKey(c.field),
        sql_expression: resolveSqlExpression(c.field),
        data_type: c.field.data_type,
        is_primary_key: c.field.is_primary_key,
        config: c.config
      }))

    // Extrai os campos de Filtro (Zona Filter)
    const filterFields = allComponents
      .filter((c: any) => c.is_visible && c.config?.zones?.includes('filter'))
      .map((c: any) => ({
        id: c.field.id,
        model_id: c.field.model_id,
        model_name: dictionary[c.field.model_id],
        display_name: c.label || c.field.display_name || c.field.db_column_name,
        db_column_name: resolveResultKey(c.field),
        sql_expression: resolveSqlExpression(c.field),
        data_type: c.field.data_type,
        config: c.config
      }))

    const primaryKeyField = allComponents.find((c: any) => c.field?.is_primary_key)?.field
    const primaryKeyName = primaryKeyField?.db_column_name || 'id'

    // Garante que o campo de agrupamento do Kanban esteja presente nos metadados
    const kanbanGroupFieldId = view.layout_config?.kanban_group_field
    if (view.logic_type === 'kanban' && kanbanGroupFieldId) {
      // Primeiro busca nos componentes existentes
      let groupFieldData = allComponents.find((c: any) => c.field?.id === kanbanGroupFieldId)?.field
      
      // Se não achar (campo não está em nenhuma zona), busca nos campos brutos do modelo
      if (!groupFieldData && view.model?.fields) {
        groupFieldData = view.model.fields.find((f: any) => f.id === kanbanGroupFieldId)
      }

      // Se ainda não achar (pode ser um campo de uma tabela relacionada via JOIN), busca direto no banco
      if (!groupFieldData) {
        const { data: remoteField } = await supabase.from('fields').select('*').eq('id', kanbanGroupFieldId).single()
        if (remoteField) groupFieldData = remoteField
      }

      if (groupFieldData && !displayFields.find(f => f.id === kanbanGroupFieldId)) {
        displayFields.push({
          id: groupFieldData.id,
          display_name: groupFieldData.display_name || groupFieldData.db_column_name,
          db_column_name: resolveResultKey(groupFieldData),
          data_type: groupFieldData.data_type,
          config: {},
          hidden: true
        })
      }
    }

    const buttonsConfig = view.buttons_config || []
    const canAdd = buttonsConfig.find((b: any) => b.id === 'add')?.visible !== false

    return (
      <TranslationProvider locale={locale}>
        <ViewPageContent 
          workspace={workspace}
          project={project}
          viewName={viewName}
          modelName={modelName}
          displayFields={displayFields}
          filterFields={filterFields}
          formFields={formFields}
          displayType={displayType}
          defaultView={view.layout_config?.default_view || 'list'}
          buttonsConfig={buttonsConfig}
          locale={locale}
          canAdd={canAdd}
          viewId={view.id}
          primaryKeyName={primaryKeyName}
          logicType={view.logic_type}
          kanbanGroupField={view.layout_config?.kanban_group_field}
          mindmapCentralField={view.layout_config?.mindmap_central_field}
          dictionary={dictionary}
          joins={view.layout_config?.joins || []}
          masterModelId={view.layout_config?.master_model_id}
          detailDisplayMode={view.layout_config?.detail_display_mode}
          actionInterfaceType={view.layout_config?.action_interface_type}
          baseUrl={`${baseUrl}/dashboard`}
          breadcrumbs={breadcrumbs}
          description={navDescription}
          icon={navIcon}
        />
      </TranslationProvider>
    )
  } else {
    // FALLBACK
    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('*, fields(*)')
      .eq('project_id', project.id)
      .eq('db_table_name', view_slug)
      .single()

    if (modelError || !model) {
      console.error('Nenhuma View ou Model encontrado para o slug:', view_slug)
      notFound()
    }
    
    viewName = model.display_name || model.db_table_name
    modelName = model.db_table_name
    modelId = model.id
    displayFields = (model.fields || [])
      .filter((f: any) => f.is_visible_in_list)
      .sort((a: any, b: any) => a.order_index - b.order_index)

    return (
      <TranslationProvider locale={locale}>
        <div className="min-h-screen bg-white dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 transition-colors duration-300">
          <RuntimeHeader 
            viewName={viewName}
            icon={<Table className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            breadcrumbs={[]}
            baseUrl={`${baseUrl}/dashboard`}
          />

          <main className="max-w-7xl mx-auto px-6 py-2">
            <RuntimeBreadcrumbs breadcrumbs={breadcrumbs} baseUrl={`${baseUrl}/dashboard`} />
            
            <ViewContainer 
              projectId={project.id}
              modelName={modelName}
              displayFields={displayFields}
              filterFields={[]}
              displayType="list"
              locale={locale}
            />
          </main>
        </div>
      </TranslationProvider>
    )
  }

}
