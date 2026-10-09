import { createHash, createHmac, randomBytes } from 'node:crypto'

/**
 * Assinatura dos comandos enviados ao Agente CLI (lado do servidor). O formato é o mesmo de cli/security.js, e um teste
 * confere que os dois geram a MESMA assinatura.
 *
 * Por quê: o canal `tunnel:<projeto>` é público. Com o token dentro do comando, quem ouvisse o canal o copiava. Agora o
 * token fica só no servidor e no Agente: o servidor assina (HMAC-SHA256 com o token) e o Agente confere.
 */

const VERSION = 'v1'
/**
 * Comandos de USUÁRIO FINAL levam `access` (permissões e regras por linha resolvidas aqui, no servidor) e são assinados
 * com a versão v2: um Agente anterior, que só conhece v1, recusa o comando em vez de executá-lo ignorando `access`.
 */
const VERSION_ACCESS = 'v2'
const versionOf = (body: Record<string, any>) => (body && body.access !== undefined ? VERSION_ACCESS : VERSION)

/** Campos de segurança: ficam fora do corpo assinado. */
const SECURITY_FIELDS = ['sig', 'ts', 'nonce', 'token', 'replyTo']

/**
 * Os comandos ao Agente CLI são SEMPRE assinados (o token não trafega no canal) e o Agente (v1.2+) recusa os que não
 * forem. Não há mais chave para desligar: a função existe para os pontos de decisão do código continuarem legíveis.
 */
export function signingEnabled(_env?: Record<string, string | undefined>): boolean {
  return true
}

/** JSON com chaves ordenadas: a mesma entrada gera o mesmo texto aqui e no Agente. */
export function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined && typeof obj[k] !== 'function').sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

function bodyOf(payload: Record<string, any>): Record<string, any> {
  const body: Record<string, any> = {}
  for (const k of Object.keys(payload || {})) if (!SECURITY_FIELDS.includes(k)) body[k] = payload[k]
  return body
}

export function computeSignature(
  secret: string, event: string, projectId: string, ts: number, nonce: string, replyTo: string | undefined, payload: Record<string, any>,
): string {
  const bodyHash = createHash('sha256').update(stableStringify(bodyOf(payload))).digest('hex')
  const input = [versionOf(payload), event, projectId, String(ts), nonce, replyTo || '', bodyHash].join('\n')
  return createHmac('sha256', secret).update(input).digest('base64url')
}

export interface SignOptions { ts?: number; nonce?: string; replyTo?: string }

/** Devolve o comando assinado: sem `token`, com `ts`, `nonce`, `sig` (e `replyTo`, se houver). */
/**
 * Tópico PRIVADO de comandos do projeto, derivado do token (HMAC): só o servidor e o Agente o conhecem. O canal público
 * `tunnel:<projeto>` não carrega mais comandos. Mesma conta em cli/security.js (um teste confere).
 */
export function commandTopic(projectId: string, secret: string): string {
  const tag = createHmac('sha256', secret).update(`mb-cmd-topic\n${projectId}`).digest('base64url').slice(0, 32)
  return `tunnel-cmd:${projectId}:${tag}`
}

/**
 * Onde os comandos assinados são publicados: o tópico PRIVADO do projeto. `TUNNEL_COMMAND_TOPIC=public` volta ao canal
 * público de sempre, só para o intervalo em que o Agente ainda não foi atualizado. Sem token (comando antigo, sem
 * assinatura) só existe o canal público.
 */
export function commandTopicFor(projectId: string, secret?: string, env: Record<string, string | undefined> = process.env): string {
  if (!secret || String(env.TUNNEL_COMMAND_TOPIC || '').trim().toLowerCase() === 'public') return `tunnel:${projectId}`
  return commandTopic(projectId, secret)
}

export function signCommand(secret: string, event: string, projectId: string, payload: Record<string, any>, opts: SignOptions = {}): Record<string, any> {
  const ts = opts.ts ?? Date.now()
  const nonce = opts.nonce ?? randomBytes(16).toString('base64url')
  const body = bodyOf(payload)
  const sig = computeSignature(secret, event, projectId, ts, nonce, opts.replyTo, body)
  return { ...body, ts, nonce, sig, ...(opts.replyTo ? { replyTo: opts.replyTo } : {}) }
}

/**
 * Autentica um comando para o Agente: SEMPRE assinado (o token nunca vai dentro do comando). Usado por tudo que o
 * SERVIDOR envia ao Agente (comandos de dados, exportações, downloads).
 */
export function authenticateCommand(
  secret: string, event: string, projectId: string, payload: Record<string, any>,
  opts: { replyTo?: string } = {},
): Record<string, any> {
  const replyTo = opts.replyTo && isValidReplyTopic(projectId, opts.replyTo) ? opts.replyTo : undefined
  return signCommand(secret, event, projectId, payload, { replyTo })
}

// ── Tópicos de resposta ──────────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `tunnel:<projeto>:<segredo>`: o segredo é o que impede estranhos de ouvir as respostas. */
export function isValidReplyTopic(projectId: string, topic: unknown): topic is string {
  return typeof topic === 'string' && new RegExp(`^tunnel:${escapeRe(projectId)}:[A-Za-z0-9_-]{16,64}$`).test(topic)
}

/** Tópico novo, imprevisível (128 bits). `kind` só ajuda a reconhecer o uso nos logs. */
export function newReplyTopic(projectId: string, kind = 's'): string {
  return `tunnel:${projectId}:${kind}${randomBytes(16).toString('base64url')}`
}
