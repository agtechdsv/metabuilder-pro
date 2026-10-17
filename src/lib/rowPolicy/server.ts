import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/tunnel/server'
import { viewerFromSession } from '@/lib/bi/serverQuery'
import { cleanRowPolicy, cleanTableAccessMode, isTableClosed, resolveAccess, type AccessPayload, type TableAccessConfig } from './policy'
import { cleanAuditConfig, effectiveAudit } from './audit'
import { writeRestrictedTables } from '@/lib/viewAccess'

/**
 * Acesso a dados do usuário final, lado do servidor: lê a configuração de cada tabela do projeto (permissões e política
 * por linha, salvas em `models`) e resolve para a sessão assinada de quem está pedindo. Lido com a chave de serviço e
 * guardado por poucos segundos (uma tela dispara dezenas de comandos de uma vez).
 */
const cache = new Map<string, { configs: TableAccessConfig[]; until: number }>()
const TTL_MS = 15_000

export function clearTableAccessCache() { cache.clear() }

export async function loadTableAccess(
  projectId: string,
  deps: { client?: Pick<SupabaseClient, 'from'>; now?: () => number } = {},
): Promise<TableAccessConfig[]> {
  const now = (deps.now ?? Date.now)()
  const hit = cache.get(projectId)
  if (hit && hit.until > now) return hit.configs

  const client = deps.client ?? serviceClient()
  // As colunas row_policy e audit_config podem ainda não existir no banco (migração pendente): tenta com tudo e vai tirando o que falta
  const BASE = 'db_table_name, can_create, can_update, can_delete'
  const variants = [
    `${BASE}, row_policy, audit_config, fields(db_column_name)`,
    `${BASE}, row_policy, fields(db_column_name)`,
    `${BASE}, audit_config, fields(db_column_name)`,
    `${BASE}, fields(db_column_name)`,
  ]
  let data: any[] | null = null
  let error: { code?: string; message: string } | null = null
  for (const cols of variants) {
    ;({ data, error } = (await client.from('models').select(cols).eq('project_id', projectId)) as any)
    if (!error || error.code !== '42703') break
  }
  if (error) throw new Error(`Não foi possível ler as permissões das tabelas: ${error.message}`)

  // modo do projeto ("bloquear por padrão" + tabelas liberadas). Falha fechada: se não der para ler, a rota recusa (não assume "aberto")
  const { data: authRow, error: modeError } = await client.from('project_auth_config').select('ui_config').eq('project_id', projectId).maybeSingle()
  if (modeError) throw new Error(`Não foi possível ler o modo de acesso às tabelas: ${modeError.message}`)
  const mode = cleanTableAccessMode((authRow as any)?.ui_config?.table_access)

  const configs: TableAccessConfig[] = ((data as any[]) || [])
    .filter(m => m.db_table_name)
    .map(m => ({
      table: String(m.db_table_name),
      canCreate: m.can_create !== false,
      canUpdate: m.can_update !== false,
      canDelete: m.can_delete !== false,
      policy: cleanRowPolicy(m.row_policy),
      closed: isTableClosed(mode, String(m.db_table_name)),
      audit: effectiveAudit(cleanAuditConfig(m.audit_config), ((m.fields as any[]) || []).map(f => String(f.db_column_name || '')).filter(Boolean)),
    }))
  cache.set(projectId, { configs, until: now + TTL_MS })
  if (cache.size > 200) for (const [k, c] of cache) if (c.until < now) cache.delete(k)
  return configs
}

/**
 * O `access` a enviar no comando assinado do usuário final. Sem sessão (visitante de projeto aberto) o usuário é nulo:
 * tabelas com regra ficam negadas. Lança erro se não conseguir ler a configuração (quem chama deve recusar: falha fechada).
 */
export async function accessForSession(
  projectId: string,
  session: { sub: string; email?: string; name?: string; attrs?: Record<string, unknown>; row?: Record<string, unknown> } | null | undefined,
  deps: Parameters<typeof loadTableAccess>[1] = {},
): Promise<AccessPayload> {
  const configs = await loadTableAccess(projectId, deps)
  const restricted = new Set(await loadWriteRestrictions(projectId, session, deps))
  // grupos do usuário: só consultados quando alguma regra tem exceção "por grupo" (nos demais projetos nada muda)
  const usesGroups = configs.some(c => c.policy?.rules.some(r => r.bypass?.source === 'user.group'))
  const groups = usesGroups ? await groupNamesForSession(projectId, session, deps) : []
  // grupo só com leitura nas telas de uma tabela: o Agente recusa criar/editar/excluir nela (o navegador não consegue tirar)
  const effective = restricted.size === 0
    ? configs
    : configs.map(c => (restricted.has(c.table.split('.').pop()!.toLowerCase()) ? { ...c, canCreate: false, canUpdate: false, canDelete: false } : c))
  const viewer = viewerFromSession(session)
  return resolveAccess(effective, viewer && groups.length > 0 ? { ...viewer, groups } : viewer)
}

const groupCache = new Map<string, { names: string[]; until: number }>()
export function clearGroupNamesCache() { groupCache.clear() }

/**
 * Nomes dos grupos do usuário final, para a exceção "por grupo" das regras de acesso por linha. Mesmo critério do menu:
 * coluna do grupo na linha do usuário (banco legado) e/ou project_user_roles. Sem sessão, visitante ou erro ao ler: lista vazia
 * (falha fechada: sem grupo conhecido ninguém escapa da regra).
 */
export async function groupNamesForSession(
  projectId: string,
  session: { sub: string; row?: Record<string, unknown> } | null | undefined,
  deps: { client?: Pick<SupabaseClient, 'from'>; now?: () => number } = {},
): Promise<string[]> {
  if (!session || String(session.sub).startsWith('anon:')) return []
  const now = (deps.now ?? Date.now)()
  const key = `${projectId}:${session.sub}`
  const hit = groupCache.get(key)
  if (hit && hit.until > now) return hit.names
  let names: string[] = []
  try {
    const client = deps.client ?? serviceClient()
    const { data: authRow } = await client.from('project_auth_config').select('ui_config').eq('project_id', projectId).maybeSingle()
    const ui = ((authRow as any)?.ui_config || {}) as any
    const ids = new Set<string>()
    if (ui.sync_legacy_groups) {
      const v = session.row?.[ui.db_user_role_column || 'role_id']
      if (v !== undefined && v !== null && String(v) !== '') ids.add(String(v))
    }
    const { data: links } = await client.from('project_user_roles').select('role_id').eq('project_id', projectId).eq('external_user_id', String(session.sub))
    for (const l of ((links as any[]) || [])) if (l?.role_id) ids.add(String(l.role_id))
    if (ids.size > 0) {
      const { data: roles } = await client.from('project_roles').select('id, name').eq('project_id', projectId).in('id', [...ids])
      names = ((roles as any[]) || []).map(r => String(r?.name ?? '').trim()).filter(Boolean)
    }
  } catch (e: any) {
    console.error('[rowPolicy] não foi possível ler o grupo do usuário:', e?.message)
    return []
  }
  groupCache.set(key, { names, until: now + TTL_MS })
  if (groupCache.size > 2000) for (const [k, c] of groupCache) if (c.until < now) groupCache.delete(k)
  return names
}

/**
 * Tabelas em que o grupo do usuário só tem leitura nas telas (nível "leitura" ou "nenhum"). Mesmo papel que o menu usa:
 * coluna do grupo na linha do usuário (grupos do banco legado) ou project_user_roles. Sem sessão ou sem grupo: nada a restringir aqui
 * (quem não tem grupo já não entra nas telas).
 */
export async function loadWriteRestrictions(
  projectId: string,
  session: { sub: string; row?: Record<string, unknown> } | null | undefined,
  deps: { client?: Pick<SupabaseClient, 'from'>; now?: () => number } = {},
): Promise<string[]> {
  if (!session || String(session.sub).startsWith('anon:')) return []
  const now = (deps.now ?? Date.now)()
  // uma tela dispara dezenas de comandos de uma vez: o resultado de cada usuário fica guardado por poucos segundos
  const key = `${projectId}:${session.sub}`
  const hit = restrictionCache.get(key)
  if (hit && hit.until > now) return hit.tables
  let tables: string[] = []
  try {
    tables = await computeWriteRestrictions(projectId, session, deps.client ?? serviceClient())
  } catch (e: any) {
    // é um apertamento a mais sobre as permissões das tabelas (já lidas com falha fechada): se o grupo não puder ser lido, só registra
    console.error('[rowPolicy] não foi possível ler as permissões de tela do grupo:', e?.message)
    return []
  }
  restrictionCache.set(key, { tables, until: now + TTL_MS })
  if (restrictionCache.size > 2000) for (const [k, c] of restrictionCache) if (c.until < now) restrictionCache.delete(k)
  return tables
}

const restrictionCache = new Map<string, { tables: string[]; until: number }>()
export function clearWriteRestrictionCache() { restrictionCache.clear() }

async function computeWriteRestrictions(
  projectId: string,
  session: { sub: string; row?: Record<string, unknown> },
  client: Pick<SupabaseClient, 'from'>,
): Promise<string[]> {

  const { data: authRow } = await client.from('project_auth_config').select('ui_config').eq('project_id', projectId).maybeSingle()
  const ui = ((authRow as any)?.ui_config || {}) as any
  let roleId: string | undefined
  if (ui.sync_legacy_groups) {
    const v = session.row?.[ui.db_user_role_column || 'role_id']
    if (v !== undefined && v !== null && String(v) !== '') roleId = String(v)
  }
  if (!roleId) {
    const { data } = await client.from('project_user_roles').select('role_id').eq('project_id', projectId).eq('external_user_id', String(session.sub)).maybeSingle()
    roleId = (data as any)?.role_id
  }
  if (!roleId) return []

  const [{ data: perms }, { data: views }] = await Promise.all([
    client.from('project_role_permissions').select('view_id, can_read, can_write').eq('role_id', roleId),
    client.from('ui_views').select('id, slug, model:models(db_table_name)').eq('project_id', projectId),
  ])
  const list = ((perms as any[]) || [])
  // sem nenhuma restrição configurada para o grupo, nada muda (evita custo e risco nos projetos que não usam leitura/escrita)
  if (!list.some(p => p.can_read === false || p.can_write === false)) return []
  return writeRestrictedTables(
    ((views as any[]) || []).map(v => ({ id: v.id, slug: v.slug, table: (Array.isArray(v.model) ? v.model[0] : v.model)?.db_table_name })),
    list,
  )
}
