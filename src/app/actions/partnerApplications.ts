'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { clientIp, hashIp } from '@/lib/sessions/slotCore'
import { sendMailTo, sendTeamNotice } from '@/lib/security/securityMail'
import { partnerApplicationMail, resolveMailLang } from '@/lib/security/securityMailText'
import { partnerApprovedMail, partnerRejectedMail } from '@/lib/security/partnerMailText'
import { resolvePercent } from '../../../supabase/functions/_shared/partnerCommission'
import { DEFAULT_PARTNER_SETTINGS } from '@/lib/partners'
import {
  MAX_PER_IP_PER_HOUR, looksLikeBot, validateApplication,
  type ActionCode, type ActionResult, type ApplicationErrorCode, type ApplicationInput, type ApplicationRow, type ApplicationStatus, type NoticeResult,
} from '@/lib/partnerApplications'

/** Chave em platform_settings com o e-mail que recebe o aviso de candidatura (o SuperAdmin escolhe na aba Parceiros). */
const NOTIFY_KEY = 'partner_notify_email'
const EMAIL_OK = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/

/**
 * Formulário público de candidatura a parceiro. Sem login: por isso valida tudo no servidor, barra robô (campo isca e tempo mínimo)
 * e limita por IP (só o hash do IP é guardado). Mesmo e-mail enviando de novo enquanto a candidatura está em análise não duplica,
 * e a resposta é igual, para o formulário não revelar quem já se candidatou.
 */
export async function submitPartnerApplication(input: ApplicationInput): Promise<{ success: true } | { success: false; code: ApplicationErrorCode }> {
  try {
    const bot = looksLikeBot(input, Date.now())
    if (bot === 'honeypot') return { success: true } // finge que deu certo: o robô não aprende nada
    if (bot === 'too_fast') return { success: false, code: 'too_fast' }

    const checked = validateApplication(input)
    if (!checked.ok) return { success: false, code: checked.code }
    const v = checked.value

    const h = await headers()
    const secret = process.env.DEVICE_SLOT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const ipHash = await hashIp(clientIp(n => h.get(n)), secret)
    const admin = createAdminClient()

    if (ipHash) {
      const since = new Date(Date.now() - 3600_000).toISOString()
      const { count } = await admin.from('partner_applications').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since)
      if ((count ?? 0) >= MAX_PER_IP_PER_HOUR) return { success: false, code: 'rate_limited' }
    }

    const { data: pending } = await admin.from('partner_applications').select('id').ilike('email', v.email).eq('status', 'new').limit(1).maybeSingle()
    if (pending) return { success: true }

    const { error } = await admin.from('partner_applications').insert({
      name: v.name, email: v.email, phone: v.phone, company: v.company, channel: v.channel, audience: v.audience, message: v.message,
      lang: v.lang, ip_hash: ipHash, consent_at: new Date().toISOString(),
    })
    if (error) { console.error('[parceiros] falha ao gravar candidatura:', error.message); return { success: false, code: 'unknown' } }

    // aviso para a equipe: se o e-mail falhar, a candidatura já está salva e aparece na tela do SuperAdmin
    const { data: notifyRow } = await admin.from('platform_settings').select('value').eq('key', NOTIFY_KEY).maybeSingle()
    const notifyTo = typeof (notifyRow?.value as { email?: unknown } | null)?.email === 'string' ? String((notifyRow!.value as { email: string }).email) : null
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://metabuilderpro.com').replace(/\/+$/, '')
    const mail = partnerApplicationMail(v, appUrl + '/admin/platform')
    await sendTeamNotice(mail.subject, mail.text, mail.html, notifyTo)
    return { success: true }
  } catch (e) {
    console.error('[parceiros] candidatura:', (e as Error)?.message)
    return { success: false, code: 'unknown' }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// SuperAdmin: quem age vem da sessão
// ---------------------------------------------------------------------------------------------------------------------------------

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authorized')
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) throw new Error('not_authorized')
  return createAdminClient()
}

export async function listPartnerApplications(): Promise<{ success: true; applications: ApplicationRow[] } | { success: false; code: ActionCode; error?: string }> {
  try {
    const admin = await requireSuperAdmin()
    const { data, error } = await admin.from('partner_applications').select('*').order('created_at', { ascending: false }).limit(200)
    if (error) return { success: false, code: 'unknown', error: error.message }
    return {
      success: true,
      applications: (data || []).map((r: any) => ({
        id: r.id, name: r.name, email: r.email, phone: r.phone, company: r.company, channel: r.channel, audience: r.audience,
        message: r.message, lang: r.lang || 'pt', status: r.status, partnerId: r.partner_id, createdAt: r.created_at,
      })),
    }
  } catch (e) { return { success: false, code: (e as Error).message === 'not_authorized' ? 'not_authorized' : 'unknown' } }
}

/** Quantas coisas esperam o SuperAdmin na aba Parceiros: candidaturas novas + chaves Pix enviadas por parceiros (número no rótulo da aba). */
export async function getPartnerPendingCount(): Promise<{ success: true; total: number; applications: number; pix: number } | { success: false }> {
  try {
    const admin = await requireSuperAdmin()
    const [{ count: apps }, { count: pix }] = await Promise.all([
      admin.from('partner_applications').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      admin.from('partners').select('id', { count: 'exact', head: true }).not('pix_pending_key', 'is', null),
    ])
    return { success: true, total: (apps ?? 0) + (pix ?? 0), applications: apps ?? 0, pix: pix ?? 0 }
  } catch { return { success: false } }
}

/** E-mail que recebe o aviso de candidatura nova ('' = o padrão do servidor). */
export async function getPartnerNotifyEmail(): Promise<{ success: true; email: string } | { success: false }> {
  try {
    const admin = await requireSuperAdmin()
    const { data } = await admin.from('platform_settings').select('value').eq('key', NOTIFY_KEY).maybeSingle()
    const email = (data?.value as { email?: unknown } | null)?.email
    return { success: true, email: typeof email === 'string' ? email : '' }
  } catch { return { success: false } }
}

/** Grava o e-mail do aviso. Vazio volta ao padrão (variável PARTNER_NOTIFY_EMAIL ou a caixa do SMTP). */
export async function savePartnerNotifyEmail(email: string): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin()
    const v = (email || '').trim().toLowerCase()
    if (v && (v.length > 200 || !EMAIL_OK.test(v))) return { success: false, code: 'invalid_email' }
    const { data: { user } } = await (await createClient()).auth.getUser()
    const { error } = await admin.from('platform_settings').upsert(
      { key: NOTIFY_KEY, value: { email: v }, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
      { onConflict: 'key' },
    )
    if (error) return { success: false, code: 'unknown', error: error.message }
    return { success: true }
  } catch { return { success: false, code: 'not_authorized' } }
}

/** Marca como aprovada (com o parceiro criado) ou recusada, ou volta para "nova". */
export async function decidePartnerApplication(id: string, status: ApplicationStatus, partnerId?: string | null): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin()
    if (!['new', 'approved', 'rejected'].includes(status)) return { success: false, code: 'invalid_status' }
    const { error } = await admin.from('partner_applications').update({
      status, partner_id: status === 'approved' ? (partnerId || null) : null, decided_at: status === 'new' ? null : new Date().toISOString(),
    }).eq('id', id)
    if (error) return { success: false, code: 'unknown', error: error.message }
    revalidatePath('/admin/platform')
    return { success: true }
  } catch { return { success: false, code: 'not_authorized' } }
}

const siteUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://metabuilderpro.com').replace(/\/+$/, '')

/**
 * Manda ao parceiro recém-cadastrado o e-mail de boas-vindas (código, link, condições e painel), no idioma da candidatura (ou português
 * se o cadastro não veio de uma). O endereço NUNCA vem da tela: é o e-mail da conta do parceiro ou, se ele ainda não criou conta, o e-mail
 * guardado no cadastro dele; nesse caso o e-mail inclui o passo de criar a conta. Chave Pix e documento não vão no e-mail.
 */
export async function sendPartnerWelcome(partnerId: string, applicationId?: string | null): Promise<NoticeResult> {
  try {
    const admin = await requireSuperAdmin()
    const { data: partner } = await admin.from('partners').select('id, user_id, email, name, code, commission_percent').eq('id', partnerId).maybeSingle()
    if (!partner) return { success: false, code: 'not_found' }
    const { data: profile } = partner.user_id ? await admin.from('profiles').select('email').eq('id', partner.user_id).maybeSingle() : { data: null }
    const to = String(profile?.email || partner.email || '').trim()
    if (!to) return { success: false, code: 'not_found' }
    const hasAccount = !!partner.user_id

    let lang = 'pt'
    if (applicationId) {
      const { data: app } = await admin.from('partner_applications').select('lang').eq('id', applicationId).maybeSingle()
      lang = app?.lang || 'pt'
    }

    const { data: rows } = await admin.from('platform_settings').select('key, value').in('key', ['partner_default_percent', 'partner_grace_days', 'partner_min_payout'])
    const val = (key: string, field: string, fallback: number) => {
      const n = Number(((rows || []).find((r: any) => r.key === key)?.value as Record<string, unknown> | undefined)?.[field])
      return Number.isFinite(n) ? n : fallback
    }
    const percent = resolvePercent(partner.commission_percent != null ? Number(partner.commission_percent) : null, val('partner_default_percent', 'percent', DEFAULT_PARTNER_SETTINGS.defaultPercent))
    const base = siteUrl()
    const mail = partnerApprovedMail(resolveMailLang(lang), {
      name: partner.name, email: to, code: partner.code, linkUrl: `${base}/?ref=${encodeURIComponent(partner.code)}`, panelUrl: `${base}/parceiro`,
      hasAccount, signupUrl: `${base}/login`,
      percent, graceDays: val('partner_grace_days', 'days', DEFAULT_PARTNER_SETTINGS.graceDays), minPayout: val('partner_min_payout', 'amount', DEFAULT_PARTNER_SETTINGS.minPayout),
    })
    return { success: true, mailed: await sendMailTo(to, mail) }
  } catch { return { success: false, code: 'not_authorized' } }
}

/** Recusa a candidatura e, se o SuperAdmin marcou, avisa o candidato por e-mail (no idioma dele). O endereço vem da candidatura gravada. */
export async function rejectPartnerApplication(id: string, notify: boolean): Promise<NoticeResult> {
  try {
    const admin = await requireSuperAdmin()
    const { data: app } = await admin.from('partner_applications').select('name, email, lang').eq('id', id).maybeSingle()
    if (!app) return { success: false, code: 'not_found' }
    const { error } = await admin.from('partner_applications').update({ status: 'rejected', partner_id: null, decided_at: new Date().toISOString() }).eq('id', id)
    if (error) return { success: false, code: 'unknown', error: error.message }
    revalidatePath('/admin/platform')
    if (!notify) return { success: true, mailed: false }
    return { success: true, mailed: await sendMailTo(app.email, partnerRejectedMail(resolveMailLang(app.lang), { name: app.name })) }
  } catch { return { success: false, code: 'not_authorized' } }
}

/** Apaga a candidatura (LGPD: a pessoa pode pedir a exclusão dos dados). */
export async function deletePartnerApplication(id: string): Promise<ActionResult> {
  try {
    const admin = await requireSuperAdmin()
    const { error } = await admin.from('partner_applications').delete().eq('id', id)
    if (error) return { success: false, code: 'unknown', error: error.message }
    revalidatePath('/admin/platform')
    return { success: true }
  } catch { return { success: false, code: 'not_authorized' } }
}
