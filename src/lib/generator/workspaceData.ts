import type { SupabaseClient } from '@supabase/supabase-js'
import { loadAccessAdminInput } from './accessAdminData'

/**
 * Projetos de um workspace no formato que o gerador lê (modelos, campos, telas, relações e o login de cada um).
 * Compartilhado pelas rotas de exportação do workspace (download e IDE Local).
 */
export async function fetchWorkspaceProjects(
  supabase: Pick<SupabaseClient, 'from'>,
  workspaceId: string,
  opts: { accessAdmin?: boolean } = {},
): Promise<any[]> {
  const { data: projects } = await supabase.from('projects').select('*').eq('workspace_id', workspaceId)
  if (!projects || projects.length === 0) return []

  return Promise.all(projects.map(async (project: any) => {
    const projectId = project.id

    const [{ data: models }, { data: uiViewsPublished }, { data: relations }, { data: authConfig }, { data: enumerations }] = await Promise.all([
      supabase.from('models').select('*, fields(*)').eq('project_id', projectId),
      supabase.from('ui_views').select('*, ui_components(*)').eq('project_id', projectId).eq('status', 'published').order('created_at', { ascending: true }),
      supabase.from('relations').select('*').eq('project_id', projectId),
      supabase.from('project_auth_config').select('*').eq('project_id', projectId).maybeSingle(),
      supabase.from('project_enumerations').select('*').eq('project_id', projectId),
    ])

    // Sem telas publicadas, usa todas
    let finalViews: any[] | null = uiViewsPublished
    if (!finalViews || finalViews.length === 0) {
      const { data: allViews } = await supabase.from('ui_views').select('*, ui_components(*)').eq('project_id', projectId).order('created_at', { ascending: true })
      finalViews = allViews
    }
    const components = (finalViews || []).flatMap((v: any) => v.ui_components || [])

    // Gestão de acesso só nos projetos com login "Via Banco de Dados"; nos demais, a opção simplesmente não se aplica
    const access = opts.accessAdmin ? await loadAccessAdminInput(supabase, projectId, authConfig as any) : null

    return {
      ...project,
      models: models || [],
      views: finalViews || [],
      fields: (models || []).flatMap((m: any) => m.fields || []),
      components,
      relations: relations || [],
      enumerations: enumerations || [],
      auth_config: authConfig ? {
        auth_type: (authConfig as any).auth_type,
        table_name: (authConfig as any).db_table_name,
        email_column: (authConfig as any).db_email_column,
        password_column: (authConfig as any).db_password_column,
        hash_format: (authConfig as any).db_password_hash_type,
        table_access: (authConfig as any).ui_config?.table_access,
      } : undefined,
      ...(access ? { access_admin: access } : {}),
    }
  }))
}

/** `[{ projectId, type, connectionString }]` (como a IDE envia) → mapa por projeto, sem aceitar valores que não sejam texto. */
export function connectionsMap(input: unknown): Record<string, { type?: string; connectionString?: string }> {
  const out: Record<string, { type?: string; connectionString?: string }> = {}
  if (!Array.isArray(input)) return out
  for (const c of input) {
    if (!c || typeof c.projectId !== 'string') continue
    out[c.projectId] = {
      type: typeof c.type === 'string' ? c.type : undefined,
      connectionString: typeof c.connectionString === 'string' ? c.connectionString : undefined,
    }
  }
  return out
}
