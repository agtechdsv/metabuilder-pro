import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CHUNK_SIZE } from '@/lib/chunkedChannel'
import { newReplyTopic, signCommand, signingEnabled } from './commandSigning'

/**
 * Túnel visto pelo SERVIDOR.
 *
 * Até aqui só o navegador falava com o Agente CLI (broadcast no canal `tunnel:<projeto>` com o `secret_token` do projeto
 * dentro de cada comando). Com o relay, o navegador pede ao servidor, o servidor confere quem está pedindo, coloca o
 * token e envia. O token nunca chega ao navegador.
 *
 * Este arquivo é só o "cano": enviar um comando e (para o login) esperar a resposta. Quem pode enviar o quê é decidido
 * nas rotas que o usam.
 */

/** O relay está ligado? (chave de segurança: sem TUNNEL_RELAY=on tudo funciona como antes, com o token no navegador) */
export function relayEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TUNNEL_RELAY === 'on'
}

export interface TunnelTransport {
  /** envia um broadcast para o tópico */
  broadcast(topic: string, event: string, payload: any): Promise<void>
  /** passa a ouvir o tópico; resolve quando a inscrição está pronta. Devolve a função que encerra. */
  subscribe(topic: string, onEvent: (event: string, payload: any) => void): Promise<() => void>
}

export const tunnelTopic = (projectId: string) => `tunnel:${projectId}`

/** Divide um comando grande em pedaços no mesmo formato que o navegador e o CLI já usam (`chunked_message`). */
export function chunkMessages(event: string, payload: any, size = CHUNK_SIZE, newId: () => string = () => crypto.randomUUID()): Array<{ event: string; payload: any }> {
  const text = JSON.stringify(payload)
  if (text.length <= size) return [{ event, payload }]
  const total = Math.ceil(text.length / size)
  const chunkId = newId()
  return Array.from({ length: total }, (_, index) => ({
    event: 'chunked_message',
    payload: { chunkId, index, total, event, data: text.slice(index * size, (index + 1) * size) },
  }))
}

/** Junta os pedaços `chunked_message` de volta numa mensagem inteira. */
export class ChunkAssembler {
  private buffers = new Map<string, string[]>()

  /** Devolve a mensagem completa quando o último pedaço chega; antes disso, null. */
  push(chunk: { chunkId: string; index: number; total: number; event: string; data: string }): { event: string; payload: any } | null {
    if (!chunk || typeof chunk.chunkId !== 'string' || !Number.isInteger(chunk.total) || chunk.total < 1 || chunk.total > 5000) return null
    const parts = this.buffers.get(chunk.chunkId) ?? new Array<string>(chunk.total)
    parts[chunk.index] = chunk.data
    this.buffers.set(chunk.chunkId, parts)
    for (let i = 0; i < chunk.total; i++) if (parts[i] === undefined) return null
    this.buffers.delete(chunk.chunkId)
    try {
      return { event: chunk.event, payload: JSON.parse(parts.join('')) }
    } catch {
      return null
    }
  }
}

/** Envia um comando ao Agente CLI. Comandos grandes vão em pedaços. */
export async function tunnelSend(projectId: string, event: string, payload: any, transport: TunnelTransport = realtimeTransport()): Promise<void> {
  const messages = chunkMessages(event, payload)
  for (let i = 0; i < messages.length; i++) {
    await transport.broadcast(tunnelTopic(projectId), messages[i].event, messages[i].payload)
    if (messages.length > 1 && i < messages.length - 1) await new Promise(r => setTimeout(r, 100))
  }
}

export class TunnelTimeoutError extends Error {
  constructor(public readonly ms: number) {
    super(`O túnel não respondeu em ${Math.round(ms / 1000)}s (o Agente CLI está ligado?).`)
    this.name = 'TunnelTimeoutError'
  }
}

/**
 * Envia um comando e espera a resposta com o mesmo `queryId` (usada no login do usuário final, onde o servidor
 * precisa ver o resultado com os próprios olhos em vez de confiar no que o navegador diz).
 *
 * Com `secret` (o token do projeto) o comando vai ASSINADO, sem o token, e a resposta volta por um tópico privado
 * imprevisível: ninguém no canal público vê o token nem o resultado. Sem `secret`, o comportamento antigo.
 */
export async function tunnelCall(
  projectId: string,
  event: string,
  payload: { queryId: string; [k: string]: any },
  opts: { timeoutMs?: number; transport?: TunnelTransport; secret?: string } = {},
): Promise<any> {
  const transport = opts.transport ?? realtimeTransport()
  const timeoutMs = opts.timeoutMs ?? 15000
  const topic = opts.secret ? newReplyTopic(projectId, 's') : tunnelTopic(projectId)
  const command = opts.secret ? signCommand(opts.secret, event, projectId, payload, { replyTo: topic }) : payload
  const assembler = new ChunkAssembler()
  let unsubscribe: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const result = new Promise<any>((resolve, reject) => {
      timer = setTimeout(() => reject(new TunnelTimeoutError(timeoutMs)), timeoutMs)
      const handle = (ev: string, data: any) => {
        if (ev === 'chunked_message') {
          const done = assembler.push(data)
          if (done) handle(done.event, done.payload)
          return
        }
        if ((ev === 'sql_result' || ev === `query_result_${payload.queryId}`) && data && data.queryId === payload.queryId) resolve(data)
      }
      // a inscrição precisa estar pronta ANTES de enviar, senão a resposta rápida se perde
      transport.subscribe(topic, handle).then(
        async off => {
          unsubscribe = off
          try { await tunnelSend(projectId, event, command, transport) } catch (e) { reject(e) }
        },
        reject,
      )
    })
    return await result
  } finally {
    if (timer) clearTimeout(timer)
    try { unsubscribe?.() } catch { /* já encerrado */ }
  }
}

// ── Token do projeto (só no servidor) ───────────────────────────────────────────

const tokenCache = new Map<string, { token: string; until: number }>()
const TOKEN_TTL_MS = 60_000

/** secret_token do projeto, lido com a chave de serviço. Guardado por 1 minuto para não consultar a cada comando. */
export async function getProjectSecretToken(
  projectId: string,
  deps: { client?: Pick<SupabaseClient, 'from'>; now?: () => number } = {},
): Promise<string | null> {
  const now = (deps.now ?? Date.now)()
  const hit = tokenCache.get(projectId)
  if (hit && hit.until > now) return hit.token
  const client = deps.client ?? serviceClient()
  const { data, error } = await client.from('projects').select('secret_token').eq('id', projectId).maybeSingle()
  if (error || !data?.secret_token) return null
  tokenCache.set(projectId, { token: data.secret_token as string, until: now + TOKEN_TTL_MS })
  return data.secret_token as string
}

export function clearTokenCache() { tokenCache.clear() }

// ── Transporte real (Supabase Realtime) ─────────────────────────────────────────

let _service: SupabaseClient | null = null

/** Cliente com a chave de serviço (ignora RLS): usar SOMENTE em código de servidor. */
export function serviceClient(): SupabaseClient {
  if (!_service) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessários para o relay do túnel.')
    _service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return _service
}

let _transport: TunnelTransport | null = null

export function realtimeTransport(): TunnelTransport {
  if (_transport) return _transport
  _transport = {
    // O envio usa a API HTTP do Realtime: não precisa manter um WebSocket aberto no servidor.
    async broadcast(topic, event, payload) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!url || !key) throw new Error('Supabase não configurado no servidor.')
      const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
      })
      if (!res.ok) throw new Error(`Falha ao enviar ao túnel (HTTP ${res.status}).`)
    },
    async subscribe(topic, onEvent) {
      const client = serviceClient()
      // uma nova tentativa cobre o caso de o socket ainda estar fechando a inscrição anterior
      let lastError = 'sem resposta'
      for (let attempt = 0; attempt < 2; attempt++) {
        const channel = client.channel(topic)
        channel.on('broadcast', { event: '*' }, (msg: any) => onEvent(msg.event, msg.payload))
        try {
          await new Promise<void>((resolve, reject) => {
            const t = setTimeout(() => reject(new Error('timeout')), 8000)
            channel.subscribe((status: string, err?: Error) => {
              if (status === 'SUBSCRIBED') { clearTimeout(t); resolve() }
              else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                clearTimeout(t); reject(new Error(`${status}${err?.message ? ': ' + err.message : ''}`))
              }
            })
          })
          return () => { void client.removeChannel(channel) }
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e)
          try { await client.removeChannel(channel) } catch { /* já encerrado */ }
          await new Promise(r => setTimeout(r, 400))
        }
      }
      throw new Error(`Não foi possível ouvir o túnel (${lastError}).`)
    },
  }
  return _transport
}

/**
 * `tunnelCall` que usa o modo certo sozinho: com a assinatura ligada (TUNNEL_SIGN=on) tira o token do comando, assina
 * com ele e responde em tópico privado; desligada, segue o formato antigo.
 */
export async function tunnelCallAuto(
  projectId: string,
  payload: { queryId: string; token?: string; [k: string]: any },
  opts: { timeoutMs?: number; transport?: TunnelTransport; sign?: boolean } = {},
): Promise<any> {
  const { token, ...rest } = payload
  const sign = opts.sign ?? signingEnabled()
  if (sign && token) return tunnelCall(projectId, 'sql_query', rest as any, { ...opts, secret: token })
  return tunnelCall(projectId, 'sql_query', payload, opts)
}
