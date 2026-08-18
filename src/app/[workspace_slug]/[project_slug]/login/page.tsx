import { createClient } from '@supabase/supabase-js'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { getLocale } from '@/i18n/get-locale'
import { getTranslations } from '@/i18n/get-translations'
import { LoginPortalClient } from '@/components/auth/LoginPortalClient'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default async function LoginPage({ params, searchParams }: any) {
  const { workspace_slug, project_slug } = await params
  const resolvedSearchParams = await searchParams
  const locale = await getLocale()
  const t = await getTranslations(locale)
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
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
    .maybeSingle()

  const visual = config?.ui_config as any || {}
  const auth = {
    ...(config as any || { auth_type: 'none' }),
    allow_signup: visual.allow_signup || false,
    sync_legacy_groups: visual.sync_legacy_groups || false,
    db_groups_table: visual.db_groups_table || '',
    db_groups_name_column: visual.db_groups_name_column || '',
    db_user_groups_type: visual.db_user_groups_type || '1_to_n',
    db_user_role_column: visual.db_user_role_column || '',
    db_user_roles_table: visual.db_user_roles_table || '',
    db_user_roles_user_id_column: visual.db_user_roles_user_id_column || '',
    db_user_roles_role_id_column: visual.db_user_roles_role_id_column || '',
    db_display_name_column: visual.db_display_name_column || ''
  }
  const allowSignup = visual.allow_signup || false
  
  const headersList = await headers()
  const isCustomDomain = headersList.get('x-custom-domain') === 'true'
  const customDomainType = headersList.get('x-custom-domain-type')
  
  if (auth.auth_type === 'none') {
    if (isCustomDomain && customDomainType !== 'workspace') {
      redirect('/auth/session-expired')
    } else if (isCustomDomain && customDomainType === 'workspace') {
      redirect(`/${project_slug}`)
    } else {
      redirect(`/${workspace_slug}/${project_slug}`)
    }
  }
  
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

  // 4. Buscar schema da tabela de auth
  const { data: models } = await supabase
    .from('models')
    .select('db_table_name, db_schema_name')
    .eq('project_id', project.id)
  
  const authModel = models?.find(m => m.db_table_name === auth.db_table_name)
  const schemaName = authModel?.db_schema_name || 'public'

  return (
    <LoginPortalClient
      project={project}
      authConfig={auth}
      visualConfig={visual}
      locale={locale}
      workspaceSlug={workspace_slug}
      projectSlug={project_slug}
      schemaName={schemaName}
      isCustomDomain={isCustomDomain}
      customDomainType={customDomainType || undefined}
      initialIsStandalone={resolvedSearchParams?.standalone === 'true'}
    />
  )
}
