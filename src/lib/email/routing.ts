/**
 * Gerenciador de e-mails: regras PURAS (sem banco, sem rede) de qual endereço envia, recebe as respostas e recebe os avisos de cada ASSUNTO.
 * Usadas pelo envio (servidor), pela tela do SuperAdmin e pelos testes. Tudo é opcional: vazio = o comportamento de sempre (conta do SMTP).
 */

export const EMAIL_TOPICS = [
  // aviso ao usuário/cliente/parceiro: só controla De e Responder para
  { id: 'security', team: false },
  { id: 'billing_customer', team: false },
  { id: 'partner_mail', team: false },
  { id: 'checkout', team: false },
  { id: 'agenda', team: false },
  { id: 'stack_interest', team: false },
  { id: 'automations', team: false },
  // aviso à equipe: também controla PARA QUEM vai
  { id: 'billing_team', team: true },
  { id: 'partner_team', team: true },
  // qualquer outro envio que não tenha assunto próprio
  { id: 'default', team: false },
] as const

export type EmailTopic = (typeof EMAIL_TOPICS)[number]['id']
export const EMAIL_TOPIC_IDS: EmailTopic[] = EMAIL_TOPICS.map(t => t.id)
export const isEmailTopic = (v: unknown): v is EmailTopic => typeof v === 'string' && (EMAIL_TOPIC_IDS as string[]).includes(v)
export const isTeamTopic = (id: EmailTopic) => !!EMAIL_TOPICS.find(t => t.id === id)?.team

/** Uma regra. Campo vazio/ausente = usa o padrão. */
export interface EmailRoute { from?: string; replyTo?: string; to?: string }
export type EmailRouting = Partial<Record<EmailTopic, EmailRoute>>

/** Aliases do domínio sugeridos na tela (o nome antes do @). */
export const KNOWN_ALIASES = ['contato', 'financeiro', 'suporte', 'comercial', 'admin', 'engenharia', 'feedback', 'lgpd', 'noreply'] as const

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/
const MAX_LEN = 200

/** Endereço limpo (minúsculo, sem espaços) ou '' se não for um e-mail simples. Nada de nome, vírgula, quebra de linha ou várias pessoas. */
export function cleanAddress(v: unknown): string {
  if (typeof v !== 'string') return ''
  const s = v.trim().toLowerCase()
  return s.length > 0 && s.length <= MAX_LEN && EMAIL_RE.test(s) ? s : ''
}

export const domainOf = (address: string): string => (address.split('@')[1] || '').toLowerCase()

/** Lê o valor guardado com segurança: tópicos desconhecidos e endereços inválidos são descartados. */
export function parseEmailRouting(value: unknown): EmailRouting {
  const v = (value && typeof value === 'object' ? (value as Record<string, unknown>).topics ?? value : {}) as Record<string, unknown>
  const out: EmailRouting = {}
  for (const id of EMAIL_TOPIC_IDS) {
    const r = v[id]
    if (!r || typeof r !== 'object') continue
    const x = r as Record<string, unknown>
    const route: EmailRoute = {}
    const from = cleanAddress(x.from), replyTo = cleanAddress(x.replyTo), to = cleanAddress(x.to)
    if (from) route.from = from
    if (replyTo) route.replyTo = replyTo
    if (to && isTeamTopic(id)) route.to = to
    if (route.from || route.replyTo || route.to) out[id] = route
  }
  return out
}

export type RoutingError = { topic: EmailTopic; field: 'from' | 'replyTo' | 'to'; code: 'invalid_from' | 'invalid_reply_to' | 'invalid_to' | 'foreign_domain' }

/**
 * Confere o que o SuperAdmin digitou. Preenchido e inválido = erro (não some em silêncio). O remetente (De) precisa ser do MESMO domínio da conta
 * do SMTP: o servidor só envia por endereços do domínio, e isso impede usar o site para enviar como outro domínio (falsificação).
 */
export function validateRouting(input: unknown, smtpDomain: string): { ok: true; routing: EmailRouting } | { ok: false; error: RoutingError } {
  const topics = (input && typeof input === 'object' ? (input as Record<string, unknown>).topics ?? input : {}) as Record<string, unknown>
  for (const id of EMAIL_TOPIC_IDS) {
    const r = topics[id]
    if (!r || typeof r !== 'object') continue
    const x = r as Record<string, unknown>
    const filled = (v: unknown) => typeof v === 'string' && v.trim() !== ''
    if (filled(x.from)) {
      const a = cleanAddress(x.from)
      if (!a) return { ok: false, error: { topic: id, field: 'from', code: 'invalid_from' } }
      if (smtpDomain && domainOf(a) !== smtpDomain.toLowerCase()) return { ok: false, error: { topic: id, field: 'from', code: 'foreign_domain' } }
    }
    if (filled(x.replyTo) && !cleanAddress(x.replyTo)) return { ok: false, error: { topic: id, field: 'replyTo', code: 'invalid_reply_to' } }
    if (isTeamTopic(id) && filled(x.to) && !cleanAddress(x.to)) return { ok: false, error: { topic: id, field: 'to', code: 'invalid_to' } }
  }
  return { ok: true, routing: parseEmailRouting(input) }
}

export interface ResolvedRoute {
  /** endereço que envia (a conta do SMTP, se nada foi escolhido) */
  from: string
  /** para onde vão as respostas; undefined = quem recebe responde ao próprio remetente */
  replyTo?: string
  /** só para avisos à equipe: quem recebe, segundo a tela; undefined = vale o que o chamador já tinha */
  to?: string
}

/** Regra de um assunto: o que ele define, senão o que o assunto "default" define, senão a conta do SMTP. */
export function resolveRoute(routing: EmailRouting | null | undefined, topic: EmailTopic, smtpUser: string): ResolvedRoute {
  const t = routing?.[topic] || {}
  const d = routing?.default || {}
  const from = t.from || d.from || cleanAddress(smtpUser) || smtpUser
  const replyTo = t.replyTo || d.replyTo || undefined
  const to = isTeamTopic(topic) ? t.to || undefined : undefined
  return { from, ...(replyTo ? { replyTo } : {}), ...(to ? { to } : {}) }
}

/** Cabeçalho "De" com o nome da marca. */
export const formatFrom = (address: string, name = 'MetaBuilder PRO') => `"${name.replace(/["\r\n]/g, '')}" <${address}>`
