import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { 
  Plus, 
  ArrowLeft,
  ChevronRight,
  Database,
  Layers,
  Settings,
  Activity,
  Box
} from 'lucide-react'
import Link from 'next/link'

interface WorkspaceDashboardProps {
  params: Promise<{
    workspace_slug: string
  }>
}

export default async function WorkspaceDashboard({ params }: WorkspaceDashboardProps) {
  const { workspace_slug } = await params
  const supabase = await createClient()

  // 1. Resolve Workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) notFound()

  // 2. Busca Projetos deste Workspace
  const { data: projects } = await supabase
    .from('projects')
    .select('*, models(count)')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      
      {/* Navbar Superior */}
      <nav className="h-20 border-b border-neutral-900 bg-neutral-950/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-900 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <Box className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-none">{workspace.name}</h1>
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">Workspace</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-full text-xs font-bold text-neutral-400 hover:text-white transition-all">
              <Settings className="w-4 h-4" /> Configurações
            </button>
            <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all">
              Novo Projeto
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12 space-y-12">
        
        {/* Banner de Boas Vindas do Workspace */}
        <div className="relative p-12 bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-[3rem] overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-600/20 transition-all duration-700"></div>
          
          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              Ambiente de Trabalho Ativo
            </div>
            <h2 className="text-5xl font-black tracking-tight leading-tight">Projetos em <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500">{workspace.name}</span></h2>
            <p className="text-neutral-400 text-lg leading-relaxed">
              Aqui você gerencia todos os aplicativos e conexões de banco de dados deste workspace. Cada projeto pode ter seu próprio Agente CLI e estrutura de metadados.
            </p>
          </div>
        </div>

        {/* Grade de Projetos */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <Layers className="w-6 h-6 text-indigo-500" />
              Projetos do Ecossistema
            </h3>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {projects?.length || 0} PROJETOS ENCONTRADOS
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects?.map((project) => (
              <Link 
                key={project.id}
                href={`/admin/${workspace_slug}/${project.slug}`}
                className="group p-8 bg-neutral-900/50 border border-neutral-800 rounded-[2.5rem] hover:border-indigo-500/50 transition-all hover:bg-neutral-900 shadow-xl"
              >
                <div className="flex flex-col h-full gap-8">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3">
                      <div className="p-3 bg-neutral-800 rounded-2xl w-fit group-hover:bg-indigo-500/10 transition-colors">
                        <Database className="w-6 h-6 text-neutral-500 group-hover:text-indigo-500" />
                      </div>
                      <div>
                        <h4 className="text-2xl font-bold group-hover:text-white transition-colors">{project.name}</h4>
                        <p className="text-sm text-neutral-500 font-mono mt-1">/{project.slug}</p>
                      </div>
                    </div>
                    <div className="px-4 py-1.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded-full border border-green-500/20 uppercase tracking-widest">
                      Ativo
                    </div>
                  </div>

                  <div className="flex items-center gap-6 pt-6 border-t border-neutral-800/50">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-neutral-600" />
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-tighter">
                        {project.models?.[0]?.count || 0} Tabelas
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-neutral-600" />
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-tighter">
                        Casos de Uso Pronto
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Empty State / Add New */}
            <button className="p-8 border-2 border-dashed border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-indigo-500/30 transition-all group">
              <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-neutral-700 group-hover:text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-neutral-400">Criar Novo Projeto</p>
                <p className="text-xs text-neutral-600 mt-1">Conecte um novo banco de dados.</p>
              </div>
            </button>
          </div>
        </section>

      </main>
    </div>
  )
}
