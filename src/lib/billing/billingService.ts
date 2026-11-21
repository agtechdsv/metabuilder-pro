import { createAdminClient } from '@/utils/supabase/server'
import { siteBaseUrl } from '@/lib/siteUrl'
import { sendMailTo, sendTeamNoticeFor } from '@/lib/security/securityMail'
import { adminBillingMail, customerBillingMail } from '@/lib/billing/billingMailText'
import { adminPayoutSummaryMail, partnerPayoutPaidMail } from '@/lib/billing/payoutMailText'
import { welcomeMail } from '@/lib/billing/welcomeMailText'
import { resolveMailLang } from '@/lib/security/securityMailText'
import {
  ALWAYS_SEND_KINDS, isCustomerKind, isPayoutKind, noticeRef, parseBillingSettings, payoutIsFinal, reminderKindFor, resolveLang, suspensionDate, graceExpired,
  type BillingSettings, type NoticeKind, isCheckoutOnly, checkoutReminderStep,
} from '../../../supabase/functions/_shared/billingCore'

type Admin = ReturnType<typeof createAdminClient>

const MAX_ATTEMPTS = 3
const BATCH = 50

const appUrl = () => siteBaseUrl()

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

/**
 * Quais destes usuários são FREE que só abriram o checkout (plano grátis e nenhum pagamento pago). Eles nunca são suspensos nem recebem os avisos de
 * atraso do PRO: só o lembrete suave (checkout_reminder). O app já ignora o bloqueio de conta FREE; suspender só geraria um e-mail falso.
 */
export async function checkoutOnlyUsers(admin: Admin, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const [{ data: profs }, { data: paid }] = await Promise.all([
    admin.from('profiles').select('id, subscription_tier').in('id', ids),
    admin.from('payments').select('user_id').eq('status', 'paid').in('user_id', ids),
  ])
  const paidBy = new Map<string, number>()
  for (const r of (paid || []) as any[]) paidBy.set(r.user_id, (paidBy.get(r.user_id) || 0) + 1)
  return new Set(((profs || []) as any[]).filter(p => isCheckoutOnly(p.subscription_tier, paidBy.get(p.id) || 0)).map(p => p.id as string))
}

/** Lembretes por data: o que cada cobrança em aberto pede hoje (3 dias antes, no dia, 1 e 3 dias depois). Não repete (fila única). */
export async function scheduleReminders(admin: Admin, now: Date): Promise<number> {
  const { data: pays } = await admin.from('payments').select('id, user_id, amount, status, billing_type, invoice_url, asaas_payment_id, due_date, created_at')
    .in('status', ['pending', 'overdue']).not('due_date', 'is', null).not('user_id', 'is', null).order('created_at', { ascending: true }).limit(1000)
  const rows = pays || []
  if (!rows.length) return 0
  const { data: profiles } = await admin.from('profiles').select('id, subscription_status').in('id', Array.from(new Set(rows.map((p: any) => p.user_id))))
  const status = new Map((profiles || []).map((p: any) => [p.id as string, p.subscription_status as string]))
  const checkout = await checkoutOnlyUsers(admin, Array.from(new Set(rows.map((p: any) => p.user_id as string))))
  const firstOf = new Map<string, string>() // FREE do checkout: só a primeira cobrança conta (renovações do plano abandonado não geram lembrete de novo)
  for (const p of rows as any[]) if (checkout.has(p.user_id) && !firstOf.has(p.user_id)) firstOf.set(p.user_id, p.id)
  let n = 0
  for (const p of rows as any[]) {
    const st = status.get(p.user_id)
    if (st === 'canceled') continue // cancelado não recebe cobrança
    if (checkout.has(p.user_id)) {
      const step = firstOf.get(p.user_id) === p.id ? checkoutReminderStep(p.created_at, now) : 0
      if (!step) continue
      if (await queue(admin, {
        kind: 'checkout_reminder', userId: p.user_id, ref: noticeRef([p.asaas_payment_id || p.id, step]),
        payload: { paymentId: p.asaas_payment_id || p.id, amount: Number(p.amount), dueDate: p.due_date, billingType: p.billing_type, invoiceUrl: p.invoice_url },
      })) n++
      continue
    }
    if (st === 'blocked') continue // suspenso já recebeu o aviso de suspensão
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
  const checkout = await checkoutOnlyUsers(admin, ((data || []) as any[]).map(p => p.id as string))
  let n = 0
  for (const p of (data || []) as any[]) {
    if (checkout.has(p.id)) continue // FREE que só abriu o checkout nunca é suspenso
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

const WELCOME_WINDOW_DAYS = 7

/**
 * Boas-vindas ao cliente novo, UMA vez por usuário (a fila é única por tipo e usuário). Só para contas criadas há pouco: quem já usava a plataforma
 * antes não recebe de repente. O endereço e o idioma vêm da conta (nunca do pedido). Devolve true se entrou na fila agora.
 */
export async function queueWelcome(admin: Admin, userId: string): Promise<boolean> {
  const { data: found } = await admin.auth.admin.getUserById(userId)
  const u = found?.user
  if (!u?.email) return false
  const created = new Date(u.created_at).getTime()
  if (!Number.isFinite(created) || Date.now() - created > WELCOME_WINDOW_DAYS * 86_400_000) return false
  return queue(admin, { kind: 'welcome', userId, ref: noticeRef([userId]) })
}

/** Enfileira as boas-vindas do usuário e envia já (se o SMTP falhar, a rotina diária tenta de novo). */
export async function sendWelcomeIfNew(userId: string): Promise<void> {
  const admin = createAdminClient()
  if (await queueWelcome(admin, userId)) await processQueue(admin, await loadBillingSettings(admin))
}

/** O lote terminou (todos os itens pagos ou com falha)? Então enfileira o resumo ao admin (um por lote). Devolve true se entrou agora. */
export async function queuePayoutSummaryIfFinal(admin: Admin, payoutId: string): Promise<boolean> {
  const { data: items } = await admin.from('partner_payout_items').select('status').eq('payout_id', payoutId)
  if (!payoutIsFinal((items || []).map((i: any) => i.status))) return false
  return queue(admin, { kind: 'admin_payout_summary', ref: payoutId, payload: { payoutId } })
}

/** Aviso ao parceiro: o Pix da comissão dele foi concluído. Devolve o e-mail pronto e para quem vai, ou o motivo de não enviar. */
async function buildPartnerPayoutMail(admin: Admin, itemId: string): Promise<{ to: string; mail: ReturnType<typeof partnerPayoutPaidMail> } | { skip: string } | { error: string }> {
  const { data: item } = await admin.from('partner_payout_items').select('id, amount, pix_key, pix_key_type, status, updated_at, partner_id').eq('id', itemId).maybeSingle()
  if (!item) return { error: 'item do lote não encontrado' }
  if (item.status !== 'done') return { skip: 'ignorado: o item não está pago' }
  const { data: partner } = await admin.from('partners').select('id, user_id, email, name').eq('id', item.partner_id).maybeSingle()
  if (!partner) return { error: 'parceiro não encontrado' }
  // o endereço é sempre o do próprio parceiro: o e-mail da conta dele ou, se ainda não criou conta, o do cadastro
  const { data: prof } = partner.user_id ? await admin.from('profiles').select('email').eq('id', partner.user_id).maybeSingle() : { data: null }
  const to = String(prof?.email || partner.email || '').trim()
  if (!to) return { error: 'parceiro sem e-mail' }
  const { data: app } = await admin.from('partner_applications').select('lang').eq('partner_id', partner.id).order('decided_at', { ascending: false }).limit(1).maybeSingle()
  return {
    to,
    mail: partnerPayoutPaidMail(resolveMailLang(app?.lang), {
      name: String(partner.name || '').trim() || to, amount: Number(item.amount), paidAt: item.updated_at, type: String(item.pix_key_type || ''),
      keyMasked: `•••${String(item.pix_key || '').slice(-3)}`, panelUrl: `${appUrl()}/parceiro`,
    }),
  }
}

/** Resumo do lote ao admin: uma linha por parceiro (valor, situação e data). */
async function buildPayoutSummaryMail(admin: Admin, payoutId: string) {
  const { data: payout } = await admin.from('partner_payouts').select('id, note, created_at').eq('id', payoutId).maybeSingle()
  if (!payout) return null
  const { data: items } = await admin.from('partner_payout_items').select('partner_id, amount, status, fail_reason, pix_key, pix_key_type, updated_at').eq('payout_id', payoutId).order('created_at', { ascending: true })
  const ids = Array.from(new Set((items || []).map((i: any) => i.partner_id)))
  const { data: partners } = ids.length ? await admin.from('partners').select('id, name').in('id', ids) : { data: [] as any[] }
  const name = new Map((partners || []).map((x: any) => [x.id as string, String(x.name || '')]))
  return adminPayoutSummaryMail({
    createdAt: payout.created_at, note: payout.note, appUrl: appUrl(),
    items: (items || []).map((i: any) => ({
      partner: name.get(i.partner_id) || 'parceiro', amount: Number(i.amount), status: i.status, at: i.updated_at, failReason: i.fail_reason,
      type: i.pix_key_type, keyMasked: `•••${String(i.pix_key || '').slice(-3)}`,
    })),
  })
}

/**
 * Envia a fila (até BATCH por vez). Aviso de cobrança que já foi paga nesse meio tempo não sai. Falha: tenta de novo até MAX_ATTEMPTS.
 * Com os avisos de cobrança desligados, só os avisos de repasse a parceiros saem (são transacionais e não dependem do interruptor).
 */
export async function processQueue(admin: Admin, cfg: BillingSettings): Promise<{ sent: number; failed: number; skipped: number }> {
  const out = { sent: 0, failed: 0, skipped: 0 }
  let query = admin.from('billing_notices').select('*').in('status', ['queued', 'failed']).lt('attempts', MAX_ATTEMPTS).order('created_at', { ascending: true }).limit(BATCH)
  if (!cfg.enabled) query = query.in('kind', [...ALWAYS_SEND_KINDS])
  const { data: items } = await query
  for (const it of (items || []) as any[]) {
    const mark = async (status: 'sent' | 'failed', error?: string) => {
      await admin.from('billing_notices').update({ status, attempts: it.attempts + 1, last_error: error || null, sent_at: status === 'sent' ? new Date().toISOString() : null }).eq('id', it.id)
    }
    try {
      const p = (it.payload || {}) as Record<string, any>
      if (it.kind === 'welcome') {
        const { data: found } = await admin.auth.admin.getUserById(String(it.user_id || p.userId || ''))
        const u = found?.user
        const to = String(u?.email || '').trim()
        if (!to) { await mark('failed', 'usuário sem e-mail'); out.failed++; continue }
        const meta = (u?.user_metadata || {}) as Record<string, unknown>
        const first = String(meta.full_name || meta.name || '').trim().split(/\s+/)[0] || to
        const mail = welcomeMail(resolveMailLang(meta.lang as string | undefined), { name: first, appUrl: appUrl() })
        if (await sendMailTo(to, mail, 'welcome')) { await mark('sent'); out.sent++ } else { await mark('failed', 'o SMTP recusou ou não está configurado'); out.failed++ }
      } else if (isPayoutKind(it.kind)) {
        if (it.kind === 'partner_payout_paid') {
          const r = await buildPartnerPayoutMail(admin, String(p.itemId || it.ref))
          if ('skip' in r) { await mark('sent', r.skip); out.skipped++; continue }
          if ('error' in r) { await mark('failed', r.error); out.failed++; continue }
          if (await sendMailTo(r.to, r.mail, 'partner_mail')) { await mark('sent'); out.sent++ } else { await mark('failed', 'o SMTP recusou ou não está configurado'); out.failed++ }
        } else {
          const mail = await buildPayoutSummaryMail(admin, String(p.payoutId || it.ref))
          if (!mail) { await mark('failed', 'lote não encontrado'); out.failed++; continue }
          if (await sendTeamNoticeFor('partner_team', mail.subject, mail.text, mail.html, cfg.adminEmail || null)) { await mark('sent'); out.sent++ } else { await mark('failed', 'o SMTP recusou ou não está configurado'); out.failed++ }
        }
      } else if (isCustomerKind(it.kind)) {
        const { data: prof } = await admin.from('profiles').select('email, full_name, billing_language, overdue_since').eq('id', it.user_id).maybeSingle()
        if (!prof?.email) { await mark('failed', 'cliente sem e-mail'); out.failed++; continue }
        // FREE que só abriu o checkout não recebe aviso de atraso nem de suspensão do PRO (o webhook antigo ou uma fila antiga podem ter deixado um na fila)
        if (['reminder_3d', 'reminder_due', 'overdue_1d', 'overdue_3d', 'suspended'].includes(it.kind) && (await checkoutOnlyUsers(admin, [String(it.user_id)])).has(String(it.user_id))) {
          await mark('sent', 'ignorado: cliente FREE que ainda não pagou'); out.skipped++; continue
        }
        // cobrança paga ou estornada nesse meio tempo: lembrete e aviso de atraso não fazem mais sentido
        if (p.paymentId && ['invoice_created', 'reminder_3d', 'reminder_due', 'overdue_1d', 'overdue_3d', 'checkout_reminder'].includes(it.kind)) {
          const { data: pay } = await admin.from('payments').select('status').eq('asaas_payment_id', p.paymentId).maybeSingle()
          if (pay && (pay.status === 'paid' || pay.status === 'refunded')) { await mark('sent', 'ignorado: já pago'); out.skipped++; continue }
        }
        const mail = customerBillingMail(it.kind, resolveLang(prof.billing_language), {
          name: String(prof.full_name || '').trim() || prof.email, amount: p.amount ?? null, dueDate: p.dueDate ?? null, invoiceUrl: p.invoiceUrl ?? null, billingType: p.billingType ?? null,
          validUntil: p.validUntil ?? p.expiresAt ?? null, graceDays: cfg.graceDays, suspendOn: suspensionDate(p.overdueSince || prof.overdue_since, cfg.graceDays)?.toISOString() ?? null,
          wasSuspended: !!p.wasSuspended, appUrl: appUrl(),
        })
        if (!mail) { await mark('failed', 'tipo desconhecido'); out.failed++; continue }
        if (await sendMailTo(prof.email, mail, 'billing_customer')) { await mark('sent'); out.sent++ } else { await mark('failed', 'o SMTP recusou ou não está configurado'); out.failed++ }
      } else {
        let customerName: string | null = null, customerEmail: string | null = null
        if (p.userId) {
          const { data: prof } = await admin.from('profiles').select('email, full_name').eq('id', p.userId).maybeSingle()
          customerName = prof?.full_name || null; customerEmail = prof?.email || null
        }
        const mail = adminBillingMail(it.kind, { customerName, customerEmail, amount: p.amount ?? null, dueDate: p.dueDate ?? null, event: p.event ?? null, paymentId: p.paymentId ?? null, digest: p.digest ?? null, keyName: p.keyName ?? null, expiresAt: p.expiresAt ?? null, keyScope: p.scope ?? null, appUrl: appUrl() })
        if (!mail) { await mark('failed', 'tipo desconhecido'); out.failed++; continue }
        if (await sendTeamNoticeFor('billing_team', mail.subject, mail.text, mail.html, cfg.adminEmail || null)) { await mark('sent'); out.sent++ } else { await mark('failed', 'o SMTP recusou ou não está configurado'); out.failed++ }
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
  if (!cfg.enabled) return { enabled: false, expired, ...(await processQueue(admin, cfg)) } // avisos de repasse a parceiros saem mesmo assim
  const reminders = await scheduleReminders(admin, now)
  const suspended = await suspendAfterGrace(admin, cfg, now)
  const ending = await scheduleEndingSoon(admin, now)
  const digest = await scheduleDigest(admin, now)
  const sent = await processQueue(admin, cfg)
  return { enabled: true, expired, reminders, suspended, ending, digest, ...sent }
}
