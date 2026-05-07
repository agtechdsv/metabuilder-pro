import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import { 
  ArrowLeft,
  Layout,
  Plus,
  Monitor,
  Database,
  Code2,
  ExternalLink,
  ChevronRight,
  Settings,
  Zap,
  ShieldCheck
} from 'lucide-react'
import Link from 'next/link'

interface ProjectDashboardProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function ProjectDashboard({ params }: ProjectDashboardProps) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  // 1. Resolve Workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name')
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

  // 3. Busca Views (Casos de Uso) do Projeto
  const { data: views } = await supabase
    .from('ui_views')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      
      {/* Header Profissional */}
      <nav className="h-20 border-b border-neutral-900 bg-neutral-950/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={`/admin/${workspace_slug}`} className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-900 rounded-lg transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-600/20 rounded-xl border border-indigo-500/30">
                <Database className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{workspace.name}</span>
                  <span className="text-neutral-700">/</span>
                  <span className="text-sm font-bold">{project.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] text-green-500 font-bold uppercase tracking-tighter">Conectado via Túnel</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              href={`/admin/${workspace_slug}/${project_slug}/studio`}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all shadow-[0_0_25px_rgba(79,70,229,0.4)]"
            >
              <Zap className="w-4 h-4" /> MetaBuilder Studio
            </Link>
            <button className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-all">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Coluna Esquerda: Listagem de Views */}
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight">Casos de Uso</h2>
                <p className="text-neutral-500 text-sm mt-1">Todas as interfaces publicadas para este projeto.</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-bold hover:bg-neutral-800 transition-all">
                <Plus className="w-4 h-4" /> Nova View
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Card Fixo: Portal de Login */}
              <div className="group p-6 bg-gradient-to-br from-indigo-900/10 to-neutral-900/40 border border-indigo-500/20 rounded-3xl hover:border-indigo-500/50 transition-all shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[50px] group-hover:bg-indigo-500/20 transition-all"></div>
                <div className="flex flex-col gap-6 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">Portal de Login</h4>
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[9px] font-bold uppercase tracking-widest border border-indigo-500/20 rounded-full">Sistema</span>
                      </div>
                      <p className="text-xs text-neutral-500 font-mono">/{workspace_slug}/{project_slug}/login</p>
                    </div>
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/admin/${workspace_slug}/${project_slug}/studio/login`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                    >
                      <Layout className="w-4 h-4" /> Personalizar Visual
                    </Link>
                    <Link 
                      href={`/${workspace_slug}/${project_slug}/login`}
                      target="_blank"
                      className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-all border border-transparent hover:border-neutral-700"
                      title="Ver Tela de Login"
                    >
                      <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-white" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Listagem de Views Dinâmicas */}
              {views?.map((view) => (
                <div key={view.id} className="group p-6 bg-neutral-900/40 border border-neutral-800 rounded-3xl hover:border-indigo-500/30 transition-all hover:bg-neutral-900 shadow-lg">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{view.name}</h4>
                        <p className="text-xs text-neutral-500 font-mono">/{workspace_slug}/{project_slug}/{view.slug}</p>
                      </div>
                      <div className="p-2 bg-neutral-800 rounded-lg text-neutral-500 group-hover:text-indigo-400 transition-colors">
                        <Layout className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/${workspace_slug}/${project_slug}/${view.slug}`}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-bold transition-all"
                      >
                        <ExternalLink className="w-4 h-4" /> Abrir App
                      </Link>
                      <button className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-all border border-transparent hover:border-neutral-700">
                        <Settings className="w-4 h-4 text-neutral-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {(!views || views.length === 0) && (
                <div className="col-span-2 p-12 border-2 border-dashed border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4">
                  <div className="p-4 bg-neutral-900 rounded-2xl">
                    <Monitor className="w-8 h-8 text-neutral-700" />
                  </div>
                  <div>
                    <p className="font-bold text-neutral-400">Nenhum Caso de Uso Publicado</p>
                    <p className="text-xs text-neutral-600 mt-1 max-w-[250px]">
                      Use o MetaBuilder Studio para criar interfaces incríveis para seus dados.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Informações Técnicas / Agente */}
          <div className="lg:col-span-4 space-y-6">
            <div className="p-8 bg-gradient-to-br from-indigo-900/20 to-neutral-900 border border-indigo-500/20 rounded-[2.5rem] space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                  <Code2 className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-widest text-indigo-400">Status do Agente</h3>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-black/40 rounded-2xl border border-neutral-800 flex items-center justify-between">
                  <span className="text-xs text-neutral-400">ID do Projeto</span>
                  <span className="text-[10px] font-mono text-white bg-neutral-800 px-2 py-0.5 rounded truncate max-w-[120px]">
                    {project.id}
                  </span>
                </div>
                <div className="p-4 bg-black/40 rounded-2xl border border-neutral-800">
                  <span className="text-xs text-neutral-400 block mb-2">Token Secreto</span>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-500">••••••••••••••••</span>
                    <button className="text-[10px] font-bold text-indigo-400 uppercase">Copiar</button>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                  <div>
                    <p className="text-xs font-bold">Conexão Estabelecida</p>
                    <p className="text-[10px] text-neutral-500">Túnel seguro rodando via Agente CLI.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] space-y-4">
              <h4 className="font-bold text-sm">Próximos Passos</h4>
              <ul className="space-y-3">
                {[
                  'Crie uma View customizada',
                  'Configure os campos de exibição',
                  'Defina widgets de entrada',
                  'Compartilhe a URL do App'
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-3 text-xs text-neutral-400">
                    <div className="w-5 h-5 bg-neutral-800 rounded-full flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </div>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
