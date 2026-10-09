import type { EndUserSession } from './sessionToken'
import type { LoginSetup } from './loginSetup'

/**
 * A sessão do usuário final é um cookie assinado que vale por até 7 dias. Sozinha ela nunca "morre": apagar ou desativar o
 * usuário no banco do cliente não derrubava o acesso dele. Aqui o servidor reconfere, de tempos em tempos, a linha do
 * usuário NO BANCO DO CLIENTE (a fonte da verdade, pelo túnel): se ela sumiu, ou está marcada como inativa, a sessão
 * deixa de valer. Não precisa de tabela nova nem de mudança no Agente.
 *
 * Quando não dá para conferir (Agente desligado, tempo esgotado), a sessão segue valendo: sem o Agente nenhum dado sai
 * mesmo, e não vale travar todo mundo por uma falha de rede. A dúvida não fica guardada por muito tempo.
 */
export type Liveness = 'alive' | 'revoked' | 'unknown'

const ACTIVE_COLUMNS = ['ativo', 'active', 'is_active', 'ativa', 'habilitado', 'enabled']
const OFF_VALUES = new Set(['false', '0', 'f', 'n', 'no', 'nao', 'não', 'inativo', 'off'])

/** A linha do usuário está ativa? Só é "inativa" se existir uma coluna ativo/active/... marcada como desligada. */
export function isRowActive(row: Record<string, any> | null | undefined): boolean {
  if (!row) return false
  for (const key of Object.keys(row)) {
    if (!ACTIVE_COLUMNS.includes(key.toLowerCase())) continue
    const v = row[key]
    if (v === false || v === 0) return false
    if (typeof v === 'string' && OFF_VALUES.has(v.trim().toLowerCase())) return false
  }
  return true
}

export interface LivenessDeps {
  loadSetup(projectId: string): Promise<LoginSetup | null>
  secretToken(projectId: string): Promise<string | null>
  /** envia o comando ao Agente (assinado) e devolve a resposta; deve lançar se estourar o tempo */
  call(projectId: string, payload: Record<string, any>): Promise<any>
  now?: () => number
  newId?: () => string
}

export const ALIVE_TTL_MS = 2 * 60_000
export const REVOKED_TTL_MS = 60_000
export const UNKNOWN_TTL_MS = 30_000

export function createLivenessChecker(deps: LivenessDeps) {
  const cache = new Map<string, { state: Liveness; until: number }>()
  const inflight = new Map<string, Promise<Liveness>>()
  const now = () => (deps.now ?? Date.now)()

  async function compute(projectId: string, session: EndUserSession): Promise<Liveness> {
    try {
      const setup = await deps.loadSetup(projectId)
      // só login pelo banco de dados do cliente tem uma linha de usuário para conferir (LDAP, gerenciado, etc. ficam de fora)
      if (!setup || setup.auth.auth_type !== 'database' || !setup.auth.db_table_name) return 'alive'
      const token = await deps.secretToken(projectId)
      if (!token) return 'unknown'

      const idKey = Object.keys(session.row || {}).find(k => k.toLowerCase() === 'id')
      const filters: Record<string, string> = idKey || !setup.auth.db_email_column
        ? { [idKey || 'id']: session.sub }
        : { [setup.auth.db_email_column]: session.sub }

      const res = await deps.call(projectId, {
        queryId: (deps.newId ?? (() => crypto.randomUUID()))(),
        token,
        projectId,
        action: 'select',
        table: setup.auth.db_table_name,
        schemaName: setup.schemaName,
        filters,
        limit: 1,
      })
      if (!res?.success || !Array.isArray(res.data)) return 'unknown'
      return res.data.length > 0 && isRowActive(res.data[0]) ? 'alive' : 'revoked'
    } catch {
      return 'unknown'
    }
  }

  return {
    async check(projectId: string, session: EndUserSession): Promise<Liveness> {
      const key = `${projectId}:${session.sub}`
      const hit = cache.get(key)
      if (hit && hit.until > now()) return hit.state
      const running = inflight.get(key)
      if (running) return running
      const p = compute(projectId, session).then(state => {
        const ttl = state === 'alive' ? ALIVE_TTL_MS : state === 'revoked' ? REVOKED_TTL_MS : UNKNOWN_TTL_MS
        cache.set(key, { state, until: now() + ttl })
        if (cache.size > 5000) for (const [k, v] of cache) if (v.until < now()) cache.delete(k)
        return state
      }).finally(() => { inflight.delete(key) })
      inflight.set(key, p)
      return p
    },
    clear() { cache.clear(); inflight.clear() },
  }
}
