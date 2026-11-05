import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { HelpCenterClient } from '@/components/runtime/HelpCenterClient'
import { getLocale } from '@/i18n/get-locale'
import { clientSessionCookie } from '@/lib/tunnel/runtimeServer'
import { collectHelpCenter } from '@/lib/helpText'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ workspace_slug: string; project_slug: string }>
}

/**
 * Central de Ajuda do app publicado: /[workspace]/[projeto]/help
 * Reúne a ajuda de tela e as dicas de campo escritas no Studio, no idioma do usuário, com busca.
 * Mesmo acesso das demais telas: projeto aberto, usuário logado no app ou membro do projeto; telas negadas ao grupo do usuário ficam de fora.
 */
export default async function HelpCenterPage({ params }: PageProps) {
  const { workspace_slug, project_slug } = await params
  const language = await getLocale()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: workspaces } = await supabase.from('workspaces').select('id').eq('slug', workspace_slug).limit(1)
  const workspace = workspaces?.[0]
  if (!workspace) notFound()
  const { data: projects } = await supabase.from('projects').select('id, name').eq('slug', project_slug).eq('workspace_id', workspace.id).limit(1)
  const project = projects?.[0]
  if (!project) notFound()

  const cookieStore = await cookies()
  const rawCookie = clientSessionCookie(cookieStore, project.id)
  let clientUser: any = null
  if (rawCookie) {
    try { clientUser = JSON.parse(decodeURIComponent(rawCookie)) } catch { /* sessão ilegível: tratada como sem login */ }
  }

  const { data: auth } = await supabase.from('project_auth_config').select('*').eq('project_id', project.id).maybeSingle()
  const isNoAuth = !auth || auth.auth_type === 'none'
  const uiConfig = (auth?.ui_config as any) || {}

  let userId: string | null = null
  if (clientUser) {
    let pk = 'id'
    if (!isNoAuth && auth?.db_table_name) {
      const { data: models } = await supabase.from('models').select('db_table_name, fields').eq('project_id', project.id)
      pk = models?.find(m => m.db_table_name === auth.db_table_name)?.fields?.find((f: any) => f.is_primary_key)?.db_column_name || 'id'
    }
    const key = Object.keys(clientUser).find(k => k.toLowerCase() === pk.toLowerCase())
    if (key) userId = clientUser[key]?.toString() ?? null
  }
  if (!userId) {
    const { data: { user } } = await (await createServerClient()).auth.getUser()
    if (user) userId = user.id
  }

  if (!userId && !isNoAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-10 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
        <h2 className="text-xl font-black text-neutral-800 dark:text-neutral-200">Acesso restrito</h2>
        <p className="text-xs text-neutral-400 mt-2 max-w-sm">Entre no sistema para ver a Central de Ajuda.</p>
      </div>
    )
  }

  const { data: views } = await supabase
    .from('ui_views')
    .select('id, slug, name, layout_config, model:models(fields(id, display_name, db_column_name))')
    .eq('project_id', project.id)

  // telas que o grupo do usuário não pode ler não entram (mesma regra das telas)
  let denied = new Set<string>()
  if (!isNoAuth && userId) {
    let roleId: any = null
    if (uiConfig.sync_legacy_groups && clientUser) {
      const roleKey = uiConfig.db_user_role_column || 'role_id'
      const k = Object.keys(clientUser).find(x => x.toLowerCase() === String(roleKey).toLowerCase())
      if (k) roleId = clientUser[k]
    }
    if (!roleId) {
      const { data: r } = await supabase.from('project_user_roles').select('role_id').eq('project_id', project.id).eq('external_user_id', userId).maybeSingle()
      roleId = r?.role_id
    }
    if (roleId) {
      const { data: rows } = await supabase.from('project_role_permissions').select('view_id').eq('role_id', roleId).eq('can_read', false)
      denied = new Set((rows || []).map((x: any) => x.view_id))
    }
  }

  const entries = collectHelpCenter((views || []).filter((v: any) => !denied.has(v.id)), language)
  return <HelpCenterClient entries={entries} baseHref={`/${workspace_slug}/${project_slug}`} projectName={project.name} projectId={project.id} />
}
