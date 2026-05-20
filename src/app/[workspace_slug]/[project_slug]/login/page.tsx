import { createClient } from '@supabase/supabase-js'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { getLocale } from '@/i18n/get-locale'
import { getTranslations } from '@/i18n/get-translations'
import { LoginPortalClient } from '@/components/auth/LoginPortalClient'

export default async function LoginPage({ params }: any) {
  const { workspace_slug, project_slug } = await params
  const locale = await getLocale()
  const t = await getTranslations(locale)
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Verificar se o projeto existe e está ativo
  const { data: project } = await supabase
    .from('projects')
    .select('*, workspaces!inner(*)')
    .eq('slug', project_slug)
    .eq('workspaces.slug', workspace_slug)
    .single()

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 dark:bg-[#050505] p-6">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-[2.5rem] p-12 text-center shadow-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">Projeto não encontrado</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Verifique a URL ou entre em contato com o administrador.</p>
        </div>
      </div>
    )
  }

  // 2. Buscar configurações de visual
  const { data: config } = await supabase
    .from('project_auth_config')
    .select('*')
    .eq('project_id', project.id)
    .single()

  const visual = config?.ui_config as any || {}
  const auth = config as any || {}
  const allowSignup = visual.allow_signup || false
  
  // 3. Verificar se o projeto está inativo
  if (!project.is_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-100 dark:bg-[#050505] p-6">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-[2.5rem] p-12 text-center shadow-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">{t('app.project_inactive')}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {t('app.project_inactive_desc')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <LoginPortalClient
      project={project}
      authConfig={auth}
      visualConfig={visual}
      locale={locale}
      workspaceSlug={workspace_slug}
      projectSlug={project_slug}
    />
  )
}
