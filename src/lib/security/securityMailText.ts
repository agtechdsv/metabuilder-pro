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

/**
 * Modelo único dos e-mails do MetaBuilder PRO (mesmo visual do e-mail de redefinição de senha): faixa em degradê verde e azul com o nome,
 * cartão branco com título centralizado, corpo e rodapé. `bodyHtml` já vem escapado por quem monta.
 */
export const mailShell = (title: string, bodyHtml: string, footer: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:24px;overflow:hidden;">
<tr><td align="center" bgcolor="#10b981" style="padding:38px 32px;background:#10b981;background-image:linear-gradient(135deg,#10b981 0%,#3b82f6 100%);color:#ffffff;"><div style="font-size:30px;font-weight:800;letter-spacing:-0.5px;">MetaBuilder <span style="color:#a5f3fc;">PRO</span></div></td></tr>
<tr><td align="center" style="padding:36px 36px 28px 36px;color:#52525b;font-size:15px;line-height:23px;"><h1 style="margin:0 0 18px 0;font-size:24px;line-height:30px;color:#18181b;">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td align="center" style="padding:20px 36px;border-top:1px solid #f4f4f5;color:#a1a1aa;font-size:11px;line-height:17px;">${esc(footer)}</td></tr>
</table></body></html>`
const shell = mailShell

/** Quadro de destaque (como "Acesso de segurança" no e-mail de senha): título pequeno em verde e, abaixo, as linhas rótulo/valor. Textos escapados aqui. */
const infoBox = (label: string, rows: [string, string][]) =>
  `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0;background:#f8fafc;border-radius:16px;text-align:left;"><tr><td style="padding:18px 22px;">` +
  `<div style="margin:0 0 10px 0;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#10b981;">${esc(label)}</div>` +
  rows.map(([k, v]) => `<div style="margin:0 0 8px 0;font-size:14px;line-height:20px;"><span style="color:#71717a;">${esc(k)}:</span> <b style="color:#18181b;">${esc(v)}</b></div>`).join('') +
  `</td></tr></table>`

const button = (label: string, url: string) =>
  `<table cellpadding="0" cellspacing="0" style="margin:6px auto 4px auto;"><tr><td align="center" bgcolor="#10b981" style="border-radius:12px;"><a href="${esc(url)}" style="display:inline-block;padding:14px 30px;font-size:13px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${esc(label)}</a></td></tr></table>`

export interface PartnerApplicationMailData {
  name: string; email: string; phone?: string | null; company?: string | null; channel: string
  audience?: string | null; message?: string | null; lang: string
}

const CHANNEL_PT: Record<string, string> = {
  consulting: 'Consultoria ou software house', freelancer: 'Desenvolvedor ou freelancer', community: 'Comunidade, conteúdo ou instrutor',
  integrator: 'Integrador ou profissional de TI', other: 'Outro',
}

/** Aviso para a equipe (em português) de uma nova candidatura de parceiro. `adminUrl` é o endereço do painel. */
export function partnerApplicationMail(d: PartnerApplicationMailData, adminUrl: string): MailContent {
  const dash = (v?: string | null) => (v && v.trim() ? v : '-')
  const rows: [string, string][] = [
    ['Nome', d.name], ['E-mail', d.email], ['Telefone', dash(d.phone)], ['Empresa', dash(d.company)], ['Perfil', CHANNEL_PT[d.channel] || d.channel],
    ['Como pretende divulgar', dash(d.audience)], ['Mensagem', dash(d.message)], ['Idioma', d.lang],
  ]
  const intro = `${d.name} quer ser parceiro do MetaBuilder PRO. Confira os dados e decida na aba Parceiros do painel.`
  const subject = `Nova candidatura de parceiro: ${d.name}`.replace(/[\r\n]+/g, ' ').slice(0, 200)
  const html = mailShell('Nova candidatura de parceiro',
    `<p style="margin:0 0 22px 0;">${esc(intro)}</p>` + infoBox('Dados da candidatura', rows) + button('Abrir o painel', adminUrl),
    `© ${new Date().getFullYear()} METABUILDER PRO · Você recebeu este e-mail porque alguém enviou o formulário em /parceiros.`)
  const text = ['Nova candidatura de parceiro', '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `Painel: ${adminUrl}`].join('\n')
  return { subject, html, text }
}

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
    `<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e4e4e7;border-radius:12px;margin:0 0 16px 0;text-align:left;">` +
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
