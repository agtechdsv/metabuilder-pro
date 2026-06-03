import { BpmCanvas } from '@/components/studio/bpm/BpmCanvas';
import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Automations & BPM | MetaBuilder PRO',
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
    project.auth_config = {
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
    .select('name, layout_config')
    .eq('slug', 'automations')
    .eq('project_id', project.id)
    .maybeSingle()

  const isActive = automationsView?.layout_config?.is_active === true

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
          O módulo de Automações e BPM não está habilitado para este projeto. Entre em contato com o administrador do sistema.
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

  // 4. Busca o caso de uso se estiver no contexto
  let useCaseName = ''
  if (useCaseId) {
    const { data: viewData } = await supabase
      .from('ui_views')
      .select('name')
      .eq('id', useCaseId)
      .maybeSingle()
    if (viewData?.name) {
      useCaseName = viewData.name
    }
  }

  // 5. Busca dados de workflows e models (com campos) para o BpmCanvas (evita problemas de RLS no cliente)
  const [workflowsRes, modelsRes, viewsRes] = await Promise.all([
    supabase
      .from('bpm_workflows')
      .select('*')
      .eq('project_id', project.id)
      .eq('use_case_id', useCaseId || '')
      .order('created_at', { ascending: false }),
    supabase
      .from('models')
      .select('*, fields(*)')
      .eq('project_id', project.id),
    supabase
      .from('ui_views')
      .select('id, name, layout_config, view_type')
      .eq('project_id', project.id)
      .eq('view_type', 'advanced_use_case')
  ]);

  const initialWorkflows = workflowsRes.data || [];
  const initialModels = modelsRes.data || [];
  const initialViews = viewsRes.data || [];
  
  if (viewsRes.error) {
    console.error("=== VIEWS RES ERROR ===", viewsRes.error);
  } else {
    console.log("=== VIEWS RES DATA LENGTH ===", initialViews.length);
  }

  const canvasTitle = useCaseName ? `Automações: ${useCaseName}` : (automationsView?.name || 'Aprovação de Pedidos');

  return (
    <div className="h-screen w-full bg-white dark:bg-neutral-950 overflow-hidden">
      <BpmCanvas 
        title={canvasTitle} 
        defaultAutoAlign={automationsView?.layout_config?.default_auto_align}
        project={project}
        useCaseId={useCaseId || ''}
        initialWorkflows={initialWorkflows}
        initialModels={initialModels}
        initialViews={initialViews}
      />
    </div>
  );
}
