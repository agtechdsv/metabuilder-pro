import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/utils/supabase/server'
import { cookies, notFound } from 'next/headers'
import { AlertCircle } from 'lucide-react'
import { DownloadsManagerClient } from '@/components/runtime/DownloadsManagerClient'

interface PageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
}

export default async function DownloadsPage({ params }: PageProps) {
  const { workspace_slug, project_slug } = await params

  // 1. Inicializa o cliente Supabase com service_role para evitar restrições de RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 2. Busca o Workspace e o Projeto
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', workspace_slug)
    .limit(1)

  const workspace = workspaces?.[0]
  if (!workspace) notFound()

  const { data: projects } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .limit(1)

  const project = projects?.[0]
  if (!project) notFound()

  // 3. Resolve a sessão do usuário
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(`client_session_${project.id}`)?.value

  let clientUser = null
  if (sessionCookie) {
    try {
      clientUser = JSON.parse(decodeURIComponent(sessionCookie))
    } catch (e) {
      console.error('Error parsing client session cookie:', e)
    }
  }

  let userId = clientUser?.id ? clientUser.id.toString() : null

  if (!userId) {
    // Fallback: verifica se há sessão administrativa/dev do Supabase
    const supabaseServer = await createServerClient()
    const { data: { user } } = await supabaseServer.auth.getUser()
    if (user) {
      userId = user.id
    }
  }

  // 4. Se não estiver autenticado de nenhuma forma, renderiza "Acesso Restrito"
  if (!userId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-10 text-center">
        <div className="p-4 bg-red-100 dark:bg-red-950/40 rounded-3xl text-red-600 mb-4 shadow-xl shadow-red-500/10">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
          Acesso Restrito
        </h2>
        <p className="text-xs text-neutral-400 mt-2 max-w-sm">
          Por favor, faça login no sistema para visualizar seu histórico de downloads e exportações assíncronas.
        </p>
      </div>
    )
  }

  // 5. Verifica as permissões RBAC para a view "downloads"
  const { data: viewRow } = await supabase
    .from('ui_views')
    .select('id')
    .eq('slug', 'downloads')
    .eq('project_id', project.id)
    .maybeSingle()

  let isAuthorized = true

  if (viewRow) {
    // Busca o papel do usuário no projeto
    const { data: userRole } = await supabase
      .from('project_user_roles')
      .select('role_id')
      .eq('project_id', project.id)
      .eq('external_user_id', userId)
      .maybeSingle()

    if (userRole?.role_id) {
      // Verifica se o downloads está explicitamente negado (can_read = false)
      const { data: deniedPermission } = await supabase
        .from('project_role_permissions')
        .select('id')
        .eq('role_id', userRole.role_id)
        .eq('view_id', viewRow.id)
        .eq('can_read', false)
        .maybeSingle()

      if (deniedPermission) {
        isAuthorized = false
      }
    } else {
      // Se não há grupo atribuído, acesso negado
      isAuthorized = false
    }
  }

  // 6. Se o acesso for negado pelo RBAC, renderiza "Acesso Negado"
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-[2.5rem] bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-lg shadow-red-500/5">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2 tracking-tight">
          Acesso Negado
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mb-8 leading-relaxed font-bold">
          Você não possui permissões necessárias para visualizar a Central de Downloads.
        </p>
        <a
          href={`/${workspace_slug}/${project_slug}`}
          className="px-6 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 flex items-center justify-center"
        >
          Voltar ao início
        </a>
      </div>
    )
  }

  // 7. Renderiza o gerenciador de downloads no lado do cliente
  return (
    <DownloadsManagerClient
      workspaceSlug={workspace_slug}
      projectSlug={project_slug}
      projectId={project.id}
      userId={userId}
    />
  )
}
