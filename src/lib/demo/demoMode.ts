/**
 * MODO DEMONSTRAÇÃO (Ajuda Interativa).
 *
 * O tutorial roda num iframe do próprio app aberto com `?mb_demo=1`. Nesse modo NADA é gravado de verdade:
 *  - o canal do túnel responde localmente a todo comando que não seja leitura (insert, update, delete, BPM, SQL customizado...),
 *    guardando as linhas num repositório SINTÉTICO só em memória;
 *  - as leituras (select e contagem) vão ao banco como sempre, e a resposta ganha por cima as linhas sintéticas
 *    (e perde as excluídas), para a lista refletir o que o tutorial fez;
 *  - chamadas de escrita por HTTP (rotas /api e REST do Supabase) são respondidas com um sucesso falso.
 *
 * Os pontos de entrada ficam em UM lugar por camada: o `send` do canal (relayClient), o `send` do canal com blocos (chunkedChannel)
 * e o `relaySend`. Qualquer comando que não esteja na lista de leitura é tratado como escrita.
 */

export interface DemoMessage { type?: string; event?: string; payload?: any }
type Row = Record<string, any>

/** Ações do túnel que só leem: passam para o banco de verdade. Qualquer outra é escrita e fica só na demonstração. */
export const DEMO_READ_ACTIONS: ReadonlySet<string> = new Set(['select', 'count_records', 'system_refresh'])

let demoCached: boolean | null = null

/** A linha sintética que o tutorial precisa que já exista viaja na URL (`mb_seed`), para estar pronta antes da primeira leitura. */
export interface DemoSeed { table: string; pk: string; row: Record<string, any> }

export function encodeDemoSeed(seed: DemoSeed): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(seed)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeDemoSeed(raw: string | null | undefined): DemoSeed | null {
  if (!raw) return null
  try {
    const json = decodeURIComponent(escape(atob(raw.replace(/-/g, '+').replace(/_/g, '/'))))
    const s = JSON.parse(json)
    const SAFE = /^[\w.-]{1,120}$/
    if (!s || typeof s.table !== 'string' || !SAFE.test(s.table) || typeof s.row !== 'object' || s.row === null) return null
    return { table: s.table, pk: typeof s.pk === 'string' && SAFE.test(s.pk) ? s.pk : 'id', row: s.row }
  } catch { return null }
}

/** O app foi aberto em modo demonstração? Decidido uma vez, no carregamento (a navegação interna não perde o modo). */
export function isDemoMode(): boolean {
  if (demoCached !== null) return demoCached
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    demoCached = params.get('mb_demo') === '1'
    if (demoCached) {
      const seed = decodeDemoSeed(params.get('mb_seed'))
      if (seed) demoStore.seed(seed.table, seed.row, seed.pk)
    }
  } catch {
    demoCached = false
  }
  return demoCached
}

/** Só para testes. */
export function __setDemoModeForTests(v: boolean | null) { demoCached = v }

const keyOf = (v: unknown) => String(v ?? '')
const ciGet = (row: Row, key: string) => {
  if (key in row) return row[key]
  const k = Object.keys(row).find(x => x.toLowerCase() === key.toLowerCase())
  return k ? row[k] : undefined
}

/** Filtro simples da busca (colunas com texto contido, sem diferenciar maiúsculas): o suficiente para o tutorial de pesquisa. */
function matchesFilters(row: Row, filters?: Record<string, any>): boolean {
  if (!filters) return true
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    const cell = ciGet(row, k.includes('.') ? k.split('.').pop()! : k)
    if (cell === undefined || !keyOf(cell).toLowerCase().includes(keyOf(v).toLowerCase())) return false
  }
  return true
}

export class DemoStore {
  private inserted = new Map<string, Row[]>()
  private seeds = new Map<string, Row[]>()
  private deleted = new Map<string, Set<string>>()
  private patches = new Map<string, Map<string, Row>>()
  private pkByTable = new Map<string, string>()
  private counter = 0

  reset() { this.inserted.clear(); this.seeds.clear(); this.deleted.clear(); this.patches.clear(); this.pkByTable.clear(); this.counter = 0 }

  private list(map: Map<string, Row[]>, table: string) {
    let l = map.get(table)
    if (!l) { l = []; map.set(table, l) }
    return l
  }

  /** Linha sintética que já "existe" quando o tutorial começa (editar, excluir, ver, pesquisar). */
  seed(table: string, row: Row, pk = 'id') {
    this.pkByTable.set(table, pk)
    const list = this.list(this.seeds, table)
    if (list.some(r => keyOf(r[pk]) === keyOf(row[pk]))) return
    list.push({ ...row, [pk]: row[pk] ?? `demo-seed-${++this.counter}` })
  }

  insert(table: string, data: Row, pk = 'id'): Row {
    this.pkByTable.set(table, pk)
    const row = { ...data, [pk]: data[pk] ?? `demo-${++this.counter}` }
    this.list(this.inserted, table).unshift(row)
    return row
  }

  update(table: string, id: unknown, patch: Row): Row | null {
    const pk = this.pkByTable.get(table) || 'id'
    for (const map of [this.inserted, this.seeds]) {
      const row = (map.get(table) || []).find(r => keyOf(r[pk]) === keyOf(id))
      if (row) { Object.assign(row, patch); return row }
    }
    let p = this.patches.get(table)
    if (!p) { p = new Map(); this.patches.set(table, p) }
    p.set(keyOf(id), { ...(p.get(keyOf(id)) || {}), ...patch })
    return { ...patch, [pk]: id }
  }

  remove(table: string, id: unknown) {
    const pk = this.pkByTable.get(table) || 'id'
    for (const map of [this.inserted, this.seeds]) {
      const list = map.get(table)
      if (list) map.set(table, list.filter(r => keyOf(r[pk]) !== keyOf(id)))
    }
    let d = this.deleted.get(table)
    if (!d) { d = new Set(); this.deleted.set(table, d) }
    d.add(keyOf(id))
  }

  /** Linhas sintéticas (as novas primeiro) que combinam com o filtro. */
  synthetic(table: string, filters?: Record<string, any>): Row[] {
    return [...(this.inserted.get(table) || []), ...(this.seeds.get(table) || [])].filter(r => matchesFilters(r, filters))
  }

  /** Resposta de um select: sintéticas por cima, sem as excluídas, com as edições aplicadas nas linhas reais. */
  mergeRows(table: string, real: Row[], filters?: Record<string, any>): Row[] {
    const pk = this.pkByTable.get(table) || 'id'
    const gone = this.deleted.get(table)
    const patches = this.patches.get(table)
    const kept = real
      .filter(r => !gone || !gone.has(keyOf(ciGet(r, pk))))
      .map(r => { const p = patches?.get(keyOf(ciGet(r, pk))); return p ? { ...r, ...p } : r })
    return [...this.synthetic(table, filters), ...kept]
  }
}

export const demoStore = new DemoStore()

// consultas de leitura em andamento: queryId → o que foi pedido, para ajustar a resposta
const pendingReads = new Map<string, { table: string; action: string; filters?: Record<string, any> }>()

const tableOf = (p: any): string => String(p?.table || p?.tableName || '')
const pkOf = (p: any): string => String(p?.idColumn || 'id')

/** Entrega uma resposta pelos mesmos eventos que o Agente CLI usaria, chamando quem escuta (como o Realtime faz). */
export function deliverDemoReply(channel: any, queryId: string | undefined, payload: Record<string, any>, delayMs = 120) {
  if (!queryId) return
  const reply = { queryId, ...payload, __mbDemo: true }
  const fire = () => {
    const bindings: Array<{ filter?: { event?: string }; callback?: (m: any) => void }> = channel?.bindings?.broadcast || []
    for (const event of ['sql_result', `query_result_${queryId}`]) {
      for (const b of [...bindings]) {
        if (b.filter?.event !== event && b.filter?.event !== '*') continue
        try { b.callback?.({ type: 'broadcast', event, payload: { ...reply } }) } catch { /* um ouvinte com defeito não derruba os outros */ }
      }
    }
  }
  if (delayMs <= 0) fire()
  else setTimeout(fire, delayMs)
}

/** Resposta falsa de uma escrita. Nada vai ao banco. */
export function buildDemoWriteReply(payload: any): Record<string, any> {
  const action = String(payload?.action || '')
  const table = tableOf(payload)
  const pk = pkOf(payload)
  const base = { success: true, action, demo: true }

  if (action === 'insert') {
    const row = demoStore.insert(table, { ...(payload.data || payload.record || {}) }, pk)
    return { ...base, data: [row], rowCount: 1 }
  }
  if (action === 'update') {
    const id = payload.idValue ?? payload.id ?? payload.filters?.[pk]
    const patch = { ...(payload.data || payload.record || {}) }
    const row = demoStore.update(table, id, patch)
    return { ...base, data: row ? [row] : [], rowCount: 1 }
  }
  if (action === 'delete') {
    const id = payload.idValue ?? payload.id ?? payload.filters?.[pk]
    demoStore.remove(table, id)
    return { ...base, data: [], rowCount: 1 }
  }
  // BPM síncrono: devolve a própria linha, sem alterar; qualquer outra coisa (SQL customizado, webhook, BPM): sucesso vazio
  if (action === 'trigger_bpm_sync') return { ...base, data: [payload.rowData ?? {}] }
  return { ...base, data: [] }
}

/** Isto é um comando de dados que NÃO é leitura? */
export function isWriteMessage(msg: DemoMessage | null | undefined): boolean {
  return !!msg && msg.type === 'broadcast' && msg.event === 'sql_query' && !!msg.payload && typeof msg.payload === 'object' && !DEMO_READ_ACTIONS.has(String(msg.payload.action || ''))
}

/** Núcleo (sem checar o modo, para testar): trata o comando. `true` = foi respondido aqui e NÃO deve seguir adiante. */
export function handleDemoMessage(channel: any, msg: DemoMessage | null | undefined): boolean {
  if (!msg || msg.type !== 'broadcast' || msg.event !== 'sql_query' || !msg.payload || typeof msg.payload !== 'object') return false
  const p = msg.payload
  const action = String(p.action || '')
  if (DEMO_READ_ACTIONS.has(action)) {
    if (p.queryId && (action === 'select' || action === 'count_records')) {
      pendingReads.set(p.queryId, { table: tableOf(p), action, filters: p.filters })
      setTimeout(() => pendingReads.delete(p.queryId), 60_000)
    }
    return false
  }
  deliverDemoReply(channel, p.queryId, buildDemoWriteReply(p))
  return true
}

/** Ponto de entrada dos canais: só age no modo demonstração. */
export function demoHandleSend(channel: any, msg: DemoMessage | null | undefined): boolean {
  return isDemoMode() && handleDemoMessage(channel, msg)
}

/** Ajusta a resposta de uma leitura (uma vez por mensagem). Altera `payload` no lugar. */
export function transformDemoReply(message: any): any {
  const p = message?.payload
  if (!p || p.__mbDemo || p.success === false) return message
  const meta = pendingReads.get(p.queryId)
  if (!meta) return message
  p.__mbDemo = true
  if (meta.action === 'count_records') {
    p.total = Number(p.total || 0) + demoStore.synthetic(meta.table, meta.filters).length
  } else if (Array.isArray(p.data)) {
    p.data = demoStore.mergeRows(meta.table, p.data, meta.filters)
  }
  return message
}

/** Envolve um ouvinte de resposta para que ele veja a resposta já ajustada. */
export function demoWrapReplyCallback<T extends (m: any) => any>(cb: T): T {
  if (!isDemoMode() || typeof cb !== 'function') return cb
  return (((m: any) => cb(transformDemoReply(m))) as unknown) as T
}

/** Só os eventos de resposta de leitura precisam do ajuste. */
export const isReplyEvent = (event: string | undefined) => event === 'sql_result' || (typeof event === 'string' && event.startsWith('query_result_'))

let guardsInstalled = false

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
// rotas /api que, mesmo por POST, só leem ou são necessárias para o app funcionar
const API_ALLOW = [/^\/api\/tunnel\/send$/, /^\/api\/bi\/query/, /^\/api\/auth\//]

function fakeOk(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

/** Decide se uma chamada HTTP é uma escrita a bloquear (função pura, para testar). */
export function shouldBlockHttp(method: string, rawUrl: string, origin = 'http://localhost'): boolean {
  if (!WRITE_METHODS.has(method.toUpperCase())) return false
  let u: URL
  try { u = new URL(rawUrl, origin) } catch { return false }
  if (u.pathname.startsWith('/rest/v1/')) return !u.pathname.startsWith('/rest/v1/rpc/')
  if (u.pathname.startsWith('/storage/v1/')) return true
  if (u.origin === origin && u.pathname.startsWith('/api/')) return !API_ALLOW.some(re => re.test(u.pathname))
  return false
}

/** Instala as proteções de HTTP do modo demonstração (idempotente). */
export function installDemoGuards() {
  if (guardsInstalled || !isDemoMode() || typeof window === 'undefined') return
  guardsInstalled = true
  const original = window.fetch.bind(window)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase()
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    if (shouldBlockHttp(method, url, window.location.origin)) {
      return Promise.resolve(fakeOk(url.includes('/rest/v1/') ? [] : { success: true, demo: true }))
    }
    return original(input as any, init)
  }) as typeof window.fetch
}
