import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Table, LayoutGrid, Plus, Search, Filter } from 'lucide-react'
import DynamicGrid from '@/components/DynamicGrid'
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
        field:fields (*)
      )
    `)
    .eq('slug', view_slug)
    .eq('project_id', project.id)
    .single()

  if (view && !viewError) {
    viewName = view.name
    modelName = view.model?.db_table_name || ''
    modelId = view.model_id
    
    // Transforma os componentes em fields para o Grid, respeitando a visibilidade e rótulos do Studio
    displayFields = (view.ui_components || [])
      .filter((c: any) => c.is_visible)
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((c: any) => ({
        id: c.field.id,
        display_name: c.label || c.field.display_name || c.field.db_column_name, // Fallback triplo de segurança
        db_column_name: c.field.db_column_name,
        is_primary_key: c.field.is_primary_key,
        data_type: c.field.data_type
      }))
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
  }

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
              <button className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all font-bold text-xs shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                <Plus className="w-4 h-4" />
                {{ pt: 'Novo Registro', en: 'New Record', es: 'Nuevo Registro' }[locale] || 'New Record'}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text"
                  placeholder={{ pt: 'Buscar registros...', en: 'Search records...', es: 'Buscar registros...' }[locale] || 'Search records...'}
                  className="pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-neutral-200 outline-none focus:border-indigo-500 transition-all w-72 shadow-sm dark:shadow-none"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50 text-neutral-600 dark:text-neutral-300 rounded-xl text-xs font-bold transition-all shadow-sm dark:shadow-none">
                <Filter className="w-4 h-4" />
                {{ pt: 'Filtros', en: 'Filters', es: 'Filtros' }[locale] || 'Filters'}
              </button>
            </div>
            <div className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest bg-neutral-100 dark:bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-800">
              {displayFields.length} {{ pt: 'colunas mapeadas', en: 'columns mapped', es: 'columnas mapeadas' }[locale] || 'columns mapped'}
            </div>
          </div>

          {/* Data Grid Card */}
          <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-xl dark:shadow-none backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-8 py-5 w-12">
                      <input type="checkbox" className="rounded-md bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 transition-all" />
                    </th>
                    {displayFields.map((field) => (
                      <th 
                        key={field.id} 
                        className="px-6 py-5 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em] whitespace-nowrap"
                      >
                        <div className="flex items-center gap-2">
                          {field.display_name}
                          {field.is_primary_key && <span className="text-indigo-500" title="Chave Primária">🔑</span>}
                        </div>
                      </th>
                    ))}
                    <th className="px-8 py-5 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em]">
                      {{ pt: 'Ações', en: 'Actions', es: 'Acciones' }[locale] || 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                  <DynamicGrid 
                    projectId={project.id} 
                    modelName={modelName} 
                    fields={displayFields} 
                  />
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>
    </TranslationProvider>
  )
}
