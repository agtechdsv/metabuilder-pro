'use server'

import { createClient, createAdminClient } from '@/utils/supabase/server'
import { MIN_INCREASE_NOTICE_DAYS, type RepriceCode } from '@/lib/billing/priceChange'
import {
  cancelChange, countSubscribers, currentRules, noticeForUser, recentChanges, scheduleChange, scheduledChange, type MyPriceNotice, type PriceChangeRow,
} from '@/lib/billing/priceChangeService'

/** Só o SuperAdmin agenda e cancela reajustes. A identidade vem da sessão, nunca do corpo do pedido. */
async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  return profile?.is_super_admin ? { admin: createAdminClient(), userId: user.id } : null
}

export interface RepriceView {
  id: string; effectiveOn: string; noticeDays: number; oldBase: number; newBase: number; status: PriceChangeRow['status']; createdAt: string; notifiedAt: string | null; appliedAt: string | null
}
export interface RepriceState { currentBase: number; minNoticeDays: number; subscribers: number; scheduled: RepriceView | null; history: RepriceView[] }

const view = (c: PriceChangeRow): RepriceView => ({
  id: c.id, effectiveOn: c.effective_on, noticeDays: c.notice_days, oldBase: Number(c.old_base_price), newBase: Number(c.new_base_price), status: c.status,
  createdAt: c.created_at, notifiedAt: c.notified_at, appliedAt: c.applied_at,
})

export async function getRepriceStateAction(): Promise<{ success: true; state: RepriceState } | { success: false; code: RepriceCode }> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return { success: false, code: 'forbidden' }
  try {
    const [rules, scheduled, history, subscribers] = await Promise.all([currentRules(ctx.admin), scheduledChange(ctx.admin), recentChanges(ctx.admin, 6), countSubscribers(ctx.admin)])
    return {
      success: true,
      state: { currentBase: Number(rules?.base_price) || 0, minNoticeDays: MIN_INCREASE_NOTICE_DAYS, subscribers, scheduled: scheduled ? view(scheduled) : null, history: history.filter(h => h.status !== 'scheduled').map(view) },
    }
  } catch (e) {
    console.error('[reajuste] erro ao ler o estado:', (e as Error)?.message)
    return { success: false, code: 'unknown' }
  }
}

/** Agenda o reajuste (valor base novo e dias até valer) e avisa os assinantes por e-mail. O prazo mínimo para aumento é conferido no servidor. */
export async function scheduleRepriceAction(input: { newBase: unknown; days: unknown }): Promise<{ success: true; effectiveOn: string; notified: number; appliedNow: boolean } | { success: false; code: RepriceCode }> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return { success: false, code: 'forbidden' }
  try {
    const r = await scheduleChange(ctx.admin, { actorId: ctx.userId, newBase: input?.newBase, days: input?.days })
    return r.success ? { success: true, effectiveOn: r.change.effective_on, notified: r.notified, appliedNow: r.appliedNow } : r
  } catch (e) {
    console.error('[reajuste] erro ao agendar:', (e as Error)?.message)
    return { success: false, code: 'unknown' }
  }
}

export async function cancelRepriceAction(id: string): Promise<{ success: boolean; code?: RepriceCode }> {
  const ctx = await requireSuperAdmin()
  if (!ctx) return { success: false, code: 'forbidden' }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return { success: false, code: 'not_found' }
  try { return await cancelChange(ctx.admin, id) } catch { return { success: false, code: 'unknown' } }
}

/** O reajuste agendado que vale para o cliente logado (aviso na aba Assinatura). null se não há ou se ele não é assinante ativo. */
export async function myPriceChangeNoticeAction(): Promise<MyPriceNotice | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return await noticeForUser(createAdminClient(), user.id)
  } catch { return null }
}
