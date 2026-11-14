/**
 * E-mails de cobrança do MetaBuilder PRO (no modelo da marca): avisos ao CLIENTE em pt, en e es, e alertas ao ADMIN em português.
 * Texto puro e testável; o envio e a fila ficam em billingService.ts. Textos de quem escreve (nome) sempre escapados.
 */
import { button, esc, infoBox, mailShell, type MailContent, type MailLang } from '../security/securityMailText'

export interface BillingMailData {
  name: string
  amount?: number | null
  /** vencimento, YYYY-MM-DD */
  dueDate?: string | null
  invoiceUrl?: string | null
  billingType?: string | null
  /** acesso/renovação até (ISO) */
  validUntil?: string | null
  /** dia em que a conta será suspensa se nada for pago (ISO) */
  suspendOn?: string | null
  graceDays?: number
  wasSuspended?: boolean
  /** endereço do site (sem barra no fim) */
  appUrl: string
}

const LOCALE: Record<MailLang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }
const money = (n: number | null | undefined, lang: MailLang) => `R$ ${(Number(n) || 0).toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const day = (iso: string | null | undefined, lang: MailLang) => {
  if (!iso) return '-'
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00Z') : new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString(LOCALE[lang], { timeZone: 'UTC' })
}

type Fn = (d: BillingMailData, lang: MailLang) => string
interface Text { subject: string; title: string; intro: Fn; button?: string; note?: Fn }

const suspendLine = {
  pt: (d: BillingMailData, l: MailLang) => (d.suspendOn && (d.graceDays ?? 0) > 0 ? `Para manter o acesso, pague até ${day(d.suspendOn, l)}: depois dessa data a conta será suspensa.` : 'O acesso pode ser suspenso a qualquer momento.'),
  en: (d: BillingMailData, l: MailLang) => (d.suspendOn && (d.graceDays ?? 0) > 0 ? `To keep your access, pay by ${day(d.suspendOn, l)}: after that date the account will be suspended.` : 'Access may be suspended at any time.'),
  es: (d: BillingMailData, l: MailLang) => (d.suspendOn && (d.graceDays ?? 0) > 0 ? `Para mantener el acceso, pague hasta el ${day(d.suspendOn, l)}: después de esa fecha la cuenta será suspendida.` : 'El acceso puede ser suspendido en cualquier momento.'),
}

const TEXTS: Record<MailLang, Record<string, Text>> = {
  pt: {
    invoice_created: { subject: 'Sua fatura do MetaBuilder PRO está pronta', title: 'Sua fatura está pronta', intro: (d, l) => `Olá, ${d.name}! A fatura da sua assinatura já está disponível. Pague até ${day(d.dueDate, l)} para manter tudo funcionando.`, button: 'Ver fatura' },
    reminder_3d: { subject: 'Sua fatura do MetaBuilder PRO vence em breve', title: 'Sua fatura vence em breve', intro: (d, l) => `Olá, ${d.name}! A fatura de ${money(d.amount, l)} vence em ${day(d.dueDate, l)}. Pague até lá para não perder o acesso.`, button: 'Pagar agora' },
    reminder_due: { subject: 'Sua fatura do MetaBuilder PRO vence hoje', title: 'Sua fatura vence hoje', intro: (d, l) => `Olá, ${d.name}! A fatura de ${money(d.amount, l)} vence hoje (${day(d.dueDate, l)}). Pague hoje para manter o acesso.`, button: 'Pagar agora' },
    overdue_1d: { subject: 'Sua fatura do MetaBuilder PRO está vencida', title: 'Sua fatura está vencida', intro: (d, l) => `Olá, ${d.name}. A fatura de ${money(d.amount, l)}, vencida em ${day(d.dueDate, l)}, ainda não foi paga.`, note: (d, l) => suspendLine.pt(d, l), button: 'Pagar agora' },
    overdue_3d: { subject: 'Último aviso: sua conta será suspensa', title: 'Último aviso antes da suspensão', intro: (d, l) => `Olá, ${d.name}. A fatura de ${money(d.amount, l)}, vencida em ${day(d.dueDate, l)}, continua em aberto.`, note: (d, l) => suspendLine.pt(d, l), button: 'Pagar agora' },
    suspended: { subject: 'Sua conta do MetaBuilder PRO foi suspensa', title: 'Sua conta foi suspensa', intro: (d, l) => `Olá, ${d.name}. Suspendemos o acesso por falta de pagamento da fatura de ${money(d.amount, l)} (vencida em ${day(d.dueDate, l)}). Assim que o pagamento for confirmado, o acesso volta automaticamente.`, button: 'Regularizar agora' },
    payment_received: { subject: 'Recebemos o seu pagamento', title: 'Pagamento recebido', intro: (d, l) => `Olá, ${d.name}! Recebemos o seu pagamento de ${money(d.amount, l)}. Obrigado!${d.wasSuspended ? ' O seu acesso foi restabelecido.' : ''}`, button: 'Abrir meu painel' },
    card_refused: { subject: 'Não conseguimos cobrar o seu cartão', title: 'Cobrança no cartão recusada', intro: (d, l) => `Olá, ${d.name}. A cobrança de ${money(d.amount, l)} no seu cartão foi recusada. Atualize o cartão ou pague de outra forma para não perder o acesso.`, button: 'Atualizar pagamento' },
    refunded: { subject: 'Seu pagamento foi estornado', title: 'Pagamento estornado', intro: (d, l) => `Olá, ${d.name}. O pagamento de ${money(d.amount, l)} foi estornado. Se você não pediu isso, fale com a gente.` },
    canceled: { subject: 'A renovação da sua assinatura foi cancelada', title: 'Renovação cancelada', intro: (d, l) => `Olá, ${d.name}. Cancelamos a renovação automática da sua assinatura. Seu acesso continua até ${day(d.validUntil, l)}. Você pode reativar quando quiser.`, button: 'Reativar assinatura' },
    ending_soon: { subject: 'Seu acesso ao MetaBuilder PRO termina em breve', title: 'Seu acesso termina em breve', intro: (d, l) => `Olá, ${d.name}. Seu acesso termina em ${day(d.validUntil, l)}. Para continuar, reative a assinatura.`, button: 'Reativar assinatura' },
  },
  en: {
    invoice_created: { subject: 'Your MetaBuilder PRO invoice is ready', title: 'Your invoice is ready', intro: (d, l) => `Hello, ${d.name}! The invoice for your subscription is available. Pay by ${day(d.dueDate, l)} to keep everything running.`, button: 'View invoice' },
    reminder_3d: { subject: 'Your MetaBuilder PRO invoice is due soon', title: 'Your invoice is due soon', intro: (d, l) => `Hello, ${d.name}! The invoice of ${money(d.amount, l)} is due on ${day(d.dueDate, l)}. Pay by then so you do not lose access.`, button: 'Pay now' },
    reminder_due: { subject: 'Your MetaBuilder PRO invoice is due today', title: 'Your invoice is due today', intro: (d, l) => `Hello, ${d.name}! The invoice of ${money(d.amount, l)} is due today (${day(d.dueDate, l)}). Pay today to keep your access.`, button: 'Pay now' },
    overdue_1d: { subject: 'Your MetaBuilder PRO invoice is overdue', title: 'Your invoice is overdue', intro: (d, l) => `Hello, ${d.name}. The invoice of ${money(d.amount, l)}, due on ${day(d.dueDate, l)}, has not been paid yet.`, note: (d, l) => suspendLine.en(d, l), button: 'Pay now' },
    overdue_3d: { subject: 'Final notice: your account will be suspended', title: 'Final notice before suspension', intro: (d, l) => `Hello, ${d.name}. The invoice of ${money(d.amount, l)}, due on ${day(d.dueDate, l)}, is still open.`, note: (d, l) => suspendLine.en(d, l), button: 'Pay now' },
    suspended: { subject: 'Your MetaBuilder PRO account was suspended', title: 'Your account was suspended', intro: (d, l) => `Hello, ${d.name}. We suspended access because the invoice of ${money(d.amount, l)} (due on ${day(d.dueDate, l)}) was not paid. As soon as the payment is confirmed, access returns automatically.`, button: 'Fix it now' },
    payment_received: { subject: 'We received your payment', title: 'Payment received', intro: (d, l) => `Hello, ${d.name}! We received your payment of ${money(d.amount, l)}. Thank you!${d.wasSuspended ? ' Your access has been restored.' : ''}`, button: 'Open my dashboard' },
    card_refused: { subject: 'We could not charge your card', title: 'Card charge declined', intro: (d, l) => `Hello, ${d.name}. The charge of ${money(d.amount, l)} on your card was declined. Update your card or pay another way so you do not lose access.`, button: 'Update payment' },
    refunded: { subject: 'Your payment was refunded', title: 'Payment refunded', intro: (d, l) => `Hello, ${d.name}. The payment of ${money(d.amount, l)} was refunded. If you did not ask for this, contact us.` },
    canceled: { subject: 'Your subscription renewal was canceled', title: 'Renewal canceled', intro: (d, l) => `Hello, ${d.name}. We canceled the automatic renewal of your subscription. Your access continues until ${day(d.validUntil, l)}. You can reactivate whenever you want.`, button: 'Reactivate subscription' },
    ending_soon: { subject: 'Your MetaBuilder PRO access ends soon', title: 'Your access ends soon', intro: (d, l) => `Hello, ${d.name}. Your access ends on ${day(d.validUntil, l)}. To continue, reactivate your subscription.`, button: 'Reactivate subscription' },
  },
  es: {
    invoice_created: { subject: 'Su factura de MetaBuilder PRO está lista', title: 'Su factura está lista', intro: (d, l) => `¡Hola, ${d.name}! La factura de su suscripción ya está disponible. Pague hasta el ${day(d.dueDate, l)} para mantener todo funcionando.`, button: 'Ver factura' },
    reminder_3d: { subject: 'Su factura de MetaBuilder PRO vence pronto', title: 'Su factura vence pronto', intro: (d, l) => `¡Hola, ${d.name}! La factura de ${money(d.amount, l)} vence el ${day(d.dueDate, l)}. Pague hasta entonces para no perder el acceso.`, button: 'Pagar ahora' },
    reminder_due: { subject: 'Su factura de MetaBuilder PRO vence hoy', title: 'Su factura vence hoy', intro: (d, l) => `¡Hola, ${d.name}! La factura de ${money(d.amount, l)} vence hoy (${day(d.dueDate, l)}). Pague hoy para mantener el acceso.`, button: 'Pagar ahora' },
    overdue_1d: { subject: 'Su factura de MetaBuilder PRO está vencida', title: 'Su factura está vencida', intro: (d, l) => `Hola, ${d.name}. La factura de ${money(d.amount, l)}, vencida el ${day(d.dueDate, l)}, aún no fue pagada.`, note: (d, l) => suspendLine.es(d, l), button: 'Pagar ahora' },
    overdue_3d: { subject: 'Último aviso: su cuenta será suspendida', title: 'Último aviso antes de la suspensión', intro: (d, l) => `Hola, ${d.name}. La factura de ${money(d.amount, l)}, vencida el ${day(d.dueDate, l)}, sigue abierta.`, note: (d, l) => suspendLine.es(d, l), button: 'Pagar ahora' },
    suspended: { subject: 'Su cuenta de MetaBuilder PRO fue suspendida', title: 'Su cuenta fue suspendida', intro: (d, l) => `Hola, ${d.name}. Suspendimos el acceso por falta de pago de la factura de ${money(d.amount, l)} (vencida el ${day(d.dueDate, l)}). Apenas se confirme el pago, el acceso vuelve automáticamente.`, button: 'Regularizar ahora' },
    payment_received: { subject: 'Recibimos su pago', title: 'Pago recibido', intro: (d, l) => `¡Hola, ${d.name}! Recibimos su pago de ${money(d.amount, l)}. ¡Gracias!${d.wasSuspended ? ' Su acceso fue restablecido.' : ''}`, button: 'Abrir mi panel' },
    card_refused: { subject: 'No pudimos cobrar su tarjeta', title: 'Cobro en la tarjeta rechazado', intro: (d, l) => `Hola, ${d.name}. El cobro de ${money(d.amount, l)} en su tarjeta fue rechazado. Actualice la tarjeta o pague de otra forma para no perder el acceso.`, button: 'Actualizar pago' },
    refunded: { subject: 'Su pago fue reembolsado', title: 'Pago reembolsado', intro: (d, l) => `Hola, ${d.name}. El pago de ${money(d.amount, l)} fue reembolsado. Si usted no lo pidió, contáctenos.` },
    canceled: { subject: 'La renovación de su suscripción fue cancelada', title: 'Renovación cancelada', intro: (d, l) => `Hola, ${d.name}. Cancelamos la renovación automática de su suscripción. Su acceso continúa hasta el ${day(d.validUntil, l)}. Puede reactivarla cuando quiera.`, button: 'Reactivar suscripción' },
    ending_soon: { subject: 'Su acceso a MetaBuilder PRO termina pronto', title: 'Su acceso termina pronto', intro: (d, l) => `Hola, ${d.name}. Su acceso termina el ${day(d.validUntil, l)}. Para continuar, reactive la suscripción.`, button: 'Reactivar suscripción' },
  },
}

const LABELS = {
  pt: { box: 'Detalhes', amount: 'Valor', due: 'Vencimento', method: 'Forma de pagamento', until: 'Válido até', why: 'Você recebeu este e-mail por causa da sua assinatura do MetaBuilder PRO.' },
  en: { box: 'Details', amount: 'Amount', due: 'Due date', method: 'Payment method', until: 'Valid until', why: 'You received this e-mail because of your MetaBuilder PRO subscription.' },
  es: { box: 'Detalles', amount: 'Valor', due: 'Vencimiento', method: 'Forma de pago', until: 'Válido hasta', why: 'Recibió este e-mail por su suscripción a MetaBuilder PRO.' },
} as const

const METHOD = { PIX: 'Pix', BOLETO: { pt: 'Boleto', en: 'Bank slip', es: 'Boleto' }, CREDIT_CARD: { pt: 'Cartão de crédito', en: 'Credit card', es: 'Tarjeta de crédito' } } as const
const methodName = (t: string | null | undefined, lang: MailLang) => (t === 'PIX' ? 'Pix' : t === 'BOLETO' ? METHOD.BOLETO[lang] : t === 'CREDIT_CARD' ? METHOD.CREDIT_CARD[lang] : '')

/** Tipos de aviso ao cliente que este módulo sabe montar. */
export const BILLING_CUSTOMER_KINDS = Object.keys(TEXTS.pt)

/** Monta o e-mail de um aviso ao cliente (null se o tipo for desconhecido). O botão leva à fatura, se houver, ou ao painel do cliente. */
export function customerBillingMail(kind: string, lang: MailLang, d: BillingMailData): MailContent | null {
  const t = TEXTS[lang]?.[kind]
  if (!t) return null
  const L = LABELS[lang]
  const rows: [string, string][] = []
  if (d.amount != null) rows.push([L.amount, money(d.amount, lang)])
  if (d.dueDate) rows.push([L.due, day(d.dueDate, lang)])
  const m = methodName(d.billingType, lang)
  if (m) rows.push([L.method, m])
  if (kind === 'payment_received' && d.validUntil) rows.push([L.until, day(d.validUntil, lang)])
  const dashboard = `${d.appUrl}/client/dashboard`
  const url = kind === 'payment_received' || kind === 'canceled' || kind === 'ending_soon' || kind === 'suspended' || kind === 'card_refused' ? dashboard : (d.invoiceUrl || dashboard)
  const note = t.note ? t.note(d, lang) : ''
  const html = mailShell(t.title,
    `<p style="margin:0 0 20px 0;">${esc(t.intro(d, lang))}</p>` + (rows.length ? infoBox(L.box, rows) : '') +
    (note ? `<p style="margin:0 0 18px 0;color:#b45309;font-weight:600;">${esc(note)}</p>` : '') + (t.button ? button(t.button, url) : ''),
    `© ${new Date().getFullYear()} METABUILDER PRO · ${L.why}`)
  const text = [t.title, '', t.intro(d, lang), ...(rows.length ? ['', ...rows.map(([k, v]) => `${k}: ${v}`)] : []), ...(note ? ['', note] : []), ...(t.button ? ['', `${t.button}: ${url}`] : [])].join('\n')
  return { subject: t.subject, html, text }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Alertas ao ADMIN (português)
// ---------------------------------------------------------------------------------------------------------------------------------

export interface AdminBillingData {
  customerName?: string | null
  customerEmail?: string | null
  amount?: number | null
  dueDate?: string | null
  event?: string | null
  paymentId?: string | null
  /** resumo diário */
  digest?: { overdue: number; dueSoon: number; suspendedToday: number; received24h: number; failedNotices: number } | null
  appUrl: string
}

/** Alerta ao admin (null se o tipo for desconhecido). O resumo diário traz só contagens, nunca dados de cliente. */
export function adminBillingMail(kind: string, d: AdminBillingData): MailContent | null {
  const who = [d.customerName, d.customerEmail].filter(Boolean).join(' · ') || 'cliente não identificado'
  const url = `${d.appUrl}/admin/platform`
  const row = (k: string, v: unknown): [string, string] => [k, String(v ?? '-')]
  let title = '', intro = '', rows: [string, string][] = []
  if (kind === 'admin_overdue') {
    title = 'Cobrança vencida'; intro = `A cobrança de ${who} venceu e não foi paga.`
    rows = [row('Cliente', who), row('Valor', d.amount != null ? `R$ ${Number(d.amount).toFixed(2)}` : '-'), row('Vencimento', d.dueDate), row('Cobrança', d.paymentId)]
  } else if (kind === 'admin_refund') {
    title = 'Estorno ou chargeback'; intro = `Houve ${d.event === 'PAYMENT_CHARGEBACK_REQUESTED' ? 'um pedido de chargeback' : 'um estorno'} de pagamento. As comissões e recompensas ligadas a ele foram revogadas.`
    rows = [row('Cliente', who), row('Valor', d.amount != null ? `R$ ${Number(d.amount).toFixed(2)}` : '-'), row('Evento', d.event), row('Cobrança', d.paymentId)]
  } else if (kind === 'admin_unresolved') {
    title = 'Pagamento sem cliente identificado'; intro = 'O Asaas avisou de um pagamento que o sistema não conseguiu ligar a nenhum cliente. É preciso conferir à mão no painel do Asaas.'
    rows = [row('Evento', d.event), row('Cobrança', d.paymentId), row('Valor', d.amount != null ? `R$ ${Number(d.amount).toFixed(2)}` : '-')]
  } else if (kind === 'admin_digest' && d.digest) {
    title = 'Resumo diário de cobranças'; intro = 'Situação das cobranças de hoje.'
    rows = [row('Vencidas em aberto', d.digest.overdue), row('Vencem nos próximos 7 dias', d.digest.dueSoon), row('Suspensas hoje', d.digest.suspendedToday), row('Pagamentos nas últimas 24 h', d.digest.received24h), row('Avisos com falha de envio', d.digest.failedNotices)]
  } else return null
  const html = mailShell(title, `<p style="margin:0 0 20px 0;">${esc(intro)}</p>` + infoBox('Detalhes', rows) + button('Abrir o painel', url),
    `© ${new Date().getFullYear()} METABUILDER PRO · Alerta de cobrança para a equipe.`)
  const text = [title, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `Painel: ${url}`].join('\n')
  return { subject: `${title}${kind === 'admin_digest' ? '' : `: ${who}`}`.replace(/[\r\n]+/g, ' ').slice(0, 200), html, text }
}
