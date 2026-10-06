/**
 * Relay do túnel visto pelo NAVEGADOR.
 *
 * Com o relay ligado, a página já não recebe o secret_token do projeto: os componentes continuam montando o comando
 * como sempre, com `token: ''`. Aqui, qualquer `sql_query` sem token é enviado ao servidor (POST /api/tunnel/send),
 * que confere quem está pedindo, coloca o token e entrega ao Agente CLI. Com o relay desligado o token está presente e
 * o envio direto pelo canal segue exatamente como antes.
 *
 * As respostas continuam chegando pelo canal em tempo real; o que muda é só o caminho de ida.
 */

export interface BroadcastMessage { type?: string; event?: string; payload?: any }

/** Este envio deve passar pelo servidor? (só no navegador, só comando de dados e só sem token) */
export function needsRelay(msg: BroadcastMessage | null | undefined): boolean {
  if (typeof window === 'undefined') return false
  return !!msg && msg.type === 'broadcast' && msg.event === 'sql_query' && !!msg.payload && typeof msg.payload === 'object' && !msg.payload.token
}

/** `realtime:tunnel:<id>` ou `tunnel:<id>` → id do projeto. */
export function projectIdFromTopic(topic: string | undefined | null): string | null {
  const m = /(?:^|:)tunnel:([^:]+)$/.exec(topic || '')
  return m ? m[1] : null
}

const MESSAGES: Record<number, string> = {
  401: 'Sessão expirada ou sem permissão. Entre novamente.',
  403: 'Esta ação não é permitida para o seu usuário.',
  429: 'Muitas consultas em pouco tempo. Aguarde um instante.',
  503: 'O acesso ao banco está indisponível no momento.',
}

export interface RelayResult { ok: boolean; status: number; error?: string }

/** Envia o comando ao servidor. Nunca lança: devolve o resultado. */
export async function relaySend(
  projectId: string,
  msg: BroadcastMessage,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): Promise<RelayResult> {
  try {
    const res = await fetchImpl('/api/tunnel/send', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, event: msg.event, payload: msg.payload }),
    })
    if (res.ok) return { ok: true, status: res.status }
    let detail = ''
    try { detail = (await res.json())?.error || '' } catch { /* corpo vazio */ }
    return { ok: false, status: res.status, error: MESSAGES[res.status] || detail || `Falha ao enviar o comando (HTTP ${res.status}).` }
  } catch {
    return { ok: false, status: 0, error: 'Sem conexão com o servidor.' }
  }
}

/**
 * Quando o envio falha, quem espera a resposta não pode ficar pendurado até o tempo limite: entrega um resultado de
 * erro com o mesmo queryId, pelos mesmos eventos que o Agente CLI usaria.
 */
export function deliverLocalError(channel: any, queryId: string | undefined, error: string) {
  if (!queryId) return
  const payload = { queryId, success: false, error }
  const bindings: Array<{ filter?: { event?: string }; callback?: (m: any) => void }> = channel?.bindings?.broadcast || []
  for (const event of ['sql_result', `query_result_${queryId}`]) {
    // o mesmo despacho que o Realtime faz ao receber uma mensagem: chama quem escuta aquele evento
    for (const b of [...bindings]) {
      if (b.filter?.event !== event && b.filter?.event !== '*') continue
      try { b.callback?.({ type: 'broadcast', event, payload }) } catch { /* um ouvinte com defeito não derruba os outros */ }
    }
  }
}

/** Envio completo de um comando por um canal: pelo servidor, avisando quem espera se falhar. Devolve 'ok' | 'error'. */
export async function relayThroughChannel(channel: any, msg: BroadcastMessage, fetchImpl?: typeof fetch): Promise<'ok' | 'error'> {
  const projectId = projectIdFromTopic(channel?.topic)
  if (!projectId) return 'error'
  const result = await relaySend(projectId, msg, fetchImpl)
  if (result.ok) return 'ok'
  deliverLocalError(channel, msg.payload?.queryId, result.error || 'Falha ao enviar o comando.')
  return 'error'
}

/**
 * Faz o `send` de um canal `tunnel:*` passar pelo relay quando o comando vem sem token.
 * Idempotente; qualquer outro envio segue pelo caminho original.
 */
export function patchChannelForRelay<T extends { send?: any; topic?: string }>(channel: T): T {
  const ch = channel as any
  if (!ch || ch.__mbRelayPatched || typeof ch.send !== 'function') return channel
  if (!projectIdFromTopic(ch.topic)) return channel
  const original = ch.send.bind(ch)
  ch.send = (msg: BroadcastMessage, opts?: any) => (needsRelay(msg) ? relayThroughChannel(ch, msg) : original(msg, opts))
  ch.__mbRelayPatched = true
  return channel
}
