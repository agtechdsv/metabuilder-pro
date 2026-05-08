import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Table, LayoutGrid, Plus, Search, Filter } from 'lucide-react'
import DynamicGrid from '@/components/DynamicGrid'
import ViewContainer from '@/components/runtime/ViewContainer'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { TranslationProvider } from '@/i18n/TranslationProvider'
import { getLocale } from '@/i18n/get-locale'

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

  // 2. Resolve o Projeto pelo Slug e Workspace ID
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (projectError || !project) {
    console.error('Project not found:', project_slug)
    notFound()
  }

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
      model:models (*),
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
    
    // Transforma os componentes em fields para o Grid (Zona Grid)
    displayFields = allComponents
      .filter((c: any) => c.is_visible && (c.config?.zones?.includes('grid') || !c.config?.zones))
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((c: any) => ({
        id: c.field.id,
        display_name: c.label || c.field.display_name || c.field.db_column_name,
        db_column_name: c.field.db_column_name,
        is_primary_key: c.field.is_primary_key,
        data_type: c.field.data_type,
        config: c.config
      }))

    // Extrai os campos de Filtro (Zona Filter)
    const filterFields = allComponents
      .filter((c: any) => c.config?.zones?.includes('filter'))
      .map((c: any) => ({
        id: c.field.id,
        display_name: c.label || c.field.display_name || c.field.db_column_name,
        db_column_name: c.field.db_column_name,
        data_type: c.field.data_type
      }))

    const buttonsConfig = view.buttons_config || []
    const canAdd = buttonsConfig.find((b: any) => b.id === 'add')?.visible !== false

    return (
      <TranslationProvider locale={locale}>
        <div className="min-h-screen bg-white dark:bg-[#050505] text-neutral-900 dark:text-neutral-200 transition-colors duration-300">
          {/* Header com Branding Dinâmico */}
          <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 sticky top-0 z-10 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <Table className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200 dark:border-neutral-700">
                      {workspace.name}
                    </span>
                    <span className="text-neutral-300 dark:text-neutral-600 text-xs">/</span>
                    <span className="text-neutral-500 dark:text-neutral-400 text-xs font-medium">
                      {project.name}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-neutral-900 dark:text-white capitalize tracking-tight">
                    {viewName}
                  </h1>
                </div>
              </div>
 
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 pr-4 border-r border-neutral-200 dark:border-neutral-800">
                  <button className="p-2 text-neutral-400 hover:text-indigo-600 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all">
                    <LayoutGrid className="w-5 h-5" />
                  </button>
                  <HeaderActions />
                </div>
                {canAdd && (
                  <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all font-bold text-xs shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                    <Plus className="w-4 h-4" />
                    {{ pt: 'Novo Registro', en: 'New Record', es: 'Nuevo Registro' }[locale] || 'New Record'}
                  </button>
                )}
              </div>
            </div>
          </header>
 
          <main className="max-w-7xl mx-auto px-6 py-8">
            <ViewContainer 
              projectId={project.id}
              modelName={modelName}
              displayFields={displayFields}
              filterFields={filterFields}
              displayType={displayType}
              defaultView={view.layout_config?.default_view || 'list'}
              buttonsConfig={buttonsConfig}
              locale={locale}
            />
          </main>
        </div>
      </TranslationProvider>
    )
  } else {
    // FALLBACK: Se não existe uma View com esse slug, 
    // buscamos o Model bruto e seus campos originais.
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
          <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/50 sticky top-0 z-10 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <Table className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-900 dark:text-white capitalize tracking-tight">
                    {viewName}
                  </h1>
                </div>
              </div>
              <HeaderActions />
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-6 py-8">
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
