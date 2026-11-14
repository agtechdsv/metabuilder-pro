import { createAdminClient } from '@/utils/supabase/server'
import { sendMailTo, sendTeamNotice } from '@/lib/security/securityMail'
import { adminBillingMail, customerBillingMail } from '@/lib/billing/billingMailText'
import {
  isCustomerKind, noticeRef, parseBillingSettings, reminderKindFor, resolveLang, suspensionDate, graceExpired,
  type BillingSettings, type NoticeKind,
} from '../../../supabase/functions/_shared/billingCore'

type Admin = ReturnType<typeof createAdminClient>

const MAX_ATTEMPTS = 3
const BATCH = 50

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://metabuilderpro.com').replace(/\/+$/, '')

/** Ajustes dos avisos (desligados por padrão). */
export async function loadBillingSettings(admin: Admin): Promise<BillingSettings> {
  const { data } = await admin.from('platform_settings').select('value').eq('key', 'billing_notices').maybeSingle()
  return parseBillingSettings(data?.value)
}

/** Coloca um aviso na fila (único por tipo e referência). Devolve true se entrou agora. */
async function queue(admin: Admin, n: { kind: NoticeKind; userId?: string | null; ref: string; payload?: Record<string, unknown> }): Promise<boolean> {
  const { data, error } = await admin.from('billing_notices')
    .upsert({ user_id: n.userId ?? null, kind: n.kind, ref: n.ref, payload: n.payload ?? {} }, { onConflict: 'kind,ref', ignoreDuplicates: true }).select('id')
  if (error) { console.error('[avisos] falha ao enfileirar:', error.message); return false }
  return (data?.length ?? 0) > 0
}

/** Lembretes por data: o que cada cobrança em aberto pede hoje (3 dias antes, no dia, 1 e 3 dias depois). Não repete (fila única). */
export async function scheduleReminders(admin: Admin, now: Date): Promise<number> {
  const { data: pays } = await admin.from('payments').select('id, user_id, amount, status, billing_type, invoice_url, asaas_payment_id, due_date')
    .in('status', ['pending', 'overdue']).not('due_date', 'is', null).not('user_id', 'is', null).limit(1000)
  const rows = pays || []
  if (!rows.length) return 0
  const { data: profiles } = await admin.from('profiles').select('id, subscription_status').in('id', Array.from(new Set(rows.map((p: any) => p.user_id))))
  const status = new Map((profiles || []).map((p: any) => [p.id as string, p.subscription_status as string]))
  let n = 0
  for (const p of rows as any[]) {
    const st = status.get(p.user_id)
    if (st === 'canceled' || st === 'blocked') continue // cancelado não recebe cobrança; suspenso já recebeu o aviso de suspensão
    const kind = reminderKindFor(p.status, p.due_date, now)
    if (!kind) continue
    if (await queue(admin, {
      kind, userId: p.user_id, ref: noticeRef([p.asaas_payment_id || p.id]),
      payload: { paymentId: p.asaas_payment_id || p.id, amount: Number(p.amount), dueDate: p.due_date, billingType: p.billing_type, invoiceUrl: p.invoice_url },
    })) n++
  }
  return n
}

/** Carência acabou: suspende (e avisa). Só quem está com atraso marcado (overdue_since) e ainda não suspenso. */
export async function suspendAfterGrace(admin: Admin, cfg: BillingSettings, now: Date): Promise<number> {
  const { data } = await admin.from('profiles').select('id, overdue_since, subscription_status').not('overdue_since', 'is', null).neq('subscription_status', 'blocked').neq('subscription_status', 'canceled').limit(500)
  let n = 0
  for (const p of (data || []) as any[]) {
    if (!graceExpired(p.overdue_since, cfg.graceDays, now)) continue
    const { error } = await admin.from('profiles').update({ subscription_status: 'blocked', is_blocked: true }).eq('id', p.id).not('overdue_since', 'is', null)
    if (error) { console.error('[avisos] falha ao suspender:', error.message); continue }
    const { data: pay } = await admin.from('payments').select('amount, due_date, asaas_payment_id, invoice_url').eq('user_id', p.id).eq('status', 'overdue').order('due_date', { ascending: true }).limit(1).maybeSingle()
    await queue(admin, { kind: 'suspended', userId: p.id, ref: noticeRef([p.id, String(p.overdue_since).slice(0, 10)]), payload: { amount: pay ? Number(pay.amount) : null, dueDate: pay?.due_date || null, invoiceUrl: pay?.invoice_url || null } })
    n++
  }
  return n
}

/** Quem cancelou a renovação e passou da data de acesso: fecha o acesso (antes, nada encerrava). Vale mesmo com os avisos desligados. */
export async function expireCanceled(admin: Admin, now: Date): Promise<number> {
  const { data } = await admin.from('profiles').update({ subscription_status: 'blocked', is_blocked: true })
    .eq('subscription_status', 'canceled').not('subscription_expires_at', 'is', null).lt('subscription_expires_at', now.toISOString()).select('id')
  return data?.length ?? 0
}

/** Avisa uma semana antes do fim do acesso de quem cancelou a renovação. */
export async function scheduleEndingSoon(admin: Admin, now: Date): Promise<number> {
  const soon = new Date(now.getTime() + 7 * 86_400_000).toISOString()
  const { data } = await admin.from('profiles').select('id, subscription_expires_at').eq('subscription_status', 'canceled')
    .gt('subscription_expires_at', now.toISOString()).lte('subscription_expires_at', soon).limit(500)
  let n = 0
  for (const p of (data || []) as any[]) {
    if (await queue(admin, { kind: 'ending_soon', userId: p.id, ref: noticeRef([p.id, String(p.subscription_expires_at).slice(0, 10)]), payload: { validUntil: p.subscription_expires_at } })) n++
  }
  return n
}

/** Resumo diário ao admin (só contagens). Um por dia. */
export async function scheduleDigest(admin: Admin, now: Date): Promise<boolean> {
  const day = now.toISOString().slice(0, 10)
  const since24 = new Date(now.getTime() - 86_400_000).toISOString()
  const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0
  const [overdue, dueSoon, suspendedToday, received24h, failedNotices] = await Promise.all([
    count(admin.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'overdue')),
    count(admin.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending').gte('due_date', day).lte('due_date', in7)),
    count(admin.from('billing_notices').select('id', { count: 'exact', head: true }).eq('kind', 'suspended').gte('created_at', day)),
    count(admin.from('billing_notices').select('id', { count: 'exact', head: true }).eq('kind', 'payment_received').gte('created_at', since24)),
    count(admin.from('billing_notices').select('id', { count: 'exact', head: true }).eq('status', 'failed')),
  ])
  return queue(admin, { kind: 'admin_digest', ref: noticeRef(['digest', day]), payload: { digest: { overdue, dueSoon, suspendedToday, received24h, failedNotices } } })
}

/** Envia a fila (até BATCH por vez). Aviso de cobrança que já foi paga nesse meio tempo não sai. Falha: tenta de novo até MAX_ATTEMPTS. */
export async function processQueue(admin: Admin, cfg: BillingSettings): Promise<{ sent: number; failed: number; skipped: number }> {
  const out = { sent: 0, failed: 0, skipped: 0 }
  if (!cfg.enabled) return out
  const { data: items } = await admin.from('billing_notices').select('*').in('status', ['queued', 'failed']).lt('attempts', MAX_ATTEMPTS).order('created_at', { ascending: true }).limit(BATCH)
  for (const it of (items || []) as any[]) {
    const mark = async (status: 'sent' | 'failed', error?: string) => {
      await admin.from('billing_notices').update({ status, attempts: it.attempts + 1, last_error: error || null, sent_at: status === 'sent' ? new Date().toISOString() : null }).eq('id', it.id)
    }
    try {
      const p = (it.payload || {}) as Record<string, any>
      if (isCustomerKind(it.kind)) {
        const { data: prof } = await admin.from('profiles').select('email, full_name, billing_language, overdue_since').eq('id', it.user_id).maybeSingle()
        if (!prof?.email) { await mark('failed', 'cliente sem e-mail'); out.failed++; continue }
        // cobrança paga ou estornada nesse meio tempo: lembrete e aviso de atraso não fazem mais sentido
        if (p.paymentId && ['invoice_created', 'reminder_3d', 'reminder_due', 'overdue_1d', 'overdue_3d'].includes(it.kind)) {
          const { data: pay } = await admin.from('payments').select('status').eq('asaas_payment_id', p.paymentId).maybeSingle()
          if (pay && (pay.status === 'paid' || pay.status === 'refunded')) { await mark('sent', 'ignorado: já pago'); out.skipped++; continue }
        }
        const mail = customerBillingMail(it.kind, resolveLang(prof.billing_language), {
          name: String(prof.full_name || '').trim() || prof.email, amount: p.amount ?? null, dueDate: p.dueDate ?? null, invoiceUrl: p.invoiceUrl ?? null, billingType: p.billingType ?? null,
          validUntil: p.validUntil ?? p.expiresAt ?? null, graceDays: cfg.graceDays, suspendOn: suspensionDate(p.overdueSince || prof.overdue_since, cfg.graceDays)?.toISOString() ?? null,
          wasSuspended: !!p.wasSuspended, appUrl: appUrl(),
        })
        if (!mail) { await mark('failed', 'tipo desconhecido'); out.failed++; continue }
        if (await sendMailTo(prof.email, mail)) { await mark('sent'); out.sent++ } else { await mark('failed', 'o SMTP recusou ou não está configurado'); out.failed++ }
      } else {
        let customerName: string | null = null, customerEmail: string | null = null
        if (p.userId) {
          const { data: prof } = await admin.from('profiles').select('email, full_name').eq('id', p.userId).maybeSingle()
          customerName = prof?.full_name || null; customerEmail = prof?.email || null
        }
        const mail = adminBillingMail(it.kind, { customerName, customerEmail, amount: p.amount ?? null, dueDate: p.dueDate ?? null, event: p.event ?? null, paymentId: p.paymentId ?? null, digest: p.digest ?? null, appUrl: appUrl() })
        if (!mail) { await mark('failed', 'tipo desconhecido'); out.failed++; continue }
        if (await sendTeamNotice(mail.subject, mail.text, mail.html, cfg.adminEmail || null)) { await mark('sent'); out.sent++ } else { await mark('failed', 'o SMTP recusou ou não está configurado'); out.failed++ }
      }
    } catch (e) {
      console.error('[avisos] erro ao enviar o aviso', it.id, (e as Error)?.message)
      await mark('failed', (e as Error)?.message || 'erro')
      out.failed++
    }
  }
  return out
}

/** Rotina diária completa. O fechamento de quem cancelou roda sempre; o resto só com os avisos ligados. */
export async function runBillingNotices(now = new Date()) {
  const admin = createAdminClient()
  const cfg = await loadBillingSettings(admin)
  const expired = await expireCanceled(admin, now)
  if (!cfg.enabled) return { enabled: false, expired }
  const reminders = await scheduleReminders(admin, now)
  const suspended = await suspendAfterGrace(admin, cfg, now)
  const ending = await scheduleEndingSoon(admin, now)
  const digest = await scheduleDigest(admin, now)
  const sent = await processQueue(admin, cfg)
  return { enabled: true, expired, reminders, suspended, ending, digest, ...sent }
}
