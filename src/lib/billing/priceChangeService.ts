import { createAdminClient } from '@/utils/supabase/server'
import { dayInBrasilia } from '@/lib/nfse/queue'
import { loadBillingSettings, processQueue, queue } from '@/lib/billing/billingService'
import { referralPercentTotal, type CampaignTerms, type PricingRules } from '../../../supabase/functions/_shared/pricing'
import {
  addDays, buildNewRules, campaignStillActive, changeForRenewal, isLongCycle, noticeAmounts, oldRulesOf, priceNoticeRef, renewalReminderDue, validateReprice,
  vigenceReminderDue, type RepriceCode,
} from '@/lib/billing/priceChange'

/**
 * Reajuste de preços agendado (lado do site): agenda, cancela, avisa os assinantes por e-mail e manda os lembretes. A aplicação na data de vigência e o
 * recálculo no Asaas ficam na Edge Function price-change-apply (só ela tem a chave do Asaas). Regras puras em priceChange.ts.
 *
 * Quem recebe o aviso: assinantes com assinatura no Asaas que NÃO estão cancelados (ativos e suspensos por atraso: se pagarem, pagam o valor novo).
 * Quem cancelou a renovação não é cobrado e não recebe aviso; se reativar, vê o valor novo no checkout.
 */
type Admin = ReturnType<typeof createAdminClient>

const PROFILE_COLS = 'id, subscription_licenses, subscription_cycle, subscription_expires_at, subscription_status, campaign_id, campaign_percent, campaign_months, campaign_licenses, campaign_months_used, campaign_unit_price'
const CHUNK = 150
const MAX_SUBSCRIBERS = 5000

export interface PriceChangeRow {
  id: string; created_at: string; effective_on: string; notice_days: number; old_base_price: number | string; new_base_price: number | string
  rules: any; status: 'scheduled' | 'applied' | 'canceled'; notified_at: string | null; applied_at: string | null; resync_done: boolean; canceled_at: string | null
}

type Rules = PricingRules & { id?: string }

export async function currentRules(admin: Admin): Promise<Rules | null> {
  const { data } = await admin.from('pricing_rules').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data as Rules) ?? null
}

export async function scheduledChange(admin: Admin): Promise<PriceChangeRow | null> {
  const { data } = await admin.from('pricing_changes').select('*').eq('status', 'scheduled').limit(1).maybeSingle()
  return (data as PriceChangeRow) ?? null
}

export async function recentChanges(admin: Admin, n = 5): Promise<PriceChangeRow[]> {
  const { data } = await admin.from('pricing_changes').select('*').order('created_at', { ascending: false }).limit(n)
  return (data || []) as PriceChangeRow[]
}

/** Assinantes que recebem o aviso de reajuste (ver o comentário do módulo). */
async function subscribers(admin: Admin): Promise<any[]> {
  const { data } = await admin.from('profiles').select(PROFILE_COLS)
    .not('asaas_subscription_id', 'is', null).neq('subscription_status', 'canceled').gt('subscription_licenses', 0).limit(MAX_SUBSCRIBERS)
  return data || []
}

/** Quantos assinantes receberiam o aviso de um reajuste agora. */
export async function countSubscribers(admin: Admin): Promise<number> {
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    .not('asaas_subscription_id', 'is', null).neq('subscription_status', 'canceled').gt('subscription_licenses', 0)
  return count ?? 0
}

/** Desconto de indicação que vale hoje para cada um (o mesmo cálculo do iClub: ativo, ou pendente com a carência vencida, limitado pelo teto). */
async function referralPercents(admin: Admin, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!ids.length) return out
  const { data: cap } = await admin.from('platform_settings').select('value').eq('key', 'iclub_referral_cap_percent').maybeSingle()
  const capPercent = Number.isFinite(Number((cap?.value as any)?.percent)) ? Number((cap?.value as any).percent) : 30
  const byUser = new Map<string, any[]>()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await admin.from('iclub_rewards').select('user_id, reward_value, status, release_at')
      .eq('reward_type', 'percent_discount').in('status', ['active', 'pending']).in('user_id', ids.slice(i, i + CHUNK))
    for (const r of (data || []) as any[]) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r])
  }
  for (const [id, rows] of byUser) out.set(id, referralPercentTotal(rows, capPercent))
  return out
}

function campaignOf(p: any): CampaignTerms | null {
  if (!p.campaign_id || !(Number(p.campaign_months) > 0)) return null
  const unitPrice = Number(p.campaign_unit_price)
  return {
    percent: Number(p.campaign_percent) || 50, months: Number(p.campaign_months), licenses: Number(p.campaign_licenses) || Number(p.subscription_licenses) || 1,
    ...(Number.isFinite(unitPrice) && unitPrice > 0 ? { unitPrice } : {}),
  }
}

/** O que o aviso diz a este cliente: valor atual e novo do plano dele (por ciclo), o ciclo e se ele ainda tem meses de campanha. */
function noticeFor(p: any, oldRules: PricingRules, newRules: PricingRules, referralPercent: number) {
  const a = noticeAmounts({ oldRules, newRules, licenses: Number(p.subscription_licenses) || 1, cycle: p.subscription_cycle || 'monthly', referralPercent })
  return { currentAmount: a.current, newAmount: a.next, cycle: p.subscription_cycle || 'monthly', campaignActive: campaignStillActive(campaignOf(p), Number(p.campaign_months_used) || 0) }
}

/** Envia o que está na fila (até esvaziar ou até só sobrar falha, para não gastar as tentativas). Os avisos de reajuste saem mesmo com os avisos de cobrança desligados. */
export async function drainQueue(admin: Admin): Promise<void> {
  const cfg = await loadBillingSettings(admin)
  for (let i = 0; i < 20; i++) {
    const r = await processQueue(admin, cfg)
    if (r.sent + r.skipped === 0) break
  }
}

export type ScheduleResult = { success: true; change: PriceChangeRow; notified: number; appliedNow: boolean } | { success: false; code: RepriceCode }

/**
 * "0 dias" vale na hora: chama a Edge Function que aplica o que já chegou na data (a mesma que o cron diário chama), em vez de esperar a rotina das 04:30 UTC.
 * Se falhar, o reajuste continua agendado e a rotina diária aplica (nunca perde o pedido).
 */
async function applyDueChangesNow(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false
  try {
    const res = await fetch(`${url}/functions/v1/price-change-apply`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' })
    const body = await res.json().catch(() => ({}))
    return res.ok && Number(body.applied) > 0
  } catch (e) {
    console.error('[reajuste] não foi possível aplicar na hora; a rotina diária aplica:', (e as Error)?.message)
    return false
  }
}

/** Agenda o reajuste e avisa todos os assinantes por e-mail agora. O prazo mínimo (30 dias para aumento) é conferido aqui, no servidor. */
export async function scheduleChange(admin: Admin, input: { actorId: string; newBase: unknown; days: unknown }, now = new Date()): Promise<ScheduleResult> {
  const rules = await currentRules(admin)
  if (!rules) return { success: false, code: 'unknown' }
  // os assinantes a avisar vêm do banco, nunca do navegador: o aviso mínimo de 30 dias só é dispensado se não houver NENHUM
  const subs = await subscribers(admin)
  const check = validateReprice({ currentBase: rules.base_price, newBase: input.newBase, days: input.days, subscribers: subs.length })
  if (!check.ok) return { success: false, code: check.code }
  if (await scheduledChange(admin)) return { success: false, code: 'already_scheduled' }

  const effectiveOn = addDays(dayInBrasilia(now), check.days)
  const newRules = buildNewRules(rules, check.newBase)
  const { data: row, error } = await admin.from('pricing_changes').insert({
    created_by: input.actorId, effective_on: effectiveOn, notice_days: check.days, old_base_price: Number(rules.base_price), new_base_price: check.newBase, rules: newRules,
  }).select('*').single()
  if (error || !row) return { success: false, code: error?.code === '23505' ? 'already_scheduled' : 'unknown' }
  const change = row as PriceChangeRow

  // aviso a cada assinante, com o valor dele
  const refs = await referralPercents(admin, subs.map(s => s.id as string))
  let notified = 0
  for (const s of subs) {
    const n = noticeFor(s, rules, newRules as PricingRules, refs.get(s.id) || 0)
    if (await queue(admin, { kind: 'price_change', userId: s.id, ref: priceNoticeRef([change.id, s.id]), payload: { changeId: change.id, effectiveOn, ...n } })) notified++
  }
  await admin.from('pricing_changes').update({ notified_at: new Date().toISOString() }).eq('id', change.id)
  await drainQueue(admin)
  const appliedNow = check.days === 0 ? await applyDueChangesNow() : false
  return { success: true, change: { ...change, notified_at: new Date().toISOString() }, notified, appliedNow }
}

/** Cancela o reajuste agendado (os avisos que ainda estão na fila deixam de sair; quem já foi avisado continua avisado, e nada muda no preço). */
export async function cancelChange(admin: Admin, id: string): Promise<{ success: boolean; code?: RepriceCode }> {
  const { data, error } = await admin.from('pricing_changes').update({ status: 'canceled', canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'scheduled').select('id')
  if (error) return { success: false, code: 'unknown' }
  return data?.length ? { success: true } : { success: false, code: 'not_found' }
}

/**
 * Rotina diária: lembrete 7 dias antes da vigência (a todos os assinantes) e lembrete 30 dias antes da renovação de quem paga trimestral, semestral ou anual
 * (a renovação dele cai a partir da vigência). Únicos por reajuste e cliente (a fila não repete).
 */
export async function scheduleChangeReminders(admin: Admin, now = new Date()): Promise<{ reminders: number; renewals: number }> {
  const today = dayInBrasilia(now)
  const { data: all } = await admin.from('pricing_changes').select('*').in('status', ['scheduled', 'applied']).gte('effective_on', addDays(today, -400))
  const changes = (all || []) as PriceChangeRow[]
  if (!changes.length) return { reminders: 0, renewals: 0 }
  const subs = await subscribers(admin)
  const refs = await referralPercents(admin, subs.map(s => s.id as string))
  let reminders = 0, renewals = 0

  // 1) faltam 7 dias para o reajuste agendado
  const scheduled = changes.find(c => c.status === 'scheduled')
  if (scheduled && vigenceReminderDue(scheduled.effective_on, today)) {
    for (const s of subs) {
      const n = noticeFor(s, oldRulesOf(scheduled), scheduled.rules as PricingRules, refs.get(s.id) || 0)
      if (await queue(admin, { kind: 'price_change_reminder', userId: s.id, ref: priceNoticeRef([scheduled.id, s.id, '7d']), payload: { changeId: scheduled.id, effectiveOn: scheduled.effective_on, ...n } })) reminders++
    }
  }

  // 2) faltam 30 dias para a renovação (trimestral, semestral ou anual) que já vem com o valor novo
  for (const s of subs) {
    if (!isLongCycle(s.subscription_cycle) || !s.subscription_expires_at) continue
    const renewalDay = dayInBrasilia(s.subscription_expires_at)
    const ch = changeForRenewal(changes, renewalDay)
    if (!ch || !renewalReminderDue({ cycle: s.subscription_cycle, renewalDay, effectiveOn: ch.effective_on, today })) continue
    const n = noticeFor(s, oldRulesOf(ch), ch.rules as PricingRules, refs.get(s.id) || 0)
    if (await queue(admin, { kind: 'price_change_renewal', userId: s.id, ref: priceNoticeRef([ch.id, s.id, 'r', renewalDay]), payload: { changeId: ch.id, effectiveOn: ch.effective_on, dueDate: renewalDay, ...n } })) renewals++
  }
  return { reminders, renewals }
}

export interface MyPriceNotice { effectiveOn: string; currentAmount: number; newAmount: number; cycle: string; campaignActive: boolean }

/** O reajuste agendado que vale para este cliente (aviso na aba Assinatura). null se não há reajuste ou se ele não é assinante ativo. */
export async function noticeForUser(admin: Admin, userId: string, now = new Date()): Promise<MyPriceNotice | null> {
  const change = await scheduledChange(admin)
  if (!change || change.effective_on < dayInBrasilia(now)) return null
  const { data: p } = await admin.from('profiles').select(PROFILE_COLS + ', asaas_subscription_id').eq('id', userId).maybeSingle()
  if (!p || !(p as any).asaas_subscription_id || (p as any).subscription_status === 'canceled' || !(Number((p as any).subscription_licenses) > 0)) return null
  const refs = await referralPercents(admin, [userId])
  const n = noticeFor(p, oldRulesOf(change), change.rules as PricingRules, refs.get(userId) || 0)
  return { effectiveOn: change.effective_on, ...n }
}
