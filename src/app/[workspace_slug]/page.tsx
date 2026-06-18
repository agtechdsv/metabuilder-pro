import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Database, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PortalPageProps {
  params: Promise<{
    workspace_slug: string
  }>
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { workspace_slug } = await params
  const supabase = await createClient()

  // 1. Resolve Workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', workspace_slug)
    .single()

  if (workspaceError || !workspace) notFound()

  // Verify if portal is enabled
  if (!workspace.theme_config?.portal_enabled) {
    notFound() // Hide portal if disabled
  }

  // 2. Fetch Projects that have show_in_portal enabled
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const portalProjects = (projects || []).filter(p => p.theme_config?.show_in_portal)

  if (portalProjects.length === 0) {
    // Maybe show an empty state, but let's just let it render the empty grid
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none opacity-30" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-6">
          Portal de Aplicações
        </div>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
          {workspace.name}
        </h1>
        <p className="text-neutral-400 max-w-xl text-lg">
          Selecione uma aplicação abaixo para acessar.
        </p>
      </header>

      {/* Projects Grid */}
      <main className="relative z-10 flex-grow w-full max-w-6xl mx-auto px-6 pb-24">
        {portalProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portalProjects.map((project) => (
              <Link
                key={project.id}
                href={`/${workspace.slug}/${project.slug}/login`}
                className="group relative bg-white/[0.02] border border-white/10 hover:border-indigo-500/50 rounded-3xl p-6 transition-all duration-500 hover:bg-white/[0.04] overflow-hidden flex flex-col"
              >
                {/* Glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/10 transition-colors duration-500" />
                
                {/* Project Banner or Icon Area */}
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30">
                  {project.theme_config?.login_logo_url ? (
                    <img src={project.theme_config.login_logo_url} alt={project.name} className="w-8 h-8 object-contain" />
                  ) : (
                    <Database className="w-7 h-7 text-neutral-400 group-hover:text-indigo-400 transition-colors" />
                  )}
                </div>

                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                    {project.name}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-neutral-400 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className="mt-8 flex items-center text-xs font-bold uppercase tracking-widest text-indigo-400 group-hover:text-indigo-300">
                  Acessar
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform duration-500" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
              <Database className="w-8 h-8 text-neutral-600" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhum projeto disponível</h3>
            <p className="text-neutral-500 max-w-md">
              Não há projetos configurados para aparecer neste portal no momento.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-white/5 text-center text-xs font-medium text-neutral-600 uppercase tracking-widest">
        Powered by MetaBuilder
      </footer>
    </div>
  )
}
