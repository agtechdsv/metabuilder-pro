import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Acesso do USUÁRIO FINAL ao módulo Automações (o editor de fluxos). Regra única, usada pelo botão "Automações" das telas e pela
 * própria página /automations: "negado por padrão". Sem login configurado no projeto, todos entram; com login, só quem tem uma sessão
 * e cujo perfil (grupo) tem `can_read = true` explícito na tela "automations".
 * Falhou ao ler qualquer coisa: nega (falha fechada). O dono do projeto (login do MetaBuilder) é tratado à parte, por quem chama.
 */
export async function endUserMayOpenAutomations(
  supabase: Pick<SupabaseClient, 'from'>,
  args: { projectId: string; viewId: string; sessionCookie?: string | null },
): Promise<boolean> {
  try {
    const { data: rawAuthConfig } = await supabase
      .from('project_auth_config')
      .select('*')
      .eq('project_id', args.projectId)
      .maybeSingle()

    const isNoAuth = !rawAuthConfig || (rawAuthConfig as any).auth_type === 'none'
    if (isNoAuth) return true
    if (!args.sessionCookie) return false

    const uiConfig = ((rawAuthConfig as any)?.ui_config || {}) as any
    const clientUser = JSON.parse(decodeURIComponent(args.sessionCookie))
    if (!clientUser || typeof clientUser !== 'object') return false

    let roleId: any = null
    if (uiConfig.sync_legacy_groups) {
      const roleKey = uiConfig.db_user_role_column || 'role_id'
      roleId = clientUser[roleKey]
    }
    if (!roleId) {
      const { data: userRole } = await supabase
        .from('project_user_roles')
        .select('role_id')
        .eq('project_id', args.projectId)
        .eq('external_user_id', clientUser.id?.toString())
        .maybeSingle()
      roleId = (userRole as any)?.role_id
    }
    if (!roleId) return false

    const { data: allowed } = await supabase
      .from('project_role_permissions')
      .select('id')
      .eq('role_id', roleId)
      .eq('view_id', args.viewId)
      .eq('can_read', true)
      .limit(1)
      .maybeSingle()
    return !!allowed
  } catch {
    return false
  }
}
