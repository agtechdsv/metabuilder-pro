import nodemailer from 'nodemailer'
import { slotCodeMail, slotKickedMail, type KickedMailData, type MailContent, type MailLang } from './securityMailText'
import { routeFor } from '@/lib/email/routingServer'
import type { EmailTopic } from '@/lib/email/routing'

/**
 * Envia pelo SMTP do site. Quem envia (De) e para onde vão as respostas (Responder para) vêm do Gerenciador de e-mails (SuperAdmin), por ASSUNTO;
 * sem nada escolhido, sai da conta do SMTP como sempre. Se o servidor recusar o remetente escolhido, tenta de novo com a conta do SMTP (o aviso
 * nunca deixa de sair por causa de um alias mal configurado). Devolve false (sem lançar) se faltar configuração ou o envio falhar.
 */
async function send(to: string, mail: MailContent, topic: EmailTopic = 'default', attachments?: { filename: string; content: Buffer; contentType?: string }[]): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !to) return false
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
    const route = await routeFor(topic)
    const base = { to, subject: mail.subject, html: mail.html, text: mail.text, ...(route.replyTo ? { replyTo: route.replyTo } : {}), ...(attachments?.length ? { attachments } : {}) }
    try {
      await transporter.sendMail({ ...base, from: route.fromHeader })
    } catch (e) {
      if (route.from.toLowerCase() === SMTP_USER.toLowerCase()) throw e
      console.error(`[email] o servidor recusou o remetente ${route.from} (${topic}); enviando pela conta padrão:`, (e as Error)?.message)
      await transporter.sendMail({ ...base, from: `"MetaBuilder PRO" <${SMTP_USER}>` })
    }
    return true
  } catch (e) {
    console.error('[email] falha ao enviar:', (e as Error)?.message)
    return false
  }
}

/** Avisa o dono do login que uma sessão dele foi encerrada por um novo login. */
export const sendSlotKickedEmail = (to: string, lang: MailLang, data: KickedMailData) => send(to, slotKickedMail(lang, data), 'security')

/**
 * Aviso interno para a equipe de um ASSUNTO. Destino, em ordem: o escolhido no Gerenciador de e-mails para esse assunto, o e-mail escolhido pelo
 * SuperAdmin na tela do próprio recurso (`to`), a variável PARTNER_NOTIFY_EMAIL, ou a própria caixa do SMTP. Texto sempre escapado por quem monta.
 */
export async function sendTeamNoticeFor(topic: EmailTopic, subject: string, text: string, html: string, to?: string | null): Promise<boolean> {
  const route = await routeFor(topic)
  const dest = route.to || (to || '').trim() || process.env.PARTNER_NOTIFY_EMAIL || process.env.SMTP_USER || ''
  return send(dest, { subject: subject.replace(/[\r\n]+/g, ' ').slice(0, 200), text, html }, topic)
}

/** Aviso interno sobre parceiros (ex.: nova candidatura, chave Pix pendente). */
export function sendTeamNotice(subject: string, text: string, html: string, to?: string | null) {
  return sendTeamNoticeFor('partner_team', subject, text, html, to)
}

/** Envia um e-mail pronto (ex.: aprovação ou recusa de parceiro) ao endereço informado, pelo remetente do assunto. Devolve false se faltar configuração ou falhar. */
export const sendMailTo = (to: string, mail: MailContent, topic: EmailTopic = 'default') => send(to, mail, topic)

/** Envia a NFS-e (PDF anexo) ao cliente, pelo remetente do assunto "cobranças ao cliente". Devolve false se faltar configuração ou falhar. */
export const sendNfseEmail = (to: string, mail: MailContent, pdf: { filename: string; content: Buffer }) =>
  send(to, mail, 'billing_customer', [{ filename: pdf.filename, content: pdf.content, contentType: 'application/pdf' }])

/** Envia o código de confirmação da troca de dispositivo. */
export const sendSlotCodeEmail = (to: string, lang: MailLang, code: string, ttlMinutes: number) => send(to, slotCodeMail(lang, code, ttlMinutes), 'security')
