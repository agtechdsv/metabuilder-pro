/**
 * E-mails do programa de parceiros para o CANDIDATO (aprovação e recusa), em pt, en e es, no idioma da candidatura.
 * Usam o mesmo modelo da marca (securityMailText). Texto puro e testável; o envio fica em securityMail.ts.
 */
import { button, esc, infoBox, mailShell, type MailContent, type MailLang } from './securityMailText'

const TEXTS = {
  pt: {
    approvedSubject: 'Você agora é parceiro do MetaBuilder PRO',
    approvedTitle: 'Bem-vindo ao programa de parceiros',
    approvedIntro: (name: string) => `Olá, ${name}! Sua candidatura foi aprovada. Quem se cadastrar pelo seu link fica vinculado a você, e você ganha comissão sobre cada pagamento do cliente indicado.`,
    box: 'Seus dados de parceiro',
    code: 'Seu código', link: 'Seu link de indicação', commission: 'Comissão', commissionValue: (p: number) => `${p}% do valor pago pelo cliente`,
    grace: 'Carência', graceValue: (d: number) => `${d} dia(s) depois de cada pagamento`, min: 'Pagamento mínimo por Pix',
    login: (email: string) => `Para abrir o painel, entre no MetaBuilder PRO com o mesmo e-mail da candidatura: ${email}.`,
    pix: 'O pagamento é feito por Pix. Se você ainda não nos informou a sua chave Pix, responda a este e-mail.',
    button: 'Abrir meu painel',
    noAccount: (email: string) => `Você ainda não tem conta no MetaBuilder PRO. Crie a sua com este e-mail (${email}) e confirme o e-mail: o painel abre automaticamente quando você entrar.`,
    createButton: 'Criar minha conta',
    rejectedSubject: 'Sobre a sua candidatura ao programa de parceiros',
    rejectedTitle: 'Obrigado pelo interesse',
    rejectedBody: (name: string) => `Olá, ${name}. Analisamos a sua candidatura ao programa de parceiros do MetaBuilder PRO e, neste momento, não vamos seguir com ela.`,
    rejectedBye: 'Agradecemos o interesse. Você pode se candidatar de novo no futuro.',
    footerWhy: 'Você recebeu este e-mail por causa da sua candidatura ao programa de parceiros.',
  },
  en: {
    approvedSubject: 'You are now a MetaBuilder PRO partner',
    approvedTitle: 'Welcome to the partner program',
    approvedIntro: (name: string) => `Hello, ${name}! Your application was approved. Anyone who signs up through your link is linked to you, and you earn a commission on every payment of the referred customer.`,
    box: 'Your partner details',
    code: 'Your code', link: 'Your referral link', commission: 'Commission', commissionValue: (p: number) => `${p}% of the amount the customer paid`,
    grace: 'Waiting period', graceValue: (d: number) => `${d} day(s) after each payment`, min: 'Minimum Pix payment',
    login: (email: string) => `To open the dashboard, sign in to MetaBuilder PRO with the same e-mail as your application: ${email}.`,
    pix: 'Payment is made by Pix. If you have not given us your Pix key yet, reply to this e-mail.',
    button: 'Open my dashboard',
    noAccount: (email: string) => `You do not have a MetaBuilder PRO account yet. Create one with this e-mail (${email}) and confirm the e-mail: the dashboard opens automatically when you sign in.`,
    createButton: 'Create my account',
    rejectedSubject: 'About your partner program application',
    rejectedTitle: 'Thank you for your interest',
    rejectedBody: (name: string) => `Hello, ${name}. We reviewed your application to the MetaBuilder PRO partner program and, at this time, we will not move forward with it.`,
    rejectedBye: 'We appreciate your interest. You are welcome to apply again in the future.',
    footerWhy: 'You received this e-mail because of your application to the partner program.',
  },
  es: {
    approvedSubject: 'Ahora eres socio de MetaBuilder PRO',
    approvedTitle: 'Bienvenido al programa de socios',
    approvedIntro: (name: string) => `¡Hola, ${name}! Tu candidatura fue aprobada. Quien se registre por tu enlace queda vinculado a ti, y ganas comisión sobre cada pago del cliente referido.`,
    box: 'Tus datos de socio',
    code: 'Tu código', link: 'Tu enlace de referencia', commission: 'Comisión', commissionValue: (p: number) => `${p}% del valor pagado por el cliente`,
    grace: 'Carencia', graceValue: (d: number) => `${d} día(s) después de cada pago`, min: 'Pago mínimo por Pix',
    login: (email: string) => `Para abrir el panel, entra a MetaBuilder PRO con el mismo e-mail de tu candidatura: ${email}.`,
    pix: 'El pago se hace por Pix. Si aún no nos informaste tu clave Pix, responde a este e-mail.',
    button: 'Abrir mi panel',
    noAccount: (email: string) => `Aún no tienes cuenta en MetaBuilder PRO. Crea la tuya con este e-mail (${email}) y confirma el e-mail: el panel se abre automáticamente cuando entres.`,
    createButton: 'Crear mi cuenta',
    rejectedSubject: 'Sobre tu candidatura al programa de socios',
    rejectedTitle: 'Gracias por tu interés',
    rejectedBody: (name: string) => `Hola, ${name}. Analizamos tu candidatura al programa de socios de MetaBuilder PRO y, por ahora, no vamos a continuar con ella.`,
    rejectedBye: 'Agradecemos tu interés. Puedes volver a postularte en el futuro.',
    footerWhy: 'Recibiste este e-mail por tu candidatura al programa de socios.',
  },
} as const

export interface PartnerApprovedMailData {
  name: string
  email: string
  code: string
  linkUrl: string
  panelUrl: string
  /** o parceiro já tem conta? Se não, o e-mail traz o passo de criá-la (com este mesmo e-mail) e o botão leva ao cadastro */
  hasAccount?: boolean
  signupUrl?: string
  percent: number
  graceDays: number
  minPayout: number
}

/** Aprovação do parceiro. Não leva chave Pix nem documento (ficam só no painel). */
export function partnerApprovedMail(lang: MailLang, d: PartnerApprovedMailData): MailContent {
  const t = TEXTS[lang]
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR'
  // sempre "R$ 50,00" (o es-ES escreveria "50,00 BRL"): são reais, em qualquer idioma
  const min = `R$ ${d.minPayout.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const rows: [string, string][] = [
    [t.code, d.code], [t.link, d.linkUrl], [t.commission, t.commissionValue(d.percent)], [t.grace, t.graceValue(d.graceDays)], [t.min, min],
  ]
  const needsAccount = d.hasAccount === false
  const access = needsAccount ? t.noAccount(d.email) : t.login(d.email)
  const label = needsAccount ? t.createButton : t.button
  const url = needsAccount ? (d.signupUrl || d.panelUrl) : d.panelUrl
  const html = mailShell(t.approvedTitle,
    `<p style="margin:0 0 22px 0;">${esc(t.approvedIntro(d.name))}</p>` + infoBox(t.box, rows) +
    `<p style="margin:0 0 14px 0;">${esc(access)}</p><p style="margin:0 0 18px 0;">${esc(t.pix)}</p>` + button(label, url),
    `© ${new Date().getFullYear()} METABUILDER PRO · ${t.footerWhy}`)
  const text = [t.approvedTitle, '', t.approvedIntro(d.name), '', ...rows.map(([k, v]) => `${k}: ${v}`), '', access, t.pix, '', `${label}: ${url}`].join('\n')
  return { subject: t.approvedSubject, html, text }
}

/** Recusa curta e educada (só enviada se o SuperAdmin marcar a caixa). */
export function partnerRejectedMail(lang: MailLang, d: { name: string }): MailContent {
  const t = TEXTS[lang]
  const html = mailShell(t.rejectedTitle,
    `<p style="margin:0 0 16px 0;">${esc(t.rejectedBody(d.name))}</p><p style="margin:0 0 6px 0;">${esc(t.rejectedBye)}</p>`,
    `© ${new Date().getFullYear()} METABUILDER PRO · ${t.footerWhy}`)
  const text = [t.rejectedTitle, '', t.rejectedBody(d.name), t.rejectedBye].join('\n')
  return { subject: t.rejectedSubject, html, text }
}

/** Aviso para a equipe (em português): um parceiro enviou a chave Pix e ela espera conferência. A chave vai mascarada; o valor inteiro está no painel. */
export function partnerPixPendingMail(d: { partnerName: string; partnerEmail: string; type: string; keyMasked: string }, adminUrl: string): MailContent {
  const rows: [string, string][] = [['Parceiro', d.partnerName], ['E-mail', d.partnerEmail], ['Tipo da chave', d.type], ['Chave (final)', d.keyMasked]]
  const intro = `${d.partnerName} enviou a chave Pix para receber os pagamentos. Confira os dados e aceite ou recuse na aba Parceiros do painel. Enquanto não aceitar, a chave não é usada em nenhum lote.`
  const html = mailShell('Chave Pix para conferir',
    `<p style="margin:0 0 22px 0;">${esc(intro)}</p>` + infoBox('Pedido do parceiro', rows) + button('Abrir o painel', adminUrl),
    `© ${new Date().getFullYear()} METABUILDER PRO · Você recebeu este e-mail porque um parceiro enviou uma chave Pix.`)
  const text = ['Chave Pix para conferir', '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `Painel: ${adminUrl}`].join('\n')
  return { subject: `Chave Pix para conferir: ${d.partnerName}`.replace(/[\r\n]+/g, ' ').slice(0, 200), html, text }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Chave Pix aceita ou recusada pelo SuperAdmin: e-mail ao PARCEIRO, no idioma da candidatura (ou português)
// ---------------------------------------------------------------------------------------------------------------------------------

const PIX_TEXTS = {
  pt: {
    acceptedSubject: 'Sua chave Pix foi aceita',
    acceptedTitle: 'Chave Pix aceita',
    acceptedIntro: (name: string) => `Olá, ${name}! Conferimos a sua chave Pix e ela foi aceita. A partir de agora, os pagamentos das suas comissões serão enviados para ela.`,
    box: 'Sua chave Pix', type: 'Tipo', key: 'Chave (final)',
    declinedSubject: 'Sua chave Pix não foi aceita',
    declinedTitle: 'Chave Pix não aceita',
    declinedIntro: (name: string) => `Olá, ${name}. Não conseguimos aceitar a chave Pix que você enviou. Confira os dados (tipo da chave, a chave e o CPF ou CNPJ do titular) e envie de novo pelo seu painel.`,
    declinedKeep: 'Se você já tinha uma chave ativa, ela continua valendo.',
    button: 'Abrir meu painel',
    footerWhy: 'Você recebeu este e-mail por causa da chave Pix enviada no painel do parceiro.',
  },
  en: {
    acceptedSubject: 'Your Pix key was accepted',
    acceptedTitle: 'Pix key accepted',
    acceptedIntro: (name: string) => `Hello, ${name}! We checked your Pix key and it was accepted. From now on, your commission payments will be sent to it.`,
    box: 'Your Pix key', type: 'Type', key: 'Key (last characters)',
    declinedSubject: 'Your Pix key was not accepted',
    declinedTitle: 'Pix key not accepted',
    declinedIntro: (name: string) => `Hello, ${name}. We could not accept the Pix key you sent. Check the data (key type, the key and the holder's CPF or CNPJ) and send it again from your dashboard.`,
    declinedKeep: 'If you already had an active key, it stays valid.',
    button: 'Open my dashboard',
    footerWhy: 'You received this e-mail because of the Pix key sent in the partner dashboard.',
  },
  es: {
    acceptedSubject: 'Tu clave Pix fue aceptada',
    acceptedTitle: 'Clave Pix aceptada',
    acceptedIntro: (name: string) => `¡Hola, ${name}! Verificamos tu clave Pix y fue aceptada. A partir de ahora, los pagos de tus comisiones se enviarán a ella.`,
    box: 'Tu clave Pix', type: 'Tipo', key: 'Clave (final)',
    declinedSubject: 'Tu clave Pix no fue aceptada',
    declinedTitle: 'Clave Pix no aceptada',
    declinedIntro: (name: string) => `Hola, ${name}. No pudimos aceptar la clave Pix que enviaste. Revisa los datos (tipo de clave, la clave y el CPF o CNPJ del titular) y envíala de nuevo desde tu panel.`,
    declinedKeep: 'Si ya tenías una clave activa, sigue vigente.',
    button: 'Abrir mi panel',
    footerWhy: 'Recibiste este e-mail por la clave Pix enviada en el panel del socio.',
  },
} as const

/** Chave aceita. Mostra só o final da chave (nunca a chave inteira por e-mail). */
export function partnerPixAcceptedMail(lang: MailLang, d: { name: string; type: string; keyMasked: string; panelUrl: string }): MailContent {
  const t = PIX_TEXTS[lang]
  const rows: [string, string][] = [[t.type, d.type], [t.key, d.keyMasked]]
  const html = mailShell(t.acceptedTitle,
    `<p style="margin:0 0 22px 0;">${esc(t.acceptedIntro(d.name))}</p>` + infoBox(t.box, rows) + button(t.button, d.panelUrl),
    `© ${new Date().getFullYear()} METABUILDER PRO · ${t.footerWhy}`)
  const text = [t.acceptedTitle, '', t.acceptedIntro(d.name), '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `${t.button}: ${d.panelUrl}`].join('\n')
  return { subject: t.acceptedSubject, html, text }
}

/** Chave recusada: pede para conferir e reenviar, e avisa que a chave anterior (se houver) continua valendo. */
export function partnerPixDeclinedMail(lang: MailLang, d: { name: string; panelUrl: string }): MailContent {
  const t = PIX_TEXTS[lang]
  const html = mailShell(t.declinedTitle,
    `<p style="margin:0 0 14px 0;">${esc(t.declinedIntro(d.name))}</p><p style="margin:0 0 18px 0;">${esc(t.declinedKeep)}</p>` + button(t.button, d.panelUrl),
    `© ${new Date().getFullYear()} METABUILDER PRO · ${t.footerWhy}`)
  const text = [t.declinedTitle, '', t.declinedIntro(d.name), t.declinedKeep, '', `${t.button}: ${d.panelUrl}`].join('\n')
  return { subject: t.declinedSubject, html, text }
}
