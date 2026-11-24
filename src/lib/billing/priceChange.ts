/**
 * Reajuste de preços AGENDADO: regras PURAS (sem banco, sem rede), usadas pelas ações do servidor, pela rotina diária, pela tela do SuperAdmin e pelos
 * testes. O SQL está em scripts/reajuste-precos.sql; a aplicação na data de vigência está na Edge Function price-change-apply.
 *
 * Regras combinadas (22/11/2026):
 *  - O reajuste vale na RENOVAÇÃO e é igual para todos: a cobrança com vencimento a partir da data de vigência já sai no valor novo; o período já pago
 *    (mensal, trimestral, semestral ou anual) nunca muda.
 *  - AUMENTO exige aviso mínimo de 30 dias; redução pode valer na hora.
 *  - Quem comprou em campanha mantém o preço promocional que viu (travado na compra) até os meses da campanha acabarem.
 */
import { campaignMonthsRemaining, chargeBreakdown, type CampaignTerms, type PricingRules } from '../../../supabase/functions/_shared/pricing'

export const MIN_INCREASE_NOTICE_DAYS = 30
export const MAX_NOTICE_DAYS = 365
/** lembrete aos assinantes antes da data de vigência */
export const VIGENCE_REMINDER_DAYS = 7
/** lembrete a quem paga trimestral, semestral ou anual, antes da renovação dele (que cai depois da vigência) */
export const RENEWAL_REMINDER_DAYS = 30
export const MAX_BASE_PRICE = 1_000_000

const DAY = 86_400_000

export type RepriceCode = 'invalid_value' | 'same_value' | 'invalid_days' | 'notice_too_short' | 'already_scheduled' | 'forbidden' | 'not_found' | 'unknown'

/** Soma dias a um dia YYYY-MM-DD (UTC, sem horário de verão). */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
}

/** Dias de `from` até `to` (YYYY-MM-DD). Negativo = `to` já passou. NaN se alguma data não valer. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${String(from).slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${String(to).slice(0, 10)}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY) : NaN
}

export type RepriceCheck =
  | { ok: true; newBase: number; days: number; increase: boolean; /** só presente (true) quando o aviso mínimo foi dispensado por não haver assinante a avisar */ noticeWaived?: boolean }
  | { ok: false; code: Extract<RepriceCode, 'invalid_value' | 'same_value' | 'invalid_days' | 'notice_too_short'> }

/**
 * Confere o pedido do SuperAdmin (valor base novo e dias até valer). Os valores vêm do navegador: nada é confiado.
 * `subscribers`: quantos assinantes seriam avisados. O aviso de 30 dias existe para proteger quem paga: com ZERO assinantes não há ninguém a proteger,
 * e o aumento pode valer na hora. Sem informar (undefined), a regra fica a estrita de sempre (30 dias).
 */
export function validateReprice(input: { currentBase: unknown; newBase: unknown; days: unknown; subscribers?: unknown }): RepriceCheck {
  const current = Number(input.currentBase)
  const raw = typeof input.newBase === 'string' ? Number(input.newBase.replace(',', '.')) : Number(input.newBase)
  if (!Number.isFinite(raw) || raw <= 0 || raw > MAX_BASE_PRICE) return { ok: false, code: 'invalid_value' }
  const newBase = Math.round(raw * 100) / 100
  if (!(newBase > 0)) return { ok: false, code: 'invalid_value' }
  // vazio, nulo ou booleano NÃO é "0 dias" (Number(null) e Number('') dariam 0): é pedido inválido
  const blank = input.days === null || input.days === undefined || typeof input.days === 'boolean' || (typeof input.days === 'string' && input.days.trim() === '')
  const d = blank ? NaN : Number(input.days)
  if (!Number.isInteger(d) || d < 0 || d > MAX_NOTICE_DAYS) return { ok: false, code: 'invalid_days' }
  if (Number.isFinite(current) && Math.round(current * 100) === Math.round(newBase * 100)) return { ok: false, code: 'same_value' }
  const increase = Number.isFinite(current) ? newBase > current : true
  if (increase && d < MIN_INCREASE_NOTICE_DAYS) {
    if (input.subscribers === 0) return { ok: true, newBase, days: d, increase, noticeWaived: true } // exatamente o número 0 (nada de vazio, nulo ou texto)
    return { ok: false, code: 'notice_too_short' }
  }
  return { ok: true, newBase, days: d, increase }
}

/** A regra completa que passa a valer: só o valor base muda; faixas de volume e descontos de ciclo seguem como estão. */
export function buildNewRules(current: { volume_tiers?: unknown; cycle_discounts?: unknown }, newBase: number): { base_price: number; volume_tiers: unknown; cycle_discounts: unknown } {
  return { base_price: newBase, volume_tiers: current.volume_tiers ?? [], cycle_discounts: current.cycle_discounts ?? {} }
}

/** A tabela de ANTES de um reajuste já registrado (só o valor base muda entre as duas). */
export function oldRulesOf(change: { rules: any; old_base_price: number | string }): PricingRules {
  return { ...(change.rules || {}), base_price: Number(change.old_base_price) } as PricingRules
}

/** Quanto o cliente paga por ciclo hoje e quanto passará a pagar (preço REGULAR do plano dele, já com o desconto de indicação; sem a campanha). */
export function noticeAmounts(a: { oldRules: PricingRules; newRules: PricingRules; licenses: number; cycle: any; referralPercent?: number }): { current: number; next: number } {
  const base = { licenses: Math.max(1, Math.floor(Number(a.licenses) || 1)), cycle: a.cycle, referralPercent: a.referralPercent || 0 }
  return {
    current: chargeBreakdown({ ...base, rules: a.oldRules }).total,
    next: chargeBreakdown({ ...base, rules: a.newRules }).total,
  }
}

/** O cliente ainda tem meses de campanha pela frente? (o aviso diz que o preço promocional dele não muda). */
export function campaignStillActive(campaign: CampaignTerms | null | undefined, monthsUsed: number): boolean {
  return !!campaign && campaignMonthsRemaining(campaign, monthsUsed) > 0
}

/** Faltam exatamente 7 dias para a vigência? (um lembrete por reajuste; a fila é única por tipo e referência). */
export function vigenceReminderDue(effectiveOn: string, today: string): boolean {
  return daysBetween(today, effectiveOn) === VIGENCE_REMINDER_DAYS
}

export const isLongCycle = (cycle: unknown): boolean => cycle === 'quarterly' || cycle === 'semiannual' || cycle === 'yearly'

/**
 * Lembrete de renovação com o valor novo: só para ciclo trimestral, semestral ou anual, exatamente 30 dias antes da renovação dele, e só se essa renovação
 * cai na data de vigência ou depois (renovação anterior ao reajuste não muda).
 */
export function renewalReminderDue(a: { cycle: unknown; renewalDay: string | null | undefined; effectiveOn: string; today: string }): boolean {
  if (!isLongCycle(a.cycle) || !a.renewalDay) return false
  if (!(daysBetween(a.effectiveOn, a.renewalDay) >= 0)) return false
  return daysBetween(a.today, a.renewalDay) === RENEWAL_REMINDER_DAYS
}

/** O reajuste em vigor para uma renovação: o mais recente (agendado ou aplicado) cuja vigência é anterior ou igual ao dia da renovação. */
export function changeForRenewal<T extends { effective_on: string; status: string }>(changes: T[], renewalDay: string): T | null {
  const ok = changes.filter(c => (c.status === 'scheduled' || c.status === 'applied') && daysBetween(c.effective_on, renewalDay) >= 0)
  ok.sort((a, b) => b.effective_on.localeCompare(a.effective_on))
  return ok[0] ?? null
}

/** Referência única de um aviso de reajuste por reajuste e cliente (e por tipo/data, quando há mais de um). */
export const priceNoticeRef = (parts: (string | number)[]): string => parts.join(':')
