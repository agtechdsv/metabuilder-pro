import { createHash, createHmac, randomBytes } from 'node:crypto'

/**
 * Assinatura dos comandos enviados ao Agente CLI (lado do servidor). O formato é o mesmo de cli/security.js, e um teste
 * confere que os dois geram a MESMA assinatura.
 *
 * Por quê: o canal `tunnel:<projeto>` é público. Com o token dentro do comando, quem ouvisse o canal o copiava. Agora o
 * token fica só no servidor e no Agente: o servidor assina (HMAC-SHA256 com o token) e o Agente confere.
 */

const VERSION = 'v1'

/** Campos de segurança: ficam fora do corpo assinado. */
const SECURITY_FIELDS = ['sig', 'ts', 'nonce', 'token', 'replyTo']

/** Assinar comandos está ligado? (TUNNEL_SIGN=on — só depois de o Agente CLI estar na versão que verifica assinaturas) */
export function signingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TUNNEL_SIGN === 'on'
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
  const input = [VERSION, event, projectId, String(ts), nonce, replyTo || '', bodyHash].join('\n')
  return createHmac('sha256', secret).update(input).digest('base64url')
}

export interface SignOptions { ts?: number; nonce?: string; replyTo?: string }

/** Devolve o comando assinado: sem `token`, com `ts`, `nonce`, `sig` (e `replyTo`, se houver). */
export function signCommand(secret: string, event: string, projectId: string, payload: Record<string, any>, opts: SignOptions = {}): Record<string, any> {
  const ts = opts.ts ?? Date.now()
  const nonce = opts.nonce ?? randomBytes(16).toString('base64url')
  const body = bodyOf(payload)
  const sig = computeSignature(secret, event, projectId, ts, nonce, opts.replyTo, body)
  return { ...body, ts, nonce, sig, ...(opts.replyTo ? { replyTo: opts.replyTo } : {}) }
}

/**
 * Autentica um comando para o Agente: assinado quando a assinatura está ligada; senão, o formato antigo (token dentro).
 * Usado por tudo que o SERVIDOR envia ao Agente (comandos de dados, exportações, downloads).
 */
export function authenticateCommand(
  secret: string, event: string, projectId: string, payload: Record<string, any>,
  opts: { sign?: boolean; replyTo?: string } = {},
): Record<string, any> {
  const sign = opts.sign ?? signingEnabled()
  const replyTo = opts.replyTo && isValidReplyTopic(projectId, opts.replyTo) ? opts.replyTo : undefined
  if (sign) return signCommand(secret, event, projectId, payload, { replyTo })
  return { ...payload, token: secret, ...(replyTo ? { replyTo } : {}) }
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
