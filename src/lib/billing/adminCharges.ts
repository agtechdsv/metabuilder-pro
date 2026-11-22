/**
 * Lista de cobranças do SuperAdmin (subaba Clientes > Cobranças): regras puras, sem rede, para a ação de servidor e para os testes.
 * A fonte é a tabela `payments` (a mesma que o webhook do Asaas mantém). Só leitura.
 */
import { dayInBrasilia } from '@/lib/nfse/queue'

export type ChargeGroup = 'upcoming' | 'overdue' | 'paid' | 'canceled' | 'refunded'
export type ChargeStatusFilter = 'all' | ChargeGroup
export type ChargeDateField = 'due' | 'paid'
export type ChargeMethodFilter = 'all' | 'PIX' | 'CREDIT_CARD' | 'BOLETO'

export const CHARGE_GROUPS: ChargeGroup[] = ['upcoming', 'overdue', 'paid', 'canceled', 'refunded']
export const PAGE_SIZE = 25
export const MAX_SUMMARY_ROWS = 5000
const METHODS: ChargeMethodFilter[] = ['all', 'PIX', 'CREDIT_CARD', 'BOLETO']

export interface ChargeFilters {
  status: ChargeStatusFilter
  dateField: ChargeDateField
  /** AAAA-MM-DD (Brasília) */
  from: string
  to: string
  userId: string
  /** nome, e-mail ou id do Asaas */
  q: string
  method: ChargeMethodFilter
  page: number
}

export const DEFAULT_FILTERS: ChargeFilters = { status: 'all', dateField: 'due', from: '', to: '', userId: '', q: '', method: 'all', page: 0 }

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z'))
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** Texto de busca seguro para entrar num filtro `or()` do PostgREST: tira vírgula, parênteses, curingas e barra invertida. */
export function sanitizeSearch(q: unknown): string {
  return String(q ?? '').replace(/[,()%*\\"'`;:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** Aceita só o que a tela pode mandar; o resto volta ao padrão. Datas invertidas são trocadas. */
export function normalizeFilters(input: unknown): ChargeFilters {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  let from = isDay(i.from) ? i.from : ''
  let to = isDay(i.to) ? i.to : ''
  if (from && to && from > to) [from, to] = [to, from]
  const page = Number.isInteger(i.page) && (i.page as number) >= 0 && (i.page as number) < 100_000 ? (i.page as number) : 0
  return {
    status: (i.status === 'all' || CHARGE_GROUPS.includes(i.status as ChargeGroup)) ? (i.status as ChargeStatusFilter) : 'all',
    dateField: i.dateField === 'paid' ? 'paid' : 'due',
    from, to,
    userId: isUuid(i.userId) ? i.userId : '',
    q: sanitizeSearch(i.q),
    method: METHODS.includes(i.method as ChargeMethodFilter) ? (i.method as ChargeMethodFilter) : 'all',
    page,
  }
}

/** Em que grupo a cobrança cai. Pendente com vencimento passado conta como vencida (o aviso do Asaas pode ainda não ter chegado). */
export function chargeGroup(status: string | null | undefined, dueDate: string | null | undefined, today: string): ChargeGroup {
  const s = String(status ?? '').trim().toLowerCase()
  if (s === 'paid') return 'paid'
  if (s === 'refunded') return 'refunded'
  if (s === 'canceled' || s === 'cancelled') return 'canceled'
  if (s === 'overdue') return 'overdue'
  // pending e qualquer outro estado em aberto
  return dueDate && String(dueDate).slice(0, 10) < today ? 'overdue' : 'upcoming'
}

/** Cláusula `or()` do PostgREST (ou null) para o grupo de status pedido. */
export function statusClause(status: ChargeStatusFilter, today: string): string | null {
  switch (status) {
    case 'paid': return 'status.eq.paid'
    case 'refunded': return 'status.eq.refunded'
    case 'canceled': return 'status.eq.canceled'
    case 'overdue': return `status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`
    case 'upcoming': return `and(status.eq.pending,or(due_date.is.null,due_date.gte.${today}))`
    default: return null
  }
}

/** Limites de um dia de Brasília em instantes UTC (para filtrar `webhook_received_at`). */
export const dayStartIso = (day: string) => new Date(`${day}T00:00:00-03:00`).toISOString()
export const dayEndIso = (day: string) => new Date(`${day}T23:59:59.999-03:00`).toISOString()

export interface ChargeTotals { count: number; sum: number }
export type ChargeSummary = Record<ChargeGroup, ChargeTotals> & { truncated: boolean }

const round2 = (n: number) => Math.round(n * 100) / 100

/** Contagem e soma por grupo, sobre as linhas já filtradas (menos o filtro de status). */
export function summarizeCharges(rows: { status: string | null; due_date: string | null; amount: number | string | null }[], today: string, truncated = false): ChargeSummary {
  const out = Object.fromEntries(CHARGE_GROUPS.map(g => [g, { count: 0, sum: 0 }])) as Record<ChargeGroup, ChargeTotals>
  for (const r of rows) {
    const g = chargeGroup(r.status, r.due_date, today)
    out[g].count++
    out[g].sum += Number(r.amount) || 0
  }
  for (const g of CHARGE_GROUPS) out[g].sum = round2(out[g].sum)
  return { ...out, truncated }
}

export interface ChargeDto {
  id: string
  userId: string | null
  name: string
  email: string
  amount: number
  group: ChargeGroup
  dueDate: string | null
  /** quando foi paga (só nas pagas), AAAA-MM-DD de Brasília */
  paidOn: string | null
  createdOn: string
  method: string | null
  cycle: string | null
  invoiceUrl: string | null
  asaasPaymentId: string | null
  /** o cliente tem assinatura ativa no Asaas (dá para cancelá-la) */
  subscriptionActive: boolean
  /** há um estorno pedido pelo SuperAdmin aguardando o Asaas confirmar */
  refundRequested: boolean
}

export interface ChargesPage {
  today: string
  items: ChargeDto[]
  total: number
  page: number
  pageSize: number
  summary: ChargeSummary
}

export type ChargesErrorCode = 'forbidden' | 'unknown'
export type ChargesResult = ({ success: true } & ChargesPage) | { success: false; code: ChargesErrorCode }

/** Linha do banco -> o que a tela mostra. */
export function toChargeDto(r: any, profile: { name: string; email: string; subscriptionActive?: boolean } | undefined, today: string, refundRequested = false): ChargeDto {
  const group = chargeGroup(r.status, r.due_date, today)
  return {
    id: String(r.id),
    userId: r.user_id ?? null,
    name: profile?.name || '',
    email: profile?.email || '',
    amount: Number(r.amount) || 0,
    group,
    dueDate: r.due_date ? String(r.due_date).slice(0, 10) : null,
    paidOn: group === 'paid' && r.webhook_received_at ? dayInBrasilia(r.webhook_received_at) : null,
    createdOn: dayInBrasilia(r.created_at),
    method: r.billing_type ?? null,
    cycle: r.cycle ?? null,
    invoiceUrl: r.invoice_url ?? null,
    asaasPaymentId: r.asaas_payment_id ?? null,
    subscriptionActive: !!profile?.subscriptionActive,
    refundRequested,
  }
}
