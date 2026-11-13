import nodemailer from 'nodemailer'
import { slotCodeMail, slotKickedMail, type KickedMailData, type MailContent, type MailLang } from './securityMailText'

/** Envia pelo mesmo SMTP do checkout. Devolve false (sem lançar) se faltar configuração ou o envio falhar. */
async function send(to: string, mail: MailContent): Promise<boolean> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !to) return false
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
    await transporter.sendMail({ from: `"MetaBuilder PRO" <${SMTP_USER}>`, to, subject: mail.subject, html: mail.html, text: mail.text })
    return true
  } catch (e) {
    console.error('[vagas] falha ao enviar e-mail de segurança:', (e as Error)?.message)
    return false
  }
}

/** Avisa o dono do login que uma sessão dele foi encerrada por um novo login. */
export const sendSlotKickedEmail = (to: string, lang: MailLang, data: KickedMailData) => send(to, slotKickedMail(lang, data))

/** Envia o código de confirmação da troca de dispositivo. */
export const sendSlotCodeEmail = (to: string, lang: MailLang, code: string, ttlMinutes: number) => send(to, slotCodeMail(lang, code, ttlMinutes))
