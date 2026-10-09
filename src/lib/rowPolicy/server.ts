import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from '@/lib/tunnel/server'
import { viewerFromSession } from '@/lib/bi/serverQuery'
import { cleanRowPolicy, cleanTableAccessMode, isTableClosed, resolveAccess, type AccessPayload, type TableAccessConfig } from './policy'
import { cleanAuditConfig, effectiveAudit } from './audit'

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
  return resolveAccess(configs, viewerFromSession(session))
}
