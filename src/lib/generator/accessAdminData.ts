import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Dados da gestão de acesso que o app exportado leva do MetaBuilder: os grupos, as permissões por tela e o grupo de cada
 * usuário (o app exportado não acessa o Supabase do MetaBuilder, então tudo vira dados do próprio app).
 * Devolve `null` quando o projeto não usa o login "Via Banco de Dados Legado" (a gestão de acesso depende dele).
 */
export async function loadAccessAdminInput(
  supabase: Pick<SupabaseClient, 'from'>,
  projectId: string,
  authConfig: { auth_type?: string | null; ui_config?: any } | null | undefined,
): Promise<{ enabled: true; ui: any; roles: any[]; permissions: any[]; userRoles: any[] } | null> {
  if (!authConfig || authConfig.auth_type !== 'database') return null
  const { data: roles } = await supabase.from('project_roles').select('id, name').eq('project_id', projectId)
  const roleIds = (roles || []).map((r: any) => r.id)
  const [{ data: permissions }, { data: userRoles }] = await Promise.all([
    roleIds.length
      ? supabase.from('project_role_permissions').select('role_id, view_id, can_read, can_write').in('role_id', roleIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('project_user_roles').select('external_user_id, role_id').eq('project_id', projectId),
  ])
  return { enabled: true, ui: authConfig.ui_config || {}, roles: roles || [], permissions: permissions || [], userRoles: userRoles || [] }
}
