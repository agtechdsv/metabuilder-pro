import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceClient } from './server'

/**
 * Que tabelas e que tipo de SQL um USUÁRIO FINAL pode pedir pelo relay.
 *
 * Hoje o navegador manda ao Agente CLI a tabela, os filtros e até o texto do SELECT (`query`). Sem esta conferência, um
 * usuário final com a sessão válida poderia pedir qualquer tabela do banco (inclusive a de usuários, com as senhas) ou
 * um SQL próprio. As regras daqui são puras (testáveis); `TUNNEL_GUARD` escolhe o que acontece com uma violação:
 *   - `observe` (padrão): só registra no log do servidor, para ver o que as telas reais pedem antes de bloquear;
 *   - `enforce`: recusa o comando (403);
 *   - `off`: não confere.
 * Membros do projeto (desenvolvedores) não passam por aqui.
 */

export type GuardMode = 'off' | 'observe' | 'enforce'

export function guardMode(env: Record<string, string | undefined> = process.env): GuardMode {
  const v = String(env.TUNNEL_GUARD || '').trim().toLowerCase()
  return v === 'off' || v === 'enforce' ? v : 'observe'
}

export interface Violation { rule: 'table_not_in_project' | 'auth_table' | 'sql_not_select' | 'sql_forbidden' | 'action_not_allowed'; detail: string }

/** Remove comentários e textos entre aspas simples (conteúdo de dados), mantendo os identificadores entre aspas duplas. */
function stripNoise(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

const IDENT = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`
const TABLE_REF = new RegExp(String.raw`\b(?:from|join)\s+(${IDENT}(?:\s*\.\s*${IDENT})?)`, 'gi')
// "FROM a, b": tabelas depois de vírgula, até a próxima palavra de cláusula
const FROM_LIST = /\bfrom\s+([^()]*?)(?=\bwhere\b|\bgroup\b|\border\b|\blimit\b|\bjoin\b|\bunion\b|\bhaving\b|\boffset\b|\)|$)/gi

const unquote = (s: string) => s.trim().replace(/^"|"$/g, '')

/** Nome da tabela sem o schema, em minúsculas. */
function tableName(ref: string): string {
  const parts = ref.split('.').map(unquote)
  return parts[parts.length - 1].toLowerCase()
}

/** Todas as tabelas que o comando toca: campo `table`, junções, filtros "tabela.coluna" e o texto do SELECT. */
export function referencedTables(payload: Record<string, any>): string[] {
  const found = new Set<string>()
  const add = (v: unknown) => {
    if (typeof v !== 'string') return
    const name = tableName(v.replace(/[^\w$."]/g, ''))
    if (name) found.add(name)
  }
  add(payload.table)
  for (const j of Array.isArray(payload.joins) ? payload.joins : []) {
    if (j && typeof j === 'object') for (const k of ['table', 'toTable', 'to', 'from', 'fromTable']) add((j as any)[k])
  }
  const keyed = (k: string) => { if (k.includes('.')) add(k.split('.')[0]) }
  if (payload.filters && typeof payload.filters === 'object') Object.keys(payload.filters).forEach(keyed)
  for (const f of Array.isArray(payload.advancedFilters) ? payload.advancedFilters : []) if (typeof f?.field === 'string') keyed(f.field)

  for (const text of [payload.query, payload.sql]) {
    if (typeof text !== 'string' || !text.trim()) continue
    const sql = stripNoise(text)
    for (const m of sql.matchAll(TABLE_REF)) add(m[1])
    for (const m of sql.matchAll(FROM_LIST)) {
      const items = m[1].split(',').slice(1) // o primeiro já foi pego acima
      for (const item of items) {
        const first = item.trim().split(/\s+/)[0]
        if (first && new RegExp(`^${IDENT}(?:\\s*\\.\\s*${IDENT})?$`).test(first)) add(first)
      }
    }
  }
  // "diagnostico" é a tabela de mentira do teste de conexão (SELECT 1): não é dado de ninguém
  return [...found].filter(t => t !== 'diagnostico' && t !== 'dual')
}

const FORBIDDEN_WORDS = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|execute|vacuum|merge|lock)\b/i
// inclui as funções que executam SQL escrito dentro de um texto (query_to_xml('select ...'), DBMS_XMLGEN.getXML(...)) e as de Oracle
const FORBIDDEN_THINGS = /\b(pg_[a-z_]+|information_schema|current_setting|set_config|dblink\w*|lo_\w+|query_to_xml\w*|table_to_xml\w*|cursor_to_xml\w*|schema_to_xml\w*|database_to_xml\w*|ts_stat|dbms_(?!lob\b)\w+|utl_\w+|owa_\w+|sdo_\w+|ctxsys)\b/i

/** O texto de SELECT enviado pelo navegador é só uma consulta de leitura, de um único comando? */
export function sqlProblems(text: unknown): Violation[] {
  if (typeof text !== 'string' || !text.trim()) return []
  // identificadores entre aspas duplas ("update" como nome de coluna) não contam como comando
  const sql = stripNoise(text).replace(/"[^"]*"/g, '"x"')
  const out: Violation[] = []
  if (!/^\s*[(]*\s*(select|with)\b/i.test(sql)) out.push({ rule: 'sql_not_select', detail: 'o texto não começa com SELECT/WITH' })
  if (/;\s*\S/.test(sql)) out.push({ rule: 'sql_forbidden', detail: 'mais de um comando' })
  const word = sql.match(FORBIDDEN_WORDS)
  if (word) out.push({ rule: 'sql_forbidden', detail: `palavra reservada: ${word[1].toLowerCase()}` })
  const thing = sql.match(FORBIDDEN_THINGS)
  if (thing) out.push({ rule: 'sql_forbidden', detail: `acesso a catálogo/função de sistema: ${thing[1].toLowerCase()}` })
  return out
}

export interface AccessContext {
  /** tabelas cadastradas no projeto (models), em minúsculas */
  allowedTables: Set<string>
  /** tabela de usuários do login (guarda as senhas): ela pode aparecer numa junção, mas as telas não leem suas colunas sensíveis */
  authTable?: string
}

/** Ações que as telas do app publicado usam. Qualquer outra (ferramentas de desenvolvedor, SQL livre) não é de usuário final. */
const END_USER_ACTIONS = new Set(['select', 'count_records', 'insert', 'update', 'delete', 'execute_custom', 'trigger_bpm', 'trigger_bpm_sync'])
/** O CLI lê o texto `query` como SELECT nestas ações. Em insert/update/delete ele ignora o texto e monta o SQL com tabela, coluna e valor. */
const READ_ACTIONS = new Set(['select', 'count_records'])

const SENSITIVE_COLUMN = /(senha|password|passwd|pwd|hash|secret|totp|mfa|token)/i

/**
 * `execute_custom` roda o texto que vier. Aceita só comandos de DADOS (SELECT/INSERT/UPDATE/DELETE/WITH), um ou vários
 * separados por ";" (a exclusão em cascata monta assim), sem DDL nem catálogo/função de sistema.
 */
export function customSqlProblems(text: unknown): Violation[] {
  if (typeof text !== 'string' || !text.trim()) return []
  const sql = stripNoise(text).replace(/"[^"]*"/g, '"x"')
  const out: Violation[] = []
  for (const stmt of sql.split(';').map(x => x.trim()).filter(Boolean)) {
    if (!/^[(]*\s*(select|insert|update|delete|with)\b/i.test(stmt)) out.push({ rule: 'sql_not_select', detail: 'comando que não é de dados' })
  }
  const ddl = sql.match(/\b(drop|alter|create|truncate|grant|revoke|copy|call|execute|vacuum|merge|lock|do)\b/i)
  if (ddl) out.push({ rule: 'sql_forbidden', detail: `palavra reservada: ${ddl[1].toLowerCase()}` })
  const thing = sql.match(FORBIDDEN_THINGS)
  if (thing) out.push({ rule: 'sql_forbidden', detail: `acesso a catálogo/função de sistema: ${thing[1].toLowerCase()}` })
  return out
}

/** Confere um comando de usuário final. Lista vazia = permitido. */
export function evaluateEndUserAccess(payload: Record<string, any>, ctx: AccessContext): Violation[] {
  const out: Violation[] = []
  const action = String(payload.action || '')
  const auth = ctx.authTable ? ctx.authTable.toLowerCase() : undefined

  if (!END_USER_ACTIONS.has(action)) out.push({ rule: 'action_not_allowed', detail: action || '(sem ação)' })

  const tables = referencedTables(payload)
  for (const t of tables) {
    if (t === auth) continue // a tabela de login é do projeto; o acesso a ela é conferido abaixo
    if (!ctx.allowedTables.has(t)) out.push({ rule: 'table_not_in_project', detail: t })
  }

  // Tabela de usuários: pode entrar numa junção, mas ninguém lê as senhas por ela
  if (auth && tables.includes(auth)) {
    const text = [payload.query, payload.sql].filter(x => typeof x === 'string').join(' ')
    const readsItDirectly = READ_ACTIONS.has(action) && String(payload.table || '').toLowerCase() === auth
    const star = new RegExp(String.raw`"?${auth.replace(/\W/g, '')}"?\s*\.\s*\*`, 'i').test(text)
    if (readsItDirectly || star || SENSITIVE_COLUMN.test(stripNoise(text))) out.push({ rule: 'auth_table', detail: auth })
  }

  if (READ_ACTIONS.has(action)) out.push(...sqlProblems(payload.query), ...sqlProblems(payload.sql))
  else if (action === 'execute_custom') out.push(...customSqlProblems(payload.query ?? payload.sql))
  return out
}

// ── Contexto do projeto (lido no servidor, com a chave de serviço) ───────────────

const ctxCache = new Map<string, { ctx: AccessContext; until: number }>()
const CTX_TTL_MS = 60_000

export async function loadAccessContext(
  projectId: string,
  deps: { client?: Pick<SupabaseClient, 'from'>; now?: () => number } = {},
): Promise<AccessContext> {
  const now = (deps.now ?? Date.now)()
  const hit = ctxCache.get(projectId)
  if (hit && hit.until > now) return hit.ctx
  const client = deps.client ?? serviceClient()
  const [{ data: models }, { data: auth }] = await Promise.all([
    client.from('models').select('db_table_name').eq('project_id', projectId),
    client.from('project_auth_config').select('db_table_name').eq('project_id', projectId).maybeSingle(),
  ])
  const ctx: AccessContext = {
    allowedTables: new Set(((models as any[]) || []).map(m => String(m.db_table_name || '').toLowerCase()).filter(Boolean)),
    authTable: ((auth as any)?.db_table_name || undefined) as string | undefined,
  }
  ctxCache.set(projectId, { ctx, until: now + CTX_TTL_MS })
  return ctx
}

export function clearAccessContextCache() { ctxCache.clear() }
