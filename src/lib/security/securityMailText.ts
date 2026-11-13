/**
 * Textos dos e-mails de segurança das vagas de sessão (puro, testável). O envio fica em securityMail.ts.
 * Idiomas: pt, en e es (o idioma vem do cookie app-language, como no resto do site).
 */
export type MailLang = 'pt' | 'en' | 'es'

export interface MailContent { subject: string; html: string; text: string }

export const MAIL_LANGS: MailLang[] = ['pt', 'en', 'es']

export const resolveMailLang = (v: string | null | undefined): MailLang => (v === 'en' || v === 'es' ? v : 'pt')

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TEXTS = {
  pt: {
    kickedSubject: 'Sua sessão no MetaBuilder PRO foi encerrada',
    kickedTitle: 'Sua sessão foi encerrada',
    kickedIntro: 'Você entrou no MetaBuilder PRO em outro dispositivo, e a sessão anterior foi encerrada.',
    ended: 'Sessão encerrada',
    startedAt: 'Entrou em',
    where: 'Onde',
    device: 'Dispositivo',
    when: 'Quando',
    unknown: 'não identificado',
    notYou: 'Não foi você? Troque sua senha agora e entre em contato com o suporte.',
    codeSubject: 'Seu código de confirmação do MetaBuilder PRO',
    codeTitle: 'Confirme a troca de dispositivo',
    codeIntro: 'Você pediu para encerrar outra sessão e entrar neste dispositivo. Use o código abaixo para confirmar.',
    codeValid: (m: number) => `O código vale por ${m} minutos e só funciona uma vez.`,
    codeIgnore: 'Se não foi você, ignore este e-mail e troque sua senha.',
    footer: 'MetaBuilder PRO · AG Tech',
  },
  en: {
    kickedSubject: 'Your MetaBuilder PRO session was ended',
    kickedTitle: 'Your session was ended',
    kickedIntro: 'You signed in to MetaBuilder PRO on another device, and the previous session was ended.',
    ended: 'Ended session',
    startedAt: 'Signed in at',
    where: 'Where',
    device: 'Device',
    when: 'When',
    unknown: 'unknown',
    notYou: 'Was it not you? Change your password now and contact support.',
    codeSubject: 'Your MetaBuilder PRO confirmation code',
    codeTitle: 'Confirm the device switch',
    codeIntro: 'You asked to end another session and sign in on this device. Use the code below to confirm.',
    codeValid: (m: number) => `The code is valid for ${m} minutes and works only once.`,
    codeIgnore: 'If it was not you, ignore this email and change your password.',
    footer: 'MetaBuilder PRO · AG Tech',
  },
  es: {
    kickedSubject: 'Tu sesión en MetaBuilder PRO fue cerrada',
    kickedTitle: 'Tu sesión fue cerrada',
    kickedIntro: 'Iniciaste sesión en MetaBuilder PRO en otro dispositivo y la sesión anterior fue cerrada.',
    ended: 'Sesión cerrada',
    startedAt: 'Inició en',
    where: 'Dónde',
    device: 'Dispositivo',
    when: 'Cuándo',
    unknown: 'no identificado',
    notYou: '¿No fuiste tú? Cambia tu contraseña ahora y contacta al soporte.',
    codeSubject: 'Tu código de confirmación de MetaBuilder PRO',
    codeTitle: 'Confirma el cambio de dispositivo',
    codeIntro: 'Pediste cerrar otra sesión e iniciar en este dispositivo. Usa el código de abajo para confirmar.',
    codeValid: (m: number) => `El código vale por ${m} minutos y solo funciona una vez.`,
    codeIgnore: 'Si no fuiste tú, ignora este correo y cambia tu contraseña.',
    footer: 'MetaBuilder PRO · AG Tech',
  },
} as const

const shell = (title: string, bodyHtml: string, footer: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;">
<tr><td style="padding:28px 32px;background:#4f46e5;color:#ffffff;"><div style="font-size:20px;font-weight:800;">MetaBuilder <span style="color:#c7d2fe;">PRO</span></div><div style="margin-top:6px;font-size:15px;">${esc(title)}</div></td></tr>
<tr><td style="padding:28px 32px;color:#3f3f46;font-size:15px;line-height:23px;">${bodyHtml}</td></tr>
<tr><td style="padding:16px 32px;background:#fafafa;color:#a1a1aa;font-size:12px;text-align:center;">${esc(footer)}</td></tr>
</table></body></html>`

export interface KickedMailData {
  /** a sessão que foi encerrada */
  kicked: { label?: string | null; place?: string | null; since?: string | null }
  /** de onde veio o novo login */
  by: { label?: string | null; place?: string | null }
  /** quando a troca aconteceu (ISO) */
  at: string
}

const fmtDate = (iso: string, lang: MailLang) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR'
  return d.toLocaleString(locale, { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) + ' (BRT)'
}

export function slotKickedMail(lang: MailLang, d: KickedMailData): MailContent {
  const t = TEXTS[lang]
  const place = (p?: string | null) => p || t.unknown
  const rows: [string, string][] = [
    [t.where, place(d.by.place)],
    [t.device, d.by.label || t.unknown],
    [t.when, fmtDate(d.at, lang)],
  ]
  const ended = [d.kicked.label, d.kicked.place].filter(Boolean).join(' · ') || t.unknown
  const html = shell(t.kickedTitle,
    `<p style="margin:0 0 16px 0;">${esc(t.kickedIntro)}</p>` +
    `<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e4e4e7;border-radius:12px;margin:0 0 16px 0;">` +
    rows.map(([k, v]) => `<tr><td style="padding:10px 14px;color:#71717a;width:34%;">${esc(k)}</td><td style="padding:10px 14px;font-weight:600;">${esc(v)}</td></tr>`).join('') +
    `<tr><td style="padding:10px 14px;color:#71717a;">${esc(t.ended)}</td><td style="padding:10px 14px;">${esc(ended)}</td></tr></table>` +
    `<p style="margin:0;color:#b45309;">${esc(t.notYou)}</p>`, t.footer)
  const text = [t.kickedTitle, '', t.kickedIntro, ...rows.map(([k, v]) => `${k}: ${v}`), `${t.ended}: ${ended}`, '', t.notYou].join('\n')
  return { subject: t.kickedSubject, html, text }
}

export function slotCodeMail(lang: MailLang, code: string, ttlMinutes: number): MailContent {
  const t = TEXTS[lang]
  const html = shell(t.codeTitle,
    `<p style="margin:0 0 20px 0;">${esc(t.codeIntro)}</p>` +
    `<div style="text-align:center;margin:0 0 20px 0;"><span style="display:inline-block;padding:14px 28px;border-radius:14px;background:#eef2ff;color:#3730a3;font-size:32px;font-weight:800;letter-spacing:8px;">${esc(code)}</span></div>` +
    `<p style="margin:0 0 8px 0;">${esc(t.codeValid(ttlMinutes))}</p><p style="margin:0;color:#b45309;">${esc(t.codeIgnore)}</p>`, t.footer)
  const text = [t.codeTitle, '', t.codeIntro, '', code, '', t.codeValid(ttlMinutes), t.codeIgnore].join('\n')
  return { subject: t.codeSubject, html, text }
}
