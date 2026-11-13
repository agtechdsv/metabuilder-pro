'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { clientIp, hashIp } from '@/lib/sessions/slotCore'
import { sendTeamNotice } from '@/lib/security/securityMail'
import {
  MAX_PER_IP_PER_HOUR, looksLikeBot, validateApplication,
  type ActionCode, type ActionResult, type ApplicationErrorCode, type ApplicationInput, type ApplicationRow, type ApplicationStatus,
} from '@/lib/partnerApplications'

/** Chave em platform_settings com o e-mail que recebe o aviso de candidatura (o SuperAdmin escolhe na aba Parceiros). */
const NOTIFY_KEY = 'partner_notify_email'
const EMAIL_OK = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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
    const lines = [
      ['Nome', v.name], ['E-mail', v.email], ['Telefone', v.phone || '-'], ['Empresa', v.company || '-'], ['Perfil', v.channel],
      ['Como pretende divulgar', v.audience || '-'], ['Mensagem', v.message || '-'], ['Idioma', v.lang],
    ]
    const { data: notifyRow } = await admin.from('platform_settings').select('value').eq('key', NOTIFY_KEY).maybeSingle()
    const notifyTo = typeof (notifyRow?.value as { email?: unknown } | null)?.email === 'string' ? String((notifyRow!.value as { email: string }).email) : null
    await sendTeamNotice(
      `Nova candidatura de parceiro: ${v.name}`,
      lines.map(([k, val]) => `${k}: ${val}`).join('\n') + '\n\nAprove ou recuse na aba Parceiros do painel.',
      `<p><b>Nova candidatura de parceiro</b></p><ul>${lines.map(([k, val]) => `<li><b>${esc(k)}:</b> ${esc(String(val))}</li>`).join('')}</ul><p>Aprove ou recuse na aba Parceiros do painel.</p>`,
      notifyTo,
    )
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
        message: r.message, status: r.status, partnerId: r.partner_id, createdAt: r.created_at,
      })),
    }
  } catch (e) { return { success: false, code: (e as Error).message === 'not_authorized' ? 'not_authorized' : 'unknown' } }
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
