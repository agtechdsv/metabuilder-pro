/**
 * Vagas de sessão por usuário (1 IDE + 1 navegador): regras puras, sem rede nem banco.
 * Desenho: docs/sessoes-dispositivos-desenho.md. Quem fala com o banco é slotService.ts.
 */

export type SlotKind = 'web' | 'ide'
export type SlotMode = 'off' | 'observe' | 'enforce'
export type SlotStatus = 'off' | 'exempt' | 'ok' | 'claimed' | 'occupied' | 'revoked'

/** A sessão que está ocupando a vaga (o que a tela de escolha mostra). */
export interface SlotOther {
  id?: string
  kind?: SlotKind
  label?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
  since?: string
  last_seen_at?: string
  device_id?: string
}

export interface SlotResult {
  status: SlotStatus
  mode: SlotMode
  /** segundos até o servidor reconferir a vaga */
  ttl: number
  would_block?: boolean
  other?: SlotOther
  reason?: string
  /** quem tomou a vaga (quando esta sessão foi derrubada) */
  by?: SlotOther | null
  revoked_at?: string
}

export interface SlotInput {
  userId: string
  kind: SlotKind
  deviceId: string
  sessionId: string
  label: string
  city: string | null
  region: string | null
  country: string | null
  ipHash: string | null
}

export const DEVICE_COOKIE = 'mb_device'
export const KIND_COOKIE = 'mb_kind'
export const SLOT_COOKIE = 'mb_slot'

/** Quantas vezes o usuário pode errar o código enviado por e-mail antes de pedir outro. */
export const MAX_CODE_ATTEMPTS = 5
/** Validade do código por e-mail, em minutos. */
export const CODE_TTL_MINUTES = 10
/** Intervalo mínimo entre dois envios de código, em segundos. */
export const CODE_RESEND_SECONDS = 60

/**
 * Áreas da plataforma onde a regra vale (lista positiva: o que não está aqui fica de fora).
 * Fora dela ficam as páginas públicas, /login, /auth, /api e o runtime dos apps publicados dos clientes (/[workspace]/[projeto]),
 * que tem a autenticação dos usuários finais de cada projeto.
 */
export const PROTECTED_PREFIXES = ['/admin', '/client', '/workspace', '/ide-local', '/bpm', '/tunnel-logs', '/parceiro'] as const

/**
 * Rotas de API sensíveis que usam o login do navegador/IDE (cookie). Ficam de fora de propósito: /api/session (o próprio batimento),
 * /api/auth, /api/tunnel e /api/cron (usam token, não o cookie), /api/runtime e o resto das rotas públicas.
 * Estas respondem 401 em vez de redirecionar quando a sessão não é a dona da vaga.
 */
export const PROTECTED_API_PREFIXES = [
  '/api/admin', '/api/ai-builder', '/api/build-desktop', '/api/export-workspace', '/api/export-native', '/api/byoc',
  '/api/domains', '/api/workspace-source', '/api/project-source', '/api/metadata',
] as const

const startsWithPrefix = (p: string, prefix: string) => p === prefix || p.startsWith(prefix + '/')

export const isProtectedApiPath = (pathname: string): boolean => {
  const p = pathname.replace(/\/+$/, '') || '/'
  return PROTECTED_API_PREFIXES.some(prefix => startsWithPrefix(p, prefix))
}

export function isProtectedPath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/'
  return PROTECTED_PREFIXES.some(prefix => startsWithPrefix(p, prefix)) || isProtectedApiPath(p)
}

export function parseKind(value: string | null | undefined): SlotKind {
  return value === 'ide' ? 'ide' : 'web'
}

export function parseMode(value: unknown): SlotMode {
  return value === 'observe' || value === 'enforce' ? value : 'off'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

/** Lê a claim session_id do JWT (o token já foi validado pelo Supabase antes; aqui só extraímos). */
export function sessionIdFromJwt(token: string | null | undefined): string | null {
  if (!token) return null
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')
    const payload = JSON.parse(decodeURIComponent(Array.from(json, c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')))
    return isUuid(payload?.session_id) ? payload.session_id : null
  } catch {
    return null
  }
}

/** "Chrome · Windows", "IDE · macOS": o mesmo texto em qualquer idioma, para guardar no banco. */
export function describeClient(userAgent: string | null | undefined, kind: SlotKind): string {
  const ua = userAgent || ''
  const os =
    /Windows/i.test(ua) ? 'Windows' :
    /Android/i.test(ua) ? 'Android' :
    /iPhone|iPad|iPod/i.test(ua) ? 'iOS' :
    /Mac OS X|Macintosh/i.test(ua) ? 'macOS' :
    /CrOS/i.test(ua) ? 'ChromeOS' :
    /Linux|X11/i.test(ua) ? 'Linux' : ''
  if (kind === 'ide') return os ? `IDE · ${os}` : 'IDE'
  const browser =
    /Edg\//i.test(ua) ? 'Edge' :
    /OPR\/|Opera/i.test(ua) ? 'Opera' :
    /Firefox\//i.test(ua) ? 'Firefox' :
    /Chrome\/|CriOS/i.test(ua) ? 'Chrome' :
    /Safari\//i.test(ua) ? 'Safari' : ''
  return [browser, os].filter(Boolean).join(' · ') || 'Navegador'
}

type Getter = (name: string) => string | null | undefined

/** Cidade, região e país vêm dos cabeçalhos que a Vercel injeta (sem serviço externo). Fora da Vercel ficam nulos. */
export function geoFromHeaders(get: Getter): { city: string | null; region: string | null; country: string | null } {
  const dec = (v: string | null | undefined) => {
    if (!v) return null
    try { return decodeURIComponent(v).trim().slice(0, 80) || null } catch { return v.trim().slice(0, 80) || null }
  }
  return { city: dec(get('x-vercel-ip-city')), region: dec(get('x-vercel-ip-country-region')), country: dec(get('x-vercel-ip-country')) }
}

export function clientIp(get: Getter): string | null {
  const fwd = get('x-forwarded-for')
  const first = fwd ? fwd.split(',')[0].trim() : ''
  return first || get('x-real-ip')?.trim() || null
}

/** Texto curto de lugar para mostrar ao usuário: "Belo Horizonte, MG" ou "BR". */
export function placeText(o: { city?: string | null; region?: string | null; country?: string | null } | null | undefined, unknown = ''): string {
  if (!o) return unknown
  const parts = [o.city, o.region].filter(Boolean)
  if (parts.length) return parts.join(', ')
  return o.country || unknown
}

// --- assinatura (HMAC-SHA256 com Web Crypto: serve no proxy e no servidor) --------------------------------------------------------

const enc = new TextEncoder()

function toBase64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toBase64Url(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Segredo para assinar o cookie e gerar hashes: DEVICE_SLOT_SECRET, ou a chave de serviço que o servidor já tem. */
export function slotSecret(env: Record<string, string | undefined> = process.env): string {
  return env.DEVICE_SLOT_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export interface SlotCookieClaims { sessionId: string; kind: SlotKind; deviceId: string }

/** Cookie `mb_slot`: prova, por alguns segundos, que a vaga desta sessão foi conferida (evita ir ao banco em toda requisição). */
export async function signSlotCookie(claims: SlotCookieClaims, ttlSeconds: number, secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + Math.max(1, Math.floor(ttlSeconds))
  const body = `${claims.sessionId}.${claims.kind}.${claims.deviceId}.${exp}`
  return `${body}.${await hmac(secret, 'slot:' + body)}`
}

export async function verifySlotCookie(value: string | null | undefined, expected: SlotCookieClaims, secret: string, nowMs = Date.now()): Promise<boolean> {
  if (!value || !secret) return false
  const parts = value.split('.')
  if (parts.length !== 5) return false
  const [sessionId, kind, deviceId, expStr, sig] = parts
  if (sessionId !== expected.sessionId || kind !== expected.kind || deviceId !== expected.deviceId) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) return false
  const good = await hmac(secret, `slot:${sessionId}.${kind}.${deviceId}.${expStr}`)
  return safeEqual(good, sig)
}

/** Hash do IP (nunca guardamos o IP puro). */
export async function hashIp(ip: string | null | undefined, secret: string): Promise<string | null> {
  if (!ip || !secret) return null
  return (await hmac(secret, 'ip:' + ip)).slice(0, 32)
}

/** Código de 6 dígitos para confirmar a troca de dispositivo (usa o gerador seguro do sistema). */
export function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]
  return String(100000 + (n % 900000))
}

export async function hashCode(code: string, sessionId: string, secret: string): Promise<string> {
  return hmac(secret, `code:${sessionId}:${code.trim()}`)
}

export async function codeMatches(code: string, sessionId: string, secret: string, expectedHash: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code.trim())) return false
  return safeEqual(await hashCode(code, sessionId, secret), expectedHash)
}

// --- decisão do portão -------------------------------------------------------------------------------------------------------------

export type GateAction = 'pass' | 'choose' | 'revoked'

/** O que fazer com a requisição, dado o resultado do banco. Se o banco falhou (null), deixa passar: nunca travamos o usuário por falha nossa. */
export function decideGate(result: SlotResult | null): GateAction {
  if (!result) return 'pass'
  if (result.status === 'occupied') return 'choose'
  if (result.status === 'revoked') return 'revoked'
  return 'pass'
}

/** Só aceita caminhos internos como destino depois da escolha (evita redirecionamento para outro site). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/client/dashboard'
  if (next.startsWith('/auth/sessao-ativa')) return '/client/dashboard'
  return next
}

export const chooseUrl = (next: string) => `/auth/sessao-ativa?next=${encodeURIComponent(safeNext(next))}`

export function revokedUrl(by?: SlotOther | null): string {
  const q = new URLSearchParams({ motivo: 'encerrada' })
  const place = placeText(by)
  if (place) q.set('cidade', place)
  if (by?.since) q.set('hora', by.since)
  return `/login?${q.toString()}`
}

/** Códigos de erro que as ações devolvem à tela. */
export type SlotErrorCode = 'not_authenticated' | 'session_revoked' | 'invalid_code' | 'code_expired' | 'too_many_attempts' | 'too_soon' | 'mail_failed' | 'unknown'
