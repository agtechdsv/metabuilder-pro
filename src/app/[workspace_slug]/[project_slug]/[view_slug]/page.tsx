import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { Table, LayoutGrid, Plus, Search, Filter } from 'lucide-react'
import DynamicGrid from '@/components/DynamicGrid'

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
    <div className="min-h-screen bg-black text-neutral-200">
      {/* Header com Branding Dinâmico */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              <Table className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold bg-neutral-800 px-1.5 py-0.5 rounded">
                  {workspace.name}
                </span>
                <span className="text-neutral-600 text-xs">/</span>
                <span className="text-neutral-400 text-xs font-medium">
                  {project.name}
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-white capitalize">
                {viewName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium text-sm">
              <Plus className="w-4 h-4" />
              Novo Registro
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input 
                type="text"
                placeholder="Buscar registros..."
                className="pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all w-64"
              />
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded-lg text-sm transition-colors">
              <Filter className="w-4 h-4" />
              Filtros
            </button>
          </div>
          <div className="text-sm text-neutral-500">
            {displayFields.length} colunas mapeadas
          </div>
        </div>

        {/* Data Grid Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-900/50 border-b border-neutral-800">
                  <th className="px-6 py-4 text-xs font-medium text-neutral-400 uppercase tracking-wider w-12">
                    <input type="checkbox" className="rounded bg-neutral-800 border-neutral-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-neutral-900" />
                  </th>
                  {displayFields.map((field) => (
                    <th 
                      key={field.id} 
                      className="px-6 py-4 text-xs font-medium text-neutral-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {field.display_name}
                      {field.is_primary_key && <span className="ml-2 text-indigo-500" title="Chave Primária">🔑</span>}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
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
  )
}
