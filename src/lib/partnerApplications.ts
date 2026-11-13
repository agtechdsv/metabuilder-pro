/** Candidaturas ao programa de parceiros (formulário público em /parceiros). Regras puras: validação e tipos, usados pela server action, pela tela e pelos testes. */

export const APPLICATION_CHANNELS = ['consulting', 'freelancer', 'community', 'integrator', 'other'] as const
export type ApplicationChannel = (typeof APPLICATION_CHANNELS)[number]

export type ApplicationStatus = 'new' | 'approved' | 'rejected'

/** Tempo mínimo entre abrir o formulário e enviar: gente leva mais que isso, robô não. */
export const MIN_FILL_MS = 3000
/** Quantos envios o mesmo IP (hash) pode fazer por hora. */
export const MAX_PER_IP_PER_HOUR = 5

export interface ApplicationInput {
  name: string
  email: string
  phone: string
  company: string
  channel: string
  audience: string
  message: string
  consent: boolean
  lang: string
  /** campo isca: escondido para pessoas, robôs costumam preencher */
  website: string
  /** quando o formulário foi aberto (ms desde 1970) */
  openedAt: number
}

export type ApplicationErrorCode =
  | 'name_invalid' | 'email_invalid' | 'phone_invalid' | 'channel_invalid' | 'text_too_long' | 'consent_required'
  | 'too_fast' | 'rate_limited' | 'unknown'

/** Erros das ações do SuperAdmin sobre candidaturas: por código, a tela traduz (pt, en, es). */
export type ActionCode = 'not_authorized' | 'invalid_email' | 'invalid_status' | 'unknown'
export type ActionResult = { success: true } | { success: false; code: ActionCode; error?: string }

export interface ApplicationRow {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  channel: ApplicationChannel
  audience: string | null
  message: string | null
  status: ApplicationStatus
  partnerId: string | null
  createdAt: string
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/

export interface CleanApplication {
  name: string
  email: string
  phone: string | null
  company: string | null
  channel: ApplicationChannel
  audience: string | null
  message: string | null
  lang: string
}

/** Confere e limpa o que veio do formulário. Devolve o primeiro erro, em código, ou os campos prontos para gravar. */
export function validateApplication(input: Partial<ApplicationInput>): { ok: true; value: CleanApplication } | { ok: false; code: ApplicationErrorCode } {
  const s = (v: unknown) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : '')
  const name = s(input.name).replace(/\s+/g, ' ')
  const email = s(input.email).toLowerCase()
  const phone = s(input.phone)
  const company = s(input.company)
  const audience = s(input.audience)
  const message = s(input.message)

  if (name.length < 2 || name.length > 120) return { ok: false, code: 'name_invalid' }
  if (email.length > 200 || !EMAIL_RE.test(email)) return { ok: false, code: 'email_invalid' }
  if (phone && (phone.length > 40 || !/^[0-9+()\-.\s]{6,40}$/.test(phone))) return { ok: false, code: 'phone_invalid' }
  if (!APPLICATION_CHANNELS.includes(input.channel as ApplicationChannel)) return { ok: false, code: 'channel_invalid' }
  if (company.length > 120 || audience.length > 600 || message.length > 2000) return { ok: false, code: 'text_too_long' }
  if (input.consent !== true) return { ok: false, code: 'consent_required' }

  const lang = ['pt', 'en', 'es'].includes(String(input.lang)) ? String(input.lang) : 'pt'
  return {
    ok: true,
    value: {
      name, email, phone: phone || null, company: company || null, channel: input.channel as ApplicationChannel,
      audience: audience || null, message: message || null, lang,
    },
  }
}

/** Robô: preencheu o campo isca ou enviou rápido demais. Pessoas nunca caem aqui. */
export function looksLikeBot(input: Partial<ApplicationInput>, now: number): 'honeypot' | 'too_fast' | null {
  if (typeof input.website === 'string' && input.website.trim() !== '') return 'honeypot'
  const opened = Number(input.openedAt)
  if (!Number.isFinite(opened) || now - opened < MIN_FILL_MS || now - opened < 0) return 'too_fast'
  return null
}

/** Sugestão de código do link a partir do nome (o SuperAdmin pode trocar): primeira palavra, sem acento, em maiúsculas. */
export function suggestPartnerCode(name: string): string {
  const first = name.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/)[0] || ''
  const code = first.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return code.length >= 3 ? code.slice(0, 20) : (code + 'PARCEIRO').slice(0, 20)
}
