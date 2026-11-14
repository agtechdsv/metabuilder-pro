'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { loadBillingSettings } from '@/lib/billing/billingService'
import { MAX_GRACE_DAYS, daysToDue, suspensionDate } from '../../../supabase/functions/_shared/billingCore'
import type { BillingAdminOverview, BillingErrorCode, MyBillingNotice } from '@/lib/billing/notice'

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/

/** Quem age vem da SESSÃO. Só o SuperAdmin mexe nos ajustes dos avisos. */
async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authorized')
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) throw new Error('not_authorized')
  return { admin: createAdminClient(), user }
}

export async function getBillingNoticesAdmin(): Promise<{ success: true; overview: BillingAdminOverview } | { success: false; code: BillingErrorCode }> {
  try {
    const { admin } = await requireSuperAdmin()
    const settings = await loadBillingSettings(admin)
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0
    const [queued, sent7d, failed, last] = await Promise.all([
      count(admin.from('billing_notices').select('id', { count: 'exact', head: true }).eq('status', 'queued')),
      count(admin.from('billing_notices').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', since)),
      count(admin.from('billing_notices').select('id', { count: 'exact', head: true }).eq('status', 'failed')),
      admin.from('billing_notices').select('sent_at').eq('status', 'sent').order('sent_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    return { success: true, overview: { settings, stats: { queued, sent7d, failed, lastSentAt: (last as any)?.data?.sent_at || null } } }
  } catch (e) { return { success: false, code: (e as Error).message === 'not_authorized' ? 'not_authorized' : 'unknown' } }
}

export async function saveBillingNoticesSettings(input: { enabled: boolean; graceDays: number; adminEmail: string }): Promise<{ success: true } | { success: false; code: BillingErrorCode }> {
  try {
    const { admin, user } = await requireSuperAdmin()
    const grace = Math.floor(Number(input.graceDays))
    if (!Number.isFinite(grace) || grace < 0 || grace > MAX_GRACE_DAYS) return { success: false, code: 'invalid_grace' }
    const email = (input.adminEmail || '').trim().toLowerCase()
    if (email && (email.length > 200 || !EMAIL_RE.test(email))) return { success: false, code: 'invalid_email' }
    const { error } = await admin.from('platform_settings').upsert(
      { key: 'billing_notices', value: { enabled: input.enabled === true, graceDays: grace, adminEmail: email }, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: 'key' },
    )
    if (error) return { success: false, code: 'unknown' }
    revalidatePath('/admin/platform')
    return { success: true }
  } catch (e) { return { success: false, code: (e as Error).message === 'not_authorized' ? 'not_authorized' : 'unknown' } }
}

/**
 * O aviso fixo da tela do dono (banner): fatura vencendo em até 7 dias, vencida (com a data de suspensão, se houver carência) ou cartão recusado.
 * Quem é o dono vem da sessão. Sem avisos ligados, sem fatura em aberto ou para quem não é dono: null.
 */
export async function getMyBillingNotice(): Promise<MyBillingNotice | null> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const admin = createAdminClient()
    const cfg = await loadBillingSettings(admin)
    if (!cfg.enabled) return null

    const { data: profile } = await admin.from('profiles').select('subscription_licenses, subscription_status, overdue_since').eq('id', user.id).maybeSingle()
    if (!profile || !(Number(profile.subscription_licenses) > 0) || profile.subscription_status === 'canceled') return null

    const { data: pay } = await admin.from('payments').select('amount, status, billing_type, invoice_url, asaas_payment_id, due_date')
      .eq('user_id', user.id).in('status', ['pending', 'overdue']).not('due_date', 'is', null).order('due_date', { ascending: true }).limit(1).maybeSingle()
    if (!pay) return null

    const now = new Date()
    const d = daysToDue(pay.due_date, now)
    if (!Number.isFinite(d)) return null
    const base = { dueDate: pay.due_date as string, amount: Number(pay.amount), billingType: pay.billing_type as string | null, invoiceUrl: pay.invoice_url as string | null, daysToDue: d }

    if (pay.status === 'overdue') {
      return { state: 'overdue', ...base, suspendOn: suspensionDate(profile.overdue_since, cfg.graceDays)?.toISOString() ?? null }
    }
    // cartão recusado nos últimos 10 dias e a cobrança ainda aberta
    const { data: refused } = await admin.from('billing_notices').select('id').eq('user_id', user.id).eq('kind', 'card_refused')
      .gte('created_at', new Date(now.getTime() - 10 * 86_400_000).toISOString()).limit(1).maybeSingle()
    if (refused) return { state: 'card_refused', ...base, suspendOn: null }
    if (d <= 7) return { state: 'due_soon', ...base, suspendOn: null }
    return null
  } catch { return null }
}
