import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from './server'

/**
 * Configuração de login do projeto, lida NO SERVIDOR. O navegador não manda mais qual tabela e quais colunas validar:
 * isso vem do cadastro do projeto (antes o CLI confiava na configuração enviada pelo navegador).
 */

/** Mesma montagem que a página de login sempre fez a partir de `project_auth_config`. */
export function buildAuthConfig(config: any, visual: any = config?.ui_config || {}) {
  return {
    ...(config || { auth_type: 'none' }),
    allow_signup: visual.allow_signup || false,
    sync_legacy_groups: visual.sync_legacy_groups || false,
    db_groups_table: visual.db_groups_table || '',
    db_groups_name_column: visual.db_groups_name_column || '',
    db_user_groups_type: visual.db_user_groups_type || '1_to_n',
    db_user_role_column: visual.db_user_role_column || '',
    db_user_roles_table: visual.db_user_roles_table || '',
    db_user_roles_user_id_column: visual.db_user_roles_user_id_column || '',
    db_user_roles_role_id_column: visual.db_user_roles_role_id_column || '',
    db_display_name_column: visual.db_display_name_column || '',
  }
}

/** Schema onde fica a tabela de usuários (ou o primeiro schema do projeto). */
export function pickSchemaName(models: Array<{ db_table_name?: string | null; db_schema_name?: string | null }> | null | undefined, auth: { db_table_name?: string }): string {
  const authModel = models?.find(m => m.db_table_name?.toLowerCase() === auth.db_table_name?.toLowerCase())
  return authModel?.db_schema_name || models?.[0]?.db_schema_name || 'public'
}

export interface LoginSetup {
  project: { id: string; name?: string; is_active?: boolean; theme_config?: any }
  auth: ReturnType<typeof buildAuthConfig>
  visual: any
  schemaName: string
  /** segurança extra exigida depois da senha */
  security: { mfa_enabled: boolean; passkey_enabled: boolean }
}

export async function loadLoginSetup(projectId: string, client: Pick<SupabaseClient, 'from'> = serviceClient()): Promise<LoginSetup | null> {
  const { data: project } = await client.from('projects').select('id, name, is_active, theme_config').eq('id', projectId).maybeSingle()
  if (!project) return null
  const { data: config } = await client.from('project_auth_config').select('*').eq('project_id', projectId).maybeSingle()
  const { data: models } = await client.from('models').select('db_table_name, db_schema_name').eq('project_id', projectId)
  const visual = (config as any)?.ui_config || {}
  const auth = buildAuthConfig(config, visual)
  const sec = (project as any).theme_config?.security || {}
  return {
    project: project as any,
    auth,
    visual,
    schemaName: pickSchemaName(models as any, auth as any),
    security: { mfa_enabled: !!sec.mfa_enabled, passkey_enabled: !!sec.passkey_enabled },
  }
}
