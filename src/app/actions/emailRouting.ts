'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/utils/supabase/server'
import { sendMailTo } from '@/lib/security/securityMail'
import { forgetEmailRouting, loadEmailRouting } from '@/lib/email/routingServer'
import { cleanAddress, domainOf, isEmailTopic, isTeamTopic, resolveRoute, validateRouting, KNOWN_ALIASES, type EmailRouting, type EmailTopic, type RoutingError } from '@/lib/email/routing'

/** Ações do Gerenciador de e-mails (aba Sistema). Só o SuperAdmin; quem age vem da SESSÃO. */

export type EmailRoutingErrorCode = 'not_authorized' | 'invalid_from' | 'foreign_domain' | 'invalid_reply_to' | 'invalid_to' | 'invalid_test' | 'no_smtp' | 'send_failed' | 'unknown'
type Fail = { success: false; code: EmailRoutingErrorCode; topic?: EmailTopic }

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not_authorized')
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) throw new Error('not_authorized')
  return { admin: createAdminClient(), user }
}

const smtpUser = () => (process.env.SMTP_USER || '').trim().toLowerCase()
const failOf = (e: unknown): Fail => ({ success: false, code: (e as Error)?.message === 'not_authorized' ? 'not_authorized' : 'unknown' })

export interface EmailRoutingOverview {
  routing: EmailRouting
  /** domínio da conta do SMTP (os remetentes precisam ser dele) */
  domain: string
  /** conta do SMTP, usada quando nada foi escolhido */
  defaultFrom: string
  /** aliases sugeridos (já com o domínio) */
  aliases: string[]
  /** e-mail do SuperAdmin logado, sugerido para os testes */
  userEmail: string
  smtpConfigured: boolean
}

export async function getEmailRoutingAdmin(): Promise<{ success: true; overview: EmailRoutingOverview } | Fail> {
  try {
    const { user } = await requireSuperAdmin()
    const defaultFrom = smtpUser()
    const domain = domainOf(defaultFrom)
    return {
      success: true,
      overview: {
        routing: await loadEmailRouting(true), domain, defaultFrom,
        aliases: domain ? KNOWN_ALIASES.map(a => `${a}@${domain}`) : [],
        userEmail: user.email || '',
        smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      },
    }
  } catch (e) { return failOf(e) }
}

const toFail = (error: RoutingError): Fail => ({ success: false, code: error.code, topic: error.topic })

export async function saveEmailRouting(input: EmailRouting): Promise<{ success: true } | Fail> {
  try {
    const { admin, user } = await requireSuperAdmin()
    const checked = validateRouting(input, domainOf(smtpUser()))
    if (!checked.ok) return toFail(checked.error)
    const { error } = await admin.from('platform_settings').upsert(
      { key: 'email_routing', value: { topics: checked.routing }, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: 'key' },
    )
    if (error) return { success: false, code: 'unknown' }
    forgetEmailRouting()
    revalidatePath('/admin/platform')
    return { success: true }
  } catch (e) { return failOf(e) }
}

/**
 * Manda um e-mail de TESTE de um assunto para o endereço informado (o do próprio SuperAdmin, em geral), com o remetente e o "Responder para" que
 * estão salvos. Devolve de qual endereço saiu, para a tela mostrar. Só texto fixo: nada vem do pedido além do destino e do assunto.
 */
export async function sendEmailRoutingTest(topic: string, recipient: string): Promise<{ success: true; from: string; replyTo?: string } | Fail> {
  try {
    await requireSuperAdmin()
    if (!isEmailTopic(topic)) return { success: false, code: 'unknown' }
    const to = cleanAddress(recipient)
    if (!to) return { success: false, code: 'invalid_test' }
    if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) return { success: false, code: 'no_smtp' }
    const route = resolveRoute(await loadEmailRouting(true), topic, smtpUser())
    const subject = `Teste do Gerenciador de e-mails (${topic})`
    const text = `Este é um e-mail de teste do MetaBuilder PRO para o assunto "${topic}".\nRemetente: ${route.from}\n${route.replyTo ? `Responder para: ${route.replyTo}\n` : ''}${isTeamTopic(topic) && route.to ? `Destino configurado para a equipe: ${route.to}\n` : ''}\nSe você recebeu isto, o envio funciona. Confira, em "Mostrar original", se De, SPF, DKIM e DMARC estão corretos.`
    const html = `<p>Este é um e-mail de teste do MetaBuilder PRO para o assunto <b>${topic}</b>.</p><p>Remetente: <b>${route.from}</b>${route.replyTo ? `<br/>Responder para: <b>${route.replyTo}</b>` : ''}</p><p>Se você recebeu isto, o envio funciona.</p>`
    const ok = await sendMailTo(to, { subject, text, html }, topic)
    return ok ? { success: true, from: route.from, ...(route.replyTo ? { replyTo: route.replyTo } : {}) } : { success: false, code: 'send_failed' }
  } catch (e) { return failOf(e) }
}
