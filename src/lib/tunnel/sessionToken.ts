import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'

/**
 * Tokens assinados do runtime (HMAC-SHA256): sessão do usuário final, etapa pendente de MFA e prova de MFA.
 *
 * Cada token carrega o "tipo" dentro da parte assinada, então um token de um tipo nunca vale como outro (um token
 * pendente não serve de sessão). A chave vem de RUNTIME_SESSION_SECRET ou, sem ela, é derivada (HKDF) da chave de
 * serviço do Supabase — que só existe no servidor —, então não é preciso configurar nada novo.
 */

export type TokenKind = 'session' | 'mfa_pending' | 'mfa_proof'

const KIND_CONTEXT = 'mb-runtime-token-v1'

export function sessionSecret(env: Record<string, string | undefined> = process.env): Buffer {
  const explicit = env.RUNTIME_SESSION_SECRET
  if (explicit && explicit.length >= 32) return Buffer.from(explicit, 'utf8')
  const base = env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || base.length < 20) {
    throw new Error('Defina RUNTIME_SESSION_SECRET (ou SUPABASE_SERVICE_ROLE_KEY) para assinar sessões do runtime.')
  }
  return Buffer.from(hkdfSync('sha256', Buffer.from(base, 'utf8'), Buffer.alloc(0), KIND_CONTEXT, 32))
}

const b64u = (buf: Buffer | string) => Buffer.from(buf).toString('base64url')

function mac(secret: Buffer, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url')
}

export interface TokenOptions {
  secret?: Buffer
  /** relógio injetável (segundos desde 1970), para testes */
  now?: () => number
}

/** Assina `data` como um token do tipo `kind`, válido por `ttlSeconds`. */
export function signToken<T extends object>(kind: TokenKind, data: T, ttlSeconds: number, opts: TokenOptions = {}): string {
  const now = (opts.now ?? (() => Math.floor(Date.now() / 1000)))()
  const body = b64u(JSON.stringify({ k: kind, d: data, exp: now + ttlSeconds }))
  return `${body}.${mac(opts.secret ?? sessionSecret(), body)}`
}

/** Devolve os dados se a assinatura confere, o tipo é o esperado e não expirou; senão null. */
export function verifyToken<T = any>(kind: TokenKind, token: string | undefined | null, opts: TokenOptions = {}): T | null {
  if (!token || typeof token !== 'string' || token.length > 8192) return null
  const parts = token.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null
  try {
    const expected = Buffer.from(mac(opts.secret ?? sessionSecret(), parts[0]))
    const given = Buffer.from(parts[1])
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    const now = (opts.now ?? (() => Math.floor(Date.now() / 1000)))()
    if (!payload || payload.k !== kind || typeof payload.exp !== 'number' || payload.exp < now) return null
    return payload.d as T
  } catch {
    return null
  }
}

// ── Sessão do usuário final ────────────────────────────────────────────────────

export interface EndUserSession {
  /** projeto ao qual a sessão pertence (uma sessão nunca vale em outro projeto) */
  pid: string
  /** identificador do usuário na tabela de usuários do cliente */
  sub: string
  email?: string
  name?: string
  /** colunas do cadastro que as regras de acesso do BI consultam */
  attrs?: Record<string, string>
  /** parte da linha do usuário (valores simples e curtos): papel, id... usada nas decisões de acesso do servidor */
  row?: Record<string, string | number | boolean | null>
}

export const END_USER_SESSION_TTL = 60 * 60 * 24 * 7
export const MFA_PENDING_TTL = 60 * 5
export const MFA_PROOF_TTL = 60 * 2

export const endUserCookieName = (projectId: string) => `mb_eu_${projectId}`

export const signEndUserSession = (s: EndUserSession, opts?: TokenOptions) => signToken('session', s, END_USER_SESSION_TTL, opts)

/** Sessão válida DESTE projeto, ou null. */
export function verifyEndUserSession(token: string | undefined | null, projectId: string, opts?: TokenOptions): EndUserSession | null {
  const s = verifyToken<EndUserSession>('session', token, opts)
  return s && s.pid === projectId && typeof s.sub === 'string' && s.sub !== '' ? s : null
}
