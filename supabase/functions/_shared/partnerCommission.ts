/**
 * Regras do programa de parceiros (indicador com comissão), em funções puras: cálculo da comissão, carência, saldo, máscara de e-mail,
 * validação de chave Pix e a decisão do webhook de validação de saque do Asaas. Servem à Edge Function e ao site, e são testadas em
 * src/lib/__tests__/partnerCommission.test.ts. O acesso ao banco mora em partners.ts (Deno) e em src/app/actions/partners.ts.
 */

export const PIX_KEY_TYPES = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'] as const
export type PixKeyType = (typeof PIX_KEY_TYPES)[number]

export const isPixKeyType = (v: unknown): v is PixKeyType => typeof v === 'string' && (PIX_KEY_TYPES as readonly string[]).includes(v)

// ---------------------------------------------------------------------------------------------------------------------------------
// comissão
// ---------------------------------------------------------------------------------------------------------------------------------

/** % do parceiro (se tiver o seu) ou o padrão global; sempre entre 0 e 100. */
export function resolvePercent(partnerPercent: number | null | undefined, defaultPercent: number): number {
  const p = partnerPercent != null && Number.isFinite(Number(partnerPercent)) ? Number(partnerPercent) : Number(defaultPercent)
  if (!Number.isFinite(p)) return 0
  return Math.max(0, Math.min(100, p))
}

/** Comissão em reais, sobre o valor LÍQUIDO (depois das taxas do Asaas), arredondada para BAIXO no centavo (nunca paga a mais). */
export function commissionAmount(net: number, percent: number): number {
  const cents = Math.round(Number(net) * 100)
  if (!Number.isFinite(cents) || cents <= 0) return 0
  return Math.floor((cents * Math.max(0, Math.min(100, percent))) / 100) / 100
}

/** Quando a comissão fica disponível: o pagamento mais os dias de carência. */
export function releaseDate(from: Date, graceDays: number): Date {
  return new Date(from.getTime() + Math.max(0, Math.floor(graceDays)) * 86_400_000)
}

export interface CommissionLike {
  status: 'pending' | 'in_payout' | 'paid' | 'revoked' | string
  amount: number | string
  release_at: string | Date
  clawback?: boolean
  clawback_settled?: boolean
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const ts = (v: string | Date) => new Date(v).getTime()

/** Disponível = pendente com a carência vencida. */
export const isAvailable = (c: CommissionLike, now: Date = new Date()): boolean => c.status === 'pending' && ts(c.release_at) <= now.getTime()

export interface CommissionSummary {
  /** em carência (ainda não pode ser paga) */
  waiting: number
  /** disponível para entrar num lote */
  available: number
  /** já está num lote em andamento */
  inPayout: number
  /** já paga */
  paid: number
  /** perdida por estorno ou reembolso antes de pagar */
  revoked: number
  /** estornos de comissões já enviadas/pagas, que ainda serão descontados do próximo lote */
  clawback: number
  /** quanto o próximo lote pagaria: disponível menos o desconto de estornos (nunca negativo) */
  payable: number
}

export function summarizeCommissions(rows: CommissionLike[], now: Date = new Date()): CommissionSummary {
  const s: CommissionSummary = { waiting: 0, available: 0, inPayout: 0, paid: 0, revoked: 0, clawback: 0, payable: 0 }
  for (const c of rows) {
    const a = num(c.amount)
    if (c.clawback && !c.clawback_settled) s.clawback += a
    if (c.status === 'pending') { if (isAvailable(c, now)) s.available += a; else s.waiting += a }
    else if (c.status === 'in_payout') s.inPayout += a
    else if (c.status === 'paid') s.paid += a
    else if (c.status === 'revoked') s.revoked += a
  }
  const r2 = (n: number) => Math.round(n * 100) / 100
  s.waiting = r2(s.waiting); s.available = r2(s.available); s.inPayout = r2(s.inPayout); s.paid = r2(s.paid); s.revoked = r2(s.revoked); s.clawback = r2(s.clawback)
  s.payable = Math.max(0, r2(s.available - s.clawback))
  return s
}

// ---------------------------------------------------------------------------------------------------------------------------------
// privacidade
// ---------------------------------------------------------------------------------------------------------------------------------

/** O parceiro vê quem comprou, mas sem o e-mail inteiro: "j***@empresa.com". */
export function maskEmail(email: string | null | undefined): string {
  const e = (email || '').trim()
  const at = e.indexOf('@')
  if (at < 1) return '***'
  return `${e[0]}***${e.slice(at)}`
}

// ---------------------------------------------------------------------------------------------------------------------------------
// chave Pix
// ---------------------------------------------------------------------------------------------------------------------------------

const digits = (s: string) => s.replace(/\D/g, '')

export function isValidCpf(raw: string): boolean {
  const d = digits(raw)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function isValidCnpj(raw: string): boolean {
  const d = digits(raw)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * w[i]
    const r = sum % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

/** Forma que o Asaas espera: CPF/CNPJ só dígitos, telefone com 11 dígitos (DDD + número, sem +55), e-mail em minúsculas. */
export function normalizePixKey(type: PixKeyType, key: string): string {
  const k = (key || '').trim()
  switch (type) {
    case 'CPF': case 'CNPJ': return digits(k)
    case 'PHONE': { const d = digits(k); return d.length === 13 && d.startsWith('55') ? d.slice(2) : d }
    case 'EMAIL': return k.toLowerCase()
    default: return k.toLowerCase()
  }
}

/** Confere a chave pelo tipo. Devolve a chave normalizada ou o motivo da recusa. */
export function validatePixKey(type: PixKeyType, key: string): { ok: true; key: string } | { ok: false; reason: 'invalid_cpf' | 'invalid_cnpj' | 'invalid_phone' | 'invalid_email' | 'invalid_evp' } {
  const k = normalizePixKey(type, key)
  if (type === 'CPF') return isValidCpf(k) ? { ok: true, key: k } : { ok: false, reason: 'invalid_cpf' }
  if (type === 'CNPJ') return isValidCnpj(k) ? { ok: true, key: k } : { ok: false, reason: 'invalid_cnpj' }
  if (type === 'PHONE') return /^\d{11}$/.test(k) ? { ok: true, key: k } : { ok: false, reason: 'invalid_phone' }
  if (type === 'EMAIL') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k) ? { ok: true, key: k } : { ok: false, reason: 'invalid_email' }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k) ? { ok: true, key: k } : { ok: false, reason: 'invalid_evp' }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// webhook de validação de saque do Asaas
// ---------------------------------------------------------------------------------------------------------------------------------

export interface PayoutItemLike {
  id: string
  status: string
  amount: number | string
  pix_key: string
  pix_key_type: string
  asaas_transfer_id: string | null
}

export interface TransferValidationPayload {
  type?: string
  transfer?: { id?: string; value?: number | string; bankAccount?: { pixAddressKey?: string | null } | null } | null
}

export type TransferDecision = { status: 'APPROVED'; itemId: string } | { status: 'REFUSED'; refuseReason: string }

/**
 * O Asaas pergunta, uns 5 s depois de criarmos uma transferência, se pode efetivá-la. Só aprovamos o que NÓS criamos num lote confirmado pelo
 * SuperAdmin: tipo TRANSFER, item em envio, mesmo valor e mesma chave Pix. Qualquer outra operação (boleto, recarga, estorno...) é recusada.
 */
export function decideTransferValidation(payload: TransferValidationPayload, items: PayoutItemLike[]): TransferDecision {
  if (payload?.type !== 'TRANSFER' || !payload.transfer) return { status: 'REFUSED', refuseReason: 'Operação não prevista (só transferências de lotes de parceiros)' }
  const t = payload.transfer
  const value = Number(t.value)
  if (!Number.isFinite(value) || value <= 0) return { status: 'REFUSED', refuseReason: 'Valor inválido' }
  const sentKey = t.bankAccount?.pixAddressKey ? String(t.bankAccount.pixAddressKey) : ''
  const sameKey = (it: PayoutItemLike) => !!sentKey && normalizePixKey(it.pix_key_type as PixKeyType, it.pix_key) === normalizePixKey(it.pix_key_type as PixKeyType, sentKey)
  const sameValue = (it: PayoutItemLike) => Math.abs(Number(it.amount) - value) < 0.005

  // 1) pelo id da transferência (gravado logo depois de criá-la)
  const byId = t.id ? items.find(i => i.asaas_transfer_id === t.id) : undefined
  // 2) o Asaas pode perguntar antes de gravarmos o id: aceita se houver UM item "em envio" sem id com o mesmo valor e a mesma chave
  const pending = items.filter(i => i.status === 'sending' && !i.asaas_transfer_id && sameValue(i) && sameKey(i))
  const item = byId ?? (pending.length === 1 ? pending[0] : undefined)

  if (!item) return { status: 'REFUSED', refuseReason: 'Transferência não encontrada em nenhum lote confirmado' }
  if (item.status !== 'sending' && item.status !== 'sent') return { status: 'REFUSED', refuseReason: 'O item do lote não está em envio' }
  if (!sameValue(item)) return { status: 'REFUSED', refuseReason: 'Valor diferente do lote' }
  if (sentKey && !sameKey(item)) return { status: 'REFUSED', refuseReason: 'Chave Pix diferente do lote' }
  return { status: 'APPROVED', itemId: item.id }
}
