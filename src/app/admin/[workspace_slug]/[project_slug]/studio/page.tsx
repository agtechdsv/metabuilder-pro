import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { 
  LayoutDashboard, 
  Database, 
  Settings2, 
  Eye, 
  Plus, 
  ArrowRight,
  Search,
  Box,
  Layers,
  Clock,
  ShieldCheck
} from 'lucide-react'
import Link from 'next/link'

interface StudioDashboardProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function StudioDashboard({ params }: StudioDashboardProps) {
  const { workspace_slug, project_slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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

  // 2. Busca todos os Models (Tabelas Sincronizadas) + Views associadas
  const { data: models, error: modelsError } = await supabase
    .from('models')
    .select('*, fields(id), ui_views(slug)')
    .eq('project_id', project.id)
    .order('db_table_name', { ascending: true })

  // 3. Busca Views já criadas para mostrar no dashboard
  const { data: views } = await supabase
    .from('ui_views')
    .select('*')
    .eq('project_id', project.id)

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar Simulado / Navegação Lateral Estreita */}
      <aside className="fixed left-0 top-0 h-full w-20 bg-neutral-900/50 border-r border-neutral-800 flex flex-col items-center py-8 gap-8 z-20 backdrop-blur-xl">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
          <Box className="text-white w-6 h-6" />
        </div>
        <nav className="flex flex-col gap-4">
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio`} className="p-3 bg-neutral-800 rounded-xl text-indigo-400 border border-indigo-500/20 group relative flex justify-center">
            <LayoutDashboard className="w-6 h-6" />
            <span className="absolute left-16 px-2 py-1 bg-neutral-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Painel</span>
          </Link>
          <div className="p-3 text-neutral-500 hover:text-white transition-colors cursor-pointer group relative flex justify-center">
            <Database className="w-6 h-6" />
            <span className="absolute left-16 px-2 py-1 bg-neutral-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Dados</span>
          </div>
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio/auth`} className="p-3 text-neutral-500 hover:text-white transition-colors cursor-pointer group relative flex justify-center">
            <ShieldCheck className="w-6 h-6" />
            <span className="absolute left-16 px-2 py-1 bg-neutral-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Autenticação</span>
          </Link>
          <div className="p-3 text-neutral-500 hover:text-white transition-colors cursor-pointer group relative flex justify-center">
            <Settings2 className="w-6 h-6" />
            <span className="absolute left-16 px-2 py-1 bg-neutral-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Configurações</span>
          </div>
        </nav>
      </aside>

      {/* Conteúdo Principal */}
      <main className="pl-20">
        
        {/* Header de Contexto */}
        <header className="h-20 border-b border-neutral-800 flex items-center justify-between px-10 bg-neutral-900/20 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Link href={`/admin/${workspace_slug}`} className="text-neutral-500 text-sm font-medium uppercase tracking-widest hover:text-indigo-400 transition-colors">{workspace.name}</Link>
            <span className="text-neutral-700">/</span>
            <Link href={`/admin/${workspace_slug}/${project_slug}`} className="text-white font-bold hover:text-indigo-400 transition-colors">{project.name}</Link>
            <span className="ml-4 px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-full border border-green-500/20 uppercase tracking-tighter">
              Agente Online
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Buscar tabelas..." 
                className="bg-neutral-900/50 border border-neutral-800 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-all w-64"
              />
            </div>
            <Link 
              href={`/${workspace_slug}/${project_slug}`}
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-full text-xs font-bold transition-all border border-neutral-700"
            >
              <Eye className="w-4 h-4" /> Ver App
            </Link>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto space-y-12">
          
          {/* Título e Stats Rápidos */}
          <section className="space-y-2">
            <h2 className="text-4xl font-extrabold tracking-tight">MetaBuilder <span className="text-indigo-500">Studio</span></h2>
            <p className="text-neutral-500 max-w-2xl">
              Configure as telas do seu aplicativo. Escolha as tabelas sincronizadas e defina como os dados devem ser exibidos para os seus usuários.
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                  <Database className="w-6 h-6" />
                </div>
                <span className="text-2xl font-black">{models?.length || 0}</span>
              </div>
              <p className="text-sm text-neutral-400 font-medium">Tabelas Sincronizadas</p>
            </div>
            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-purple-500/10 rounded-2xl text-purple-500">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-2xl font-black">{views?.length || 0}</span>
              </div>
              <p className="text-sm text-neutral-400 font-medium">Views Customizadas</p>
            </div>
            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-orange-500 uppercase">Agora</span>
              </div>
              <p className="text-sm text-neutral-400 font-medium">Status do Túnel</p>
            </div>
          </div>

          {/* Lista de Models / Tabelas */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-500" />
                Estrutura de Dados
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {models?.map((model) => (
                <div 
                  key={model.id} 
                  className="group relative p-6 bg-neutral-900 border border-neutral-800 rounded-[2rem] hover:border-indigo-500/50 transition-all duration-300 hover:shadow-[0_0_40px_rgba(79,70,229,0.1)]"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                          {model.display_name || model.db_table_name}
                        </h4>
                        <p className="text-xs text-neutral-500 font-mono">{model.db_table_name}</p>
                      </div>
                      <div className="px-3 py-1 bg-neutral-800 rounded-full text-[10px] font-bold text-neutral-400">
                        {model.fields?.length} campos
                      </div>
                    </div>

                    <div className="pt-4 flex gap-2">
                      <Link 
                        href={`/admin/${workspace_slug}/${project_slug}/studio/config/${model.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-black rounded-2xl text-xs font-bold hover:bg-neutral-200 transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Configurar Tela
                      </Link>
                      <Link 
                        href={`/${workspace_slug}/${project_slug}/${model.ui_views?.[0]?.slug || model.db_table_name}`}
                        target="_blank"
                        className="w-12 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 rounded-2xl border border-neutral-700 transition-colors"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
