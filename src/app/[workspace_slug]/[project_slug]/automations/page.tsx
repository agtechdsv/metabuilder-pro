import { BpmCanvas } from '@/components/studio/bpm/BpmCanvas';
import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { getLocale } from '@/i18n/get-locale'
import { getTranslations } from '@/i18n/get-translations'
import { cookies } from 'next/headers'
import { clientSessionCookie, publicProject } from '@/lib/tunnel/runtimeServer'
import { authorizeProjectMember } from '@/lib/tunnel/authorize'
import { endUserMayOpenAutomations } from '@/lib/automationsAccess'
import { AutomationsHub } from '@/components/runtime/AutomationsHub'
import { automationsHref, filterFlowsByScope, parseScopeParams, primaryScopeOf, scopeCounts, triggerModelIds } from '@/lib/bpm/flowScope'

export const metadata: Metadata = {
  title: 'Automação de processos | MetaBuilder PRO',
  description: 'Visual Business Process Management',
};

interface PageProps {
  params: Promise<{
    workspace_slug: string
    project_slug: string
  }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AutomationsPage({ params, searchParams }: PageProps) {
  const { workspace_slug, project_slug } = await params
  const resolvedSearchParams = await searchParams
  const useCaseId = resolvedSearchParams?.use_case as string | undefined

  const locale = await getLocale()
  const t = await getTranslations(locale)

  // 1. Inicializa o cliente Supabase com service_role
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
    .select('id, secret_token')
    .eq('slug', project_slug)
    .eq('workspace_id', workspace.id)
    .limit(1)

  const project = projects?.[0]
  if (!project) notFound()

  // Fetch auth config properly
  const { data: config } = await supabase
    .from('project_auth_config')
    .select('*')
    .eq('project_id', project.id)
    .maybeSingle()
    
  if (config) {
    (project as any).auth_config = {
      ...config,
      sync_legacy_groups: config.ui_config?.sync_legacy_groups || false,
      db_groups_table: config.ui_config?.db_groups_table || '',
      db_groups_name_column: config.ui_config?.db_groups_name_column || '',
      db_user_groups_type: config.ui_config?.db_user_groups_type || '1_to_n',
      db_user_role_column: config.ui_config?.db_user_role_column || '',
      db_user_roles_table: config.ui_config?.db_user_roles_table || '',
      db_user_roles_user_id_column: config.ui_config?.db_user_roles_user_id_column || '',
      db_user_roles_role_id_column: config.ui_config?.db_user_roles_role_id_column || '',
    };
  }
  if (!project) notFound()

  // 3. Verifica se a view de Automations está ativa
  const { data: automationsView } = await supabase
    .from('ui_views')
    .select('id, name, layout_config')
    .eq('slug', 'automations')
    .eq('project_id', project.id)
    .maybeSingle()

  const isActive = automationsView?.layout_config?.is_active !== false

  if (!isActive) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-[2.5rem] bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-6 shadow-lg shadow-amber-500/5">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2 tracking-tight">
          Módulo Desativado
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mb-8 leading-relaxed font-bold">
          O módulo de Automação de processos não está habilitado para este projeto. Entre em contato com o administrador do sistema.
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

  // 3.5. Quem pode abrir o editor: o dono do projeto (login do MetaBuilder) ou o usuário final cujo perfil tem a permissão da tela
  // "Automações" (negado por padrão; sem login configurado, todos). ANTES de ler qualquer dado: o servidor monta a página com a
  // chave de serviço, então o que for lido aqui vai no HTML mesmo que a tela seja escondida depois.
  const cookieStore = await cookies()
  const mayOpen =
    !!(await authorizeProjectMember(project.id)) ||
    (!!automationsView &&
      (await endUserMayOpenAutomations(supabase, {
        projectId: project.id,
        viewId: automationsView.id,
        sessionCookie: clientSessionCookie(cookieStore, project.id),
      })))
  if (!mayOpen) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-[2.5rem] bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-lg shadow-red-500/5">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-neutral-900 dark:text-white mb-2 tracking-tight">
          {t('runtime.automations_denied_title')}
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-sm mb-8 leading-relaxed font-bold">
          {t('runtime.automations_denied_desc')}
        </p>
        <a
          href={`/${workspace_slug}/${project_slug}`}
          className="px-6 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20 flex items-center justify-center"
        >
          {t('runtime.downloads_back_home')}
        </a>
      </div>
    )
  }

  // 4. Escopo: o fluxo é da TABELA (ou "Geral", sem tabela), não do caso de uso. Sem escopo na URL, mostra o painel de escolha.
  const base = `/${workspace_slug}/${project_slug}`
  const scope = parseScopeParams(resolvedSearchParams)

  // Endereço antigo (/automations?use_case=<id>, do botão que morava nos casos de uso): leva para a tabela do caso de uso
  if (useCaseId && !scope) {
    const { data: useCase } = await supabase
      .from('ui_views')
      .select('model_id')
      .eq('id', useCaseId)
      .eq('project_id', project.id)
      .maybeSingle()
    redirect(automationsHref(base, useCase?.model_id ? { kind: 'table', modelId: String(useCase.model_id) } : null))
  }

  // Todos os fluxos do projeto (o filtro por escopo é feito aqui, no servidor: a coluna use_case_id não decide mais nada)
  const { data: workflowsData } = await supabase
    .from('bpm_workflows')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
  const allWorkflows = workflowsData || []

  if (!scope) {
    const { data: tables } = await supabase
      .from('models')
      .select('id, display_name, db_table_name')
      .eq('project_id', project.id)
    const nameOf = new Map<string, string>((tables || []).map((m: any) => [m.id, m.display_name || m.db_table_name || m.id]))
    const counts = scopeCounts(allWorkflows)
    const statusOf = (w: any): 'published' | 'pending' | 'draft' =>
      w.is_active && w.flow_data ? (w.draft_flow_data ? 'pending' : 'published') : 'draft'
    return (
      <AutomationsHub
        general={counts.general}
        tables={(tables || [])
          .map((m: any) => ({ id: m.id as string, name: nameOf.get(m.id) as string, count: counts.byModel[m.id] || 0, href: automationsHref(base, { kind: 'table', modelId: m.id }) }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))}
        generalHref={automationsHref(base, { kind: 'general' })}
        flows={allWorkflows.map((w: any) => {
          const open = primaryScopeOf(w)
          return {
            id: w.id as string,
            name: w.name as string,
            status: statusOf(w),
            scopes: triggerModelIds(w).map(id => nameOf.get(id) || id),
            href: automationsHref(base, open, w.id),
          }
        })}
        backHref={`${base}/dashboard`}
      />
    )
  }

  // 5. Dados para o editor (modelos com campos e casos de uso com botões; pelo servidor, para evitar o RLS no navegador)
  const [modelsRes, viewsRes] = await Promise.all([
    supabase
      .from('models')
      .select('*, fields(*)')
      .eq('project_id', project.id),
    supabase
      .from('ui_views')
      .select('id, name, layout_config, view_type, model_id')
      .eq('project_id', project.id)
      .eq('view_type', 'advanced_use_case')
  ]);

  const initialModels = modelsRes.data || [];
  const initialViews = viewsRes.data || [];
  const scopeModel = scope.kind === 'table' ? initialModels.find((m: any) => m.id === scope.modelId) : null
  if (scope.kind === 'table' && !scopeModel) redirect(automationsHref(base)) // tabela que não existe mais

  const initialWorkflows = filterFlowsByScope(allWorkflows, scope)
  const wantedFlow = typeof resolvedSearchParams?.flow === 'string' ? resolvedSearchParams.flow : ''
  const scopeName = scope.kind === 'general'
    ? t('bpm.scope.general')
    : String((scopeModel as any)?.display_name || (scopeModel as any)?.db_table_name || '')
  const canvasTitle = `${t('bpm.canvas.automations_title')}: ${scopeName}`

  return (
    <div className="h-screen w-full bg-white dark:bg-neutral-950 overflow-hidden">
      <BpmCanvas 
        title={canvasTitle} 
        defaultAutoAlign={automationsView?.layout_config?.default_auto_align}
        project={publicProject(project)}
        scope={scope}
        hubHref={automationsHref(base)}
        initialWorkflowId={initialWorkflows.some((w: any) => w.id === wantedFlow) ? wantedFlow : undefined}
        initialWorkflows={initialWorkflows}
        initialModels={initialModels}
        initialViews={initialViews}
      />
    </div>
  );
}
