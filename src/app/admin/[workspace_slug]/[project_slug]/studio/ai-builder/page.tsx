import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { AIBuilderChat } from '@/components/studio/AIBuilder/AIBuilderChat'

export default async function AIBuilderPage({
  params,
}: {
  params: Promise<{ workspace_slug: string; project_slug: string }>
}) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verifica PRO
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('slug', workspace_slug)
    .single()

  if (!workspace) return notFound()

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (!project) return notFound()

  // Verifica se a chave de IA está configurada para este workspace
  const { data: aiConfig } = await supabase
    .from('ai_builder_configs')
    .select('id, provider, model')
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  const isPro = profile?.subscription_tier === 'pro'

  return (
    <div className="w-full h-full flex flex-col">
      <Breadcrumbs
        workspaceName={workspace.name}
        workspaceSlug={workspace_slug}
        projectName={project.name}
        projectSlug={project_slug}
      />

      {!isPro ? (
        <div className="flex flex-col items-center justify-center flex-grow p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6">
            <span className="text-4xl">🤖</span>
          </div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">AI Builder</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-sm mb-6">
            Gere casos de uso completos com IA usando a chave de API de sua preferência. Recurso exclusivo do plano PRO.
          </p>
          <a
            href={`/admin/${workspace_slug}/settings`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold shadow-lg shadow-violet-600/20 transition-all"
          >
            🔒 Ver Planos PRO
          </a>
        </div>
      ) : !aiConfig ? (
        <div className="flex flex-col items-center justify-center flex-grow p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6">
            <span className="text-4xl">🔑</span>
          </div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">Configure sua Chave de IA</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-sm mb-6">
            Para usar o AI Builder, configure sua chave de API de IA nas Configurações do Workspace.
          </p>
          <a
            href={`/admin/${workspace_slug}/settings`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold shadow-lg shadow-violet-600/20 transition-all"
          >
            Ir para Configurações →
          </a>
        </div>
      ) : (
        <div className="flex-grow min-h-0 overflow-hidden">
          <AIBuilderChat
            workspaceId={workspace.id}
            workspaceSlug={workspace_slug}
            projectId={project.id}
            projectSlug={project_slug}
            projectSecretToken={project.secret_token}
          />
        </div>
      )}
    </div>
  )
}
