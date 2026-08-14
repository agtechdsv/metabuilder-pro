import { createClient as createAdminClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ChevronRight, Database, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HeaderActions } from '@/components/layout/HeaderActions'

interface PortalPageProps {
  params: Promise<{
    workspace_slug: string
  }>
}

export default async function PortalPage({ params }: PortalPageProps) {
  const { workspace_slug } = await params
  
  const headersList = await headers()
  const isCustomDomain = headersList.get('x-custom-domain') === 'true'
  
  // Create an admin client to bypass RLS for the public portal
  const supabase = createAdminClient(
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

  // 2. Fetch Projects that have show_in_portal enabled
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('workspace_id', workspace.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  const portalProjects = (projects || []).filter(p => p.theme_config?.show_in_portal)

  if (portalProjects.length === 0) {
    notFound() // Hide portal if there are no projects configured to be shown
  }

  const portalLogo = workspace.theme_config?.portal_logo_url
  const portalBanner = workspace.theme_config?.portal_banner_url

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-white flex flex-col relative overflow-hidden transition-colors duration-500">
      {/* Background Gradients & Banner */}
      {portalBanner ? (
        <>
          <div className="absolute top-0 left-0 w-full h-[60vh] md:h-[70vh]">
            <div className="absolute inset-0 bg-neutral-900/40 dark:bg-black/60 z-10" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-50/50 to-neutral-50 dark:via-[#050505]/80 dark:to-[#050505] z-10" />
            <img src={portalBanner} alt="Portal Banner" className="w-full h-full object-cover object-center" />
          </div>
        </>
      ) : (
        <>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/10 dark:bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none opacity-50" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/5 dark:bg-purple-600/10 blur-[120px] rounded-full pointer-events-none opacity-30" />
        </>
      )}

      {/* Top Right Actions */}
      <div className="absolute top-6 right-6 z-50">
        <HeaderActions hideUser={true} />
      </div>

      {/* Header */}
      <header className={`relative z-20 w-full max-w-6xl mx-auto px-6 flex flex-col items-center text-center ${portalBanner ? 'pt-32 pb-20 md:pt-40 md:pb-24' : 'py-16 md:py-24'}`}>
        {portalLogo ? (
          <div className="mb-8 w-24 h-24 md:w-32 md:h-32 bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/20 dark:border-white/10 p-4 rounded-3xl shadow-2xl flex items-center justify-center">
            <img src={portalLogo} alt={workspace.name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-neutral-200 dark:border-white/10 rounded-full text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-8 shadow-sm">
            Portal de Aplicações
          </div>
        )}
        
        <h1 className={`text-5xl md:text-7xl font-black tracking-tighter mb-6 ${portalBanner ? 'text-neutral-900 dark:text-white drop-shadow-md' : 'text-transparent bg-clip-text bg-gradient-to-br from-neutral-900 to-neutral-500 dark:from-white dark:to-white/50'}`}>
          {workspace.name}
        </h1>
        <p className={`max-w-2xl text-lg md:text-xl font-medium ${portalBanner ? 'text-neutral-700 dark:text-neutral-300 drop-shadow-sm' : 'text-neutral-500 dark:text-neutral-400'}`}>
          Acesse suas aplicações e gerencie seus negócios em um só lugar.
        </p>
      </header>

      {/* Projects Grid */}
      <main className="relative z-20 flex-grow w-full max-w-6xl mx-auto px-6 pb-24">
        {portalProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {portalProjects.map((project) => (
              <Link
                key={project.id}
                href={isCustomDomain ? `/${project.slug}/login` : `/${workspace.slug}/${project.slug}/login`}
                className="group relative bg-white/80 dark:bg-white/[0.02] backdrop-blur-xl border border-neutral-200/50 dark:border-white/10 hover:border-indigo-500/50 rounded-[2rem] p-8 transition-all duration-500 hover:bg-white dark:hover:bg-white/[0.04] hover:-translate-y-1 overflow-hidden flex flex-col shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(79,70,229,0.1)] dark:shadow-none"
              >
                {/* Glow on hover */}
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/10 dark:bg-indigo-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                {/* Project Banner or Icon Area */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neutral-100 to-neutral-50 dark:from-white/10 dark:to-white/5 border border-neutral-200/50 dark:border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-sm">
                  {project.theme_config?.login_logo_url ? (
                    <img src={project.theme_config.login_logo_url} alt={project.name} className="w-10 h-10 object-contain" />
                  ) : (
                    <Database className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
                  )}
                </div>

                <div className="flex-1 relative z-10">
                  <h3 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {project.name}
                  </h3>
                  <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                    {project.description || 'Acesse o ambiente completo desta aplicação.'}
                  </p>
                </div>

                <div className="mt-10 flex items-center text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-500 transition-colors relative z-10">
                  Entrar no Sistema
                  <div className="ml-3 w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-center bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-[3rem] border border-neutral-200/50 dark:border-white/10">
            <div className="w-20 h-20 bg-neutral-100 dark:bg-black/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Database className="w-10 h-10 text-neutral-400 dark:text-neutral-600" />
            </div>
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white mb-3">Nenhum projeto disponível</h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-md font-medium text-lg">
              Não há projetos configurados para aparecer neste portal no momento.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-20 py-8 text-center text-xs font-black text-neutral-400/80 dark:text-neutral-600 uppercase tracking-[0.2em] mt-auto">
        Powered by MetaBuilder
      </footer>
    </div>
  )
}
