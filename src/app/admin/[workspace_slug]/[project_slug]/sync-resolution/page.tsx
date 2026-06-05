import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import SyncResolutionClient from './SyncResolutionClient'

export default async function SyncResolutionPage(props: { params: Promise<{ workspace_slug: string, project_slug: string }> }) {
  const params = await props.params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Fetch Workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('slug', params.workspace_slug)
    .single()

  if (!workspace) redirect('/admin')

  // 2. Fetch Project and Payload
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', params.project_slug)
    .eq('workspace_id', workspace.id)
    .single()

  if (!project || project.sync_status !== 'draft_pending' || !project.last_sync_payload) {
    // Se não estiver em draft pending, manda de volta pro painel do projeto
    redirect(`/admin/${params.workspace_slug}/${params.project_slug}/studio`)
  }

  // 3. Fetch Missing Models
  const { data: existingModels } = await supabase
    .from('models')
    .select('id, db_table_name, display_name, is_missing')
    .eq('project_id', project.id)
    .eq('is_missing', true)

  // 4. Fetch Missing Fields
  const { data: existingFields } = await supabase
    .from('fields')
    .select('id, db_column_name, display_name, model_id')
    .eq('is_missing', true)
    .in('model_id', existingModels?.map(m => m.id) || [])

  const incomingPayload = project.last_sync_payload;
  const incomingTableNames = incomingPayload.map((t: any) => t.name);
  
  // Modelos que não estão mais no payload
  const missingModels = existingModels || [];
  
  // Tabelas novas que vieram no payload mas não existem no banco
  // Para sabermos se existem, temos que pegar TODOS os models do projeto
  const { data: allModels } = await supabase
    .from('models')
    .select('db_table_name')
    .eq('project_id', project.id);
  const allDbTables = allModels?.map(m => m.db_table_name) || [];

  const newTables = incomingTableNames.filter((name: string) => !allDbTables.includes(name));

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-8 mt-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Aviso de Sincronização</h1>
        <p className="text-gray-500 dark:text-gray-400">
          O MetaBuilderPRO detectou tabelas ou colunas que sumiram do seu banco de dados desde a última sincronização. 
          Isso geralmente acontece quando uma tabela foi renomeada no banco de dados legado.
          Por favor, mapeie as alterações abaixo para que seus Fluxos e Casos de Uso não sejam perdidos.
        </p>
      </div>

      <SyncResolutionClient 
        projectId={project.id}
        missingModels={missingModels}
        missingFields={existingFields || []}
        incomingPayload={incomingPayload}
        newTables={newTables}
        workspaceSlug={params.workspace_slug}
        projectSlug={params.project_slug}
      />
    </div>
  )
}
