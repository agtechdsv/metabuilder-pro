import { createClient } from '@/utils/supabase/server'
import { 
  Building2, 
  Plus, 
  ArrowUpRight, 
  LayoutGrid, 
  Users, 
  Activity,
  ChevronRight,
  Search
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

/**
 * MetaBuilderPRO - Dashboard Global
 * A primeira tela que o usuário vê após o login.
 */
export default async function GlobalDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Busca os Workspaces do usuário
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*, projects(count)')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      
      {/* Header do Dashboard */}
      <header className="border-b border-neutral-900 bg-neutral-950/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <LayoutGrid className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">MetaBuilder<span className="text-indigo-500">PRO</span></h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" />
              <input 
                type="text" 
                placeholder="Buscar recursos..."
                className="bg-neutral-900 border border-neutral-800 rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <div className="w-10 h-10 bg-neutral-800 rounded-full border border-neutral-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-neutral-400" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12 space-y-12">
        
        {/* Boas vindas e Atividade */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-indigo-500 font-bold text-xs uppercase tracking-widest">Painel Administrativo</p>
            <h2 className="text-4xl font-extrabold tracking-tight">Bem-vindo, {user.email?.split('@')[0]}</h2>
            <p className="text-neutral-500">Gerencie seus ambientes de trabalho e arquiteturas de dados.</p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]">
            <Plus className="w-5 h-5" /> Novo Workspace
          </button>
        </section>

        {/* Stats Rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Workspaces Ativos', value: workspaces?.length || 0, icon: Building2, color: 'blue' },
            { label: 'Total de Projetos', value: workspaces?.reduce((acc, w) => acc + (w.projects?.[0]?.count || 0), 0) || 0, icon: Activity, color: 'indigo' },
            { label: 'Uso de Banda', value: '1.2 GB', icon: Activity, color: 'green' }
          ].map((stat, i) => (
            <div key={i} className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-[2rem] flex items-center justify-between">
              <div>
                <p className="text-neutral-500 text-sm font-medium">{stat.label}</p>
                <p className="text-3xl font-black mt-1">{stat.value}</p>
              </div>
              <div className={`p-4 bg-${stat.color}-500/10 rounded-2xl text-${stat.color}-500 border border-${stat.color}-500/20`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
          ))}
        </div>

        {/* Lista de Workspaces */}
        <section className="space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-3">
            <Building2 className="w-6 h-6 text-indigo-500" />
            Seus Workspaces
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces?.map((workspace) => (
              <Link 
                key={workspace.id}
                href={`/admin/${workspace.slug}`}
                className="group relative p-8 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] hover:border-indigo-500/50 transition-all duration-500 overflow-hidden"
              >
                {/* Efeito de Glow no Hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[60px] group-hover:bg-indigo-600/20 transition-all"></div>
                
                <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                  <div className="space-y-4">
                    <div className="w-14 h-14 bg-neutral-800 rounded-2xl flex items-center justify-center border border-neutral-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
                      <Building2 className="w-7 h-7 text-neutral-400 group-hover:text-indigo-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-bold group-hover:text-white transition-colors">{workspace.name}</h4>
                      <p className="text-sm text-neutral-500 font-mono">/{workspace.slug}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-neutral-800/50">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-tighter">
                      {workspace.projects?.[0]?.count || 0} Projetos
                    </span>
                    <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center group-hover:bg-indigo-600 transition-all">
                      <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {/* Empty State / Add New */}
            <button className="group p-8 bg-neutral-950 border border-dashed border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:bg-neutral-900 hover:border-indigo-500/30 transition-all min-h-[280px]">
              <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-neutral-700 group-hover:text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-neutral-400 group-hover:text-neutral-200 transition-colors">Novo Workspace</p>
                <p className="text-xs text-neutral-600 mt-1">Crie um ambiente para sua empresa.</p>
              </div>
            </button>
          </div>
        </section>

      </main>
    </div>
  )
}
