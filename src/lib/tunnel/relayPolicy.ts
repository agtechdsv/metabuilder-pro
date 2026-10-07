import { authenticateCommand } from './commandSigning'

/**
 * Regras do relay do túnel (puras, para testar sem rede): o que cada tipo de usuário pode pedir ao Agente CLI.
 */

/** Só este evento do navegador vira comando ao Agente CLI. */
export const RELAY_EVENTS = ['sql_query'] as const

/** Ações do CLI que não são consultas de dados do app: ficam só para quem tem acesso de desenvolvedor ao projeto. */
const DEVELOPER_ONLY_ACTIONS = new Set([
  'raw_sql', 'sync_bpm', 'sync_log_config', 'read_logs', 'clear_logs', 'get_log_stats',
  // lê QUALQUER tabela indicada pela configuração que o navegador manda (usado só nas telas do Studio)
  'get_users',
])

/** O login do usuário final passa pelo servidor (que vê a resposta); nunca por este relay. */
const SERVER_ONLY_ACTIONS = new Set(['validate_login'])

export const MAX_RELAY_BYTES = 4 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type RelayActorKind = 'member' | 'end_user'

export interface RelayRequest {
  projectId: string
  event: string
  payload: Record<string, any>
}

/** Valida o formato do pedido. Devolve o pedido limpo ou o motivo da recusa. */
export function parseRelayRequest(body: unknown): { ok: true; req: RelayRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Pedido inválido.' }
  const { projectId, event, payload } = body as Record<string, unknown>
  if (typeof projectId !== 'string' || !UUID.test(projectId)) return { ok: false, error: 'Projeto inválido.' }
  if (typeof event !== 'string' || !(RELAY_EVENTS as readonly string[]).includes(event)) return { ok: false, error: 'Evento não permitido.' }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: 'Comando inválido.' }
  if (typeof (payload as any).queryId !== 'string' || (payload as any).queryId === '') return { ok: false, error: 'Comando sem identificador.' }
  return { ok: true, req: { projectId, event, payload: payload as Record<string, any> } }
}

/** O ator pode enviar esta ação? */
export function actionAllowed(kind: RelayActorKind, action: unknown): { ok: true } | { ok: false; error: string } {
  const a = typeof action === 'string' ? action : ''
  if (SERVER_ONLY_ACTIONS.has(a)) return { ok: false, error: 'Esta ação só é feita pelo servidor.' }
  if (kind === 'end_user' && DEVELOPER_ONLY_ACTIONS.has(a)) return { ok: false, error: 'Ação reservada ao desenvolvedor do projeto.' }
  return { ok: true }
}

/**
 * Monta o comando que vai ao CLI. O token do projeto é sempre o do servidor, nunca o que veio do navegador.
 * O comando vai sempre assinado e SEM token; `replyTo` (tópico privado da aba) é mantido só se for
 * um tópico válido deste projeto.
 */
export function buildCommand(req: RelayRequest, secretToken: string): Record<string, any> {
  const { token: _fromBrowser, replyTo, ...rest } = req.payload
  return authenticateCommand(secretToken, req.event, req.projectId, { ...rest, projectId: req.projectId }, {
    replyTo: typeof replyTo === 'string' ? replyTo : undefined,
  })
}

/**
 * Limitador simples em memória (janela deslizante) por chave. Em serverless cada instância tem o seu, então é uma
 * proteção contra abuso casual, não um limite exato.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  constructor(private readonly max: number, private readonly windowMs: number, private readonly now: () => number = Date.now) {}

  allow(key: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(key) || []).filter(x => t - x < this.windowMs)
    if (recent.length >= this.max) { this.hits.set(key, recent); return false }
    recent.push(t)
    this.hits.set(key, recent)
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.every(x => t - x >= this.windowMs)) this.hits.delete(k)
    return true
  }
}
