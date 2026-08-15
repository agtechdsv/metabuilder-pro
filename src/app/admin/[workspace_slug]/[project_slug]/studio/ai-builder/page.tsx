import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { AIBuilderChat } from '@/components/studio/AIBuilder/AIBuilderChat'
import { AIBuilderConfigTrigger } from '@/components/studio/AIBuilder/AIBuilderConfigTrigger'

export default async function AIBuilderPage({
  params,
}: {
  params: Promise<{ workspace_slug: string; project_slug: string }>
}) {
  const { workspace_slug, project_slug } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/session-expired')

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

  // Usa admin para bypassar RLS e verificar se a chave existe (mesmo para devs)
  const { createClient: createAdmin } = await import('@supabase/supabase-js')
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: aiConfig } = await admin
    .from('ai_builder_configs')
    .select('id, provider, model')
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  const isPro = profile?.subscription_tier === 'pro'
  const isOwner = user.id === workspace.owner_id

  const { getLocale } = await import('@/i18n/get-locale')
  const { getTranslations } = await import('@/i18n/get-translations')
  const locale = await getLocale()
  const t = await getTranslations(locale)

  return (
    <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 150px)' }}>
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
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">{t('studio.ai_builder.pro_only_title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-sm mb-6">
            {t('studio.ai_builder.pro_only_desc')}
          </p>
          <a
            href={`/admin/${workspace_slug}/settings`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold shadow-lg shadow-violet-600/20 transition-all"
          >
            {t('studio.ai_builder.see_pro_plans')}
          </a>
        </div>
      ) : !aiConfig ? (
        <div className="flex flex-col items-center justify-center flex-grow p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-3xl flex items-center justify-center mb-6">
            <span className="text-4xl">🔑</span>
          </div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2">
            {isOwner ? t('studio.ai_builder.config_key_title_owner') : t('studio.ai_builder.config_key_title_dev')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm max-w-sm mb-6">
            {isOwner 
              ? t('studio.ai_builder.config_key_desc_owner')
              : t('studio.ai_builder.config_key_desc_dev')}
          </p>
          {isOwner && <AIBuilderConfigTrigger workspaceId={workspace.id} isPro={isPro} />}
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
