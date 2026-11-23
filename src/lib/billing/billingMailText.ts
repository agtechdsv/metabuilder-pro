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
  /** id da cobrança no Asaas (pay_...): o link da aba Assinatura leva esse id, para a tela mostrar exatamente esta cobrança */
  paymentId?: string | null
  billingType?: string | null
  /** acesso/renovação até (ISO) */
  validUntil?: string | null
  /** dia em que a conta será suspensa se nada for pago (ISO) */
  suspendOn?: string | null
  graceDays?: number
  wasSuspended?: boolean
  /** reajuste de preço: dia em que o novo valor passa a valer (YYYY-MM-DD), valor atual e novo da assinatura do cliente (por ciclo), ciclo e se ele ainda está em meses de campanha */
  effectiveOn?: string | null
  currentAmount?: number | null
  newAmount?: number | null
  cycle?: string | null
  campaignActive?: boolean
  /** estorno PARCIAL: quanto foi devolvido (amount é o valor total do pagamento); `partial` escolhe o texto do estorno parcial */
  refundedAmount?: number | null
  partial?: boolean
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
interface Text { subject: string | Fn; title: string; intro: Fn; button?: string; note?: Fn }

// ---- reajuste de preço: o ciclo por extenso ("por mês", "por semestre") e a nota da campanha ----
const CYCLE_NAME: Record<MailLang, Record<string, string>> = {
  pt: { monthly: 'mês', quarterly: 'trimestre', semiannual: 'semestre', yearly: 'ano' },
  en: { monthly: 'month', quarterly: 'quarter', semiannual: 'half-year', yearly: 'year' },
  es: { monthly: 'mes', quarterly: 'trimestre', semiannual: 'semestre', yearly: 'año' },
}
const per = (d: BillingMailData, l: MailLang) => CYCLE_NAME[l][d.cycle || 'monthly'] ?? CYCLE_NAME[l].monthly
const PROMO_NOTE: Record<MailLang, Fn> = {
  pt: d => (d.campaignActive ? 'O preço promocional da sua campanha não muda até o fim dos meses promocionais.' : ''),
  en: d => (d.campaignActive ? 'The promotional price of your campaign does not change until the promotional months end.' : ''),
  es: d => (d.campaignActive ? 'El precio promocional de su campaña no cambia hasta el fin de los meses promocionales.' : ''),
}

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
    price_change: { subject: (d, l) => `Reajuste de preço do MetaBuilder PRO a partir de ${day(d.effectiveOn, l)}`, title: 'Reajuste de preço', intro: (d, l) => `Olá, ${d.name}. A partir de ${day(d.effectiveOn, l)}, o valor do plano PRO será reajustado. O novo valor vale na sua primeira renovação a partir dessa data: a sua assinatura passará de ${money(d.currentAmount, l)} para ${money(d.newAmount, l)} por ${per(d, l)}. Até lá nada muda: o que já foi gerado continua como está. Se preferir não continuar, você pode cancelar a renovação a qualquer momento na aba Assinatura, sem multa, e mantém o acesso até o fim do período pago.`, note: PROMO_NOTE.pt, button: 'Ver minha assinatura' },
    price_change_reminder: { subject: (d, l) => `Lembrete: o valor do plano PRO muda em ${day(d.effectiveOn, l)}`, title: 'O reajuste está chegando', intro: (d, l) => `Olá, ${d.name}. Lembrando: em ${day(d.effectiveOn, l)} o valor do plano PRO será reajustado. Na primeira renovação a partir dessa data, a sua assinatura passará de ${money(d.currentAmount, l)} para ${money(d.newAmount, l)} por ${per(d, l)}. Se preferir não continuar, cancele a renovação na aba Assinatura; o acesso segue até o fim do período pago.`, note: PROMO_NOTE.pt, button: 'Ver minha assinatura' },
    price_change_renewal: { subject: 'Sua próxima renovação terá o novo valor', title: 'Sua renovação terá o novo valor', intro: (d, l) => `Olá, ${d.name}. A sua assinatura renova em ${day(d.dueDate, l)} e, nessa renovação, já vale o novo valor do plano PRO: de ${money(d.currentAmount, l)} para ${money(d.newAmount, l)} por ${per(d, l)}. Se preferir não renovar, cancele a renovação na aba Assinatura antes dessa data; o acesso segue até o fim do período pago.`, note: PROMO_NOTE.pt, button: 'Ver minha assinatura' },
    refunded_partial: { subject: 'Parte do seu pagamento foi estornada', title: 'Estorno parcial', intro: (d, l) => `Olá, ${d.name}. Estornamos ${d.refundedAmount ? money(d.refundedAmount, l) : 'parte'} do seu pagamento de ${money(d.amount, l)}. Sua assinatura continua ativa.` },
    canceled: { subject: 'A renovação da sua assinatura foi cancelada', title: 'Renovação cancelada', intro: (d, l) => `Olá, ${d.name}. Cancelamos a renovação automática da sua assinatura. Seu acesso continua até ${day(d.validUntil, l)}. Você pode reativar quando quiser.`, button: 'Reativar assinatura' },
    ending_soon: { subject: 'Seu acesso ao MetaBuilder PRO termina em breve', title: 'Seu acesso termina em breve', intro: (d, l) => `Olá, ${d.name}. Seu acesso termina em ${day(d.validUntil, l)}. Para continuar, reative a assinatura.`, button: 'Reativar assinatura' },
    checkout_reminder: { subject: 'Falta só o pagamento para ativar o seu plano PRO', title: 'Seu plano PRO está esperando', intro: (d, l) => `Olá, ${d.name}! Você começou a assinatura do plano PRO e falta só o pagamento de ${money(d.amount, l)}. Sua conta gratuita continua funcionando normalmente. Quando quiser concluir, é só pagar por aqui.`, button: 'Concluir pagamento' },
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
    price_change: { subject: (d, l) => `MetaBuilder PRO price update starting ${day(d.effectiveOn, l)}`, title: 'Price update', intro: (d, l) => `Hello, ${d.name}. Starting ${day(d.effectiveOn, l)}, the PRO plan price will be updated. The new price applies at your first renewal on or after that date: your subscription will go from ${money(d.currentAmount, l)} to ${money(d.newAmount, l)} per ${per(d, l)}. Until then nothing changes: what has already been generated stays as it is. If you prefer not to continue, you can cancel the renewal at any time in the Subscription tab, with no penalty, and keep access until the end of the paid period.`, note: PROMO_NOTE.en, button: 'View my subscription' },
    price_change_reminder: { subject: (d, l) => `Reminder: the PRO plan price changes on ${day(d.effectiveOn, l)}`, title: 'The price update is coming', intro: (d, l) => `Hello, ${d.name}. A reminder: on ${day(d.effectiveOn, l)} the PRO plan price will be updated. At your first renewal on or after that date, your subscription will go from ${money(d.currentAmount, l)} to ${money(d.newAmount, l)} per ${per(d, l)}. If you prefer not to continue, cancel the renewal in the Subscription tab; access continues until the end of the paid period.`, note: PROMO_NOTE.en, button: 'View my subscription' },
    price_change_renewal: { subject: 'Your next renewal will have the new price', title: 'Your renewal will have the new price', intro: (d, l) => `Hello, ${d.name}. Your subscription renews on ${day(d.dueDate, l)} and that renewal already uses the new PRO plan price: from ${money(d.currentAmount, l)} to ${money(d.newAmount, l)} per ${per(d, l)}. If you prefer not to renew, cancel the renewal in the Subscription tab before that date; access continues until the end of the paid period.`, note: PROMO_NOTE.en, button: 'View my subscription' },
    refunded_partial: { subject: 'Part of your payment was refunded', title: 'Partial refund', intro: (d, l) => `Hello, ${d.name}. We refunded ${d.refundedAmount ? money(d.refundedAmount, l) : 'part'} of your payment of ${money(d.amount, l)}. Your subscription remains active.` },
    canceled: { subject: 'Your subscription renewal was canceled', title: 'Renewal canceled', intro: (d, l) => `Hello, ${d.name}. We canceled the automatic renewal of your subscription. Your access continues until ${day(d.validUntil, l)}. You can reactivate whenever you want.`, button: 'Reactivate subscription' },
    ending_soon: { subject: 'Your MetaBuilder PRO access ends soon', title: 'Your access ends soon', intro: (d, l) => `Hello, ${d.name}. Your access ends on ${day(d.validUntil, l)}. To continue, reactivate your subscription.`, button: 'Reactivate subscription' },
    checkout_reminder: { subject: 'Only the payment is missing to activate your PRO plan', title: 'Your PRO plan is waiting', intro: (d, l) => `Hello, ${d.name}! You started the PRO plan subscription and only the payment of ${money(d.amount, l)} is missing. Your free account keeps working normally. Whenever you want to finish, just pay here.`, button: 'Complete payment' },
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
    price_change: { subject: (d, l) => `Actualización de precio de MetaBuilder PRO desde el ${day(d.effectiveOn, l)}`, title: 'Actualización de precio', intro: (d, l) => `Hola, ${d.name}. Desde el ${day(d.effectiveOn, l)}, el precio del plan PRO se actualizará. El nuevo precio vale en su primera renovación a partir de esa fecha: su suscripción pasará de ${money(d.currentAmount, l)} a ${money(d.newAmount, l)} por ${per(d, l)}. Hasta entonces nada cambia: lo que ya se generó sigue igual. Si prefiere no continuar, puede cancelar la renovación en cualquier momento en la pestaña Suscripción, sin penalización, y mantiene el acceso hasta el fin del período pagado.`, note: PROMO_NOTE.es, button: 'Ver mi suscripción' },
    price_change_reminder: { subject: (d, l) => `Recordatorio: el precio del plan PRO cambia el ${day(d.effectiveOn, l)}`, title: 'La actualización de precio se acerca', intro: (d, l) => `Hola, ${d.name}. Un recordatorio: el ${day(d.effectiveOn, l)} el precio del plan PRO se actualizará. En la primera renovación a partir de esa fecha, su suscripción pasará de ${money(d.currentAmount, l)} a ${money(d.newAmount, l)} por ${per(d, l)}. Si prefiere no continuar, cancele la renovación en la pestaña Suscripción; el acceso sigue hasta el fin del período pagado.`, note: PROMO_NOTE.es, button: 'Ver mi suscripción' },
    price_change_renewal: { subject: 'Su próxima renovación tendrá el nuevo precio', title: 'Su renovación tendrá el nuevo precio', intro: (d, l) => `Hola, ${d.name}. Su suscripción se renueva el ${day(d.dueDate, l)} y esa renovación ya usa el nuevo precio del plan PRO: de ${money(d.currentAmount, l)} a ${money(d.newAmount, l)} por ${per(d, l)}. Si prefiere no renovar, cancele la renovación en la pestaña Suscripción antes de esa fecha; el acceso sigue hasta el fin del período pagado.`, note: PROMO_NOTE.es, button: 'Ver mi suscripción' },
    refunded_partial: { subject: 'Se reembolsó parte de su pago', title: 'Reembolso parcial', intro: (d, l) => `Hola, ${d.name}. Reembolsamos ${d.refundedAmount ? money(d.refundedAmount, l) : 'una parte'} de su pago de ${money(d.amount, l)}. Su suscripción sigue activa.` },
    canceled: { subject: 'La renovación de su suscripción fue cancelada', title: 'Renovación cancelada', intro: (d, l) => `Hola, ${d.name}. Cancelamos la renovación automática de su suscripción. Su acceso continúa hasta el ${day(d.validUntil, l)}. Puede reactivarla cuando quiera.`, button: 'Reactivar suscripción' },
    ending_soon: { subject: 'Su acceso a MetaBuilder PRO termina pronto', title: 'Su acceso termina pronto', intro: (d, l) => `Hola, ${d.name}. Su acceso termina el ${day(d.validUntil, l)}. Para continuar, reactive la suscripción.`, button: 'Reactivar suscripción' },
    checkout_reminder: { subject: 'Solo falta el pago para activar su plan PRO', title: 'Su plan PRO le está esperando', intro: (d, l) => `¡Hola, ${d.name}! Usted inició la suscripción al plan PRO y solo falta el pago de ${money(d.amount, l)}. Su cuenta gratuita sigue funcionando con normalidad. Cuando quiera terminar, solo pague por aquí.`, button: 'Completar el pago' },
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
// "refunded_partial" é só a variante do texto de "refunded" (estorno parcial), e não um tipo de aviso na fila
export const BILLING_CUSTOMER_KINDS = Object.keys(TEXTS.pt).filter(k => k !== 'refunded_partial')

/** Monta o e-mail de um aviso ao cliente (null se o tipo for desconhecido). O botão leva à fatura, se houver, ou ao painel do cliente. */
export function customerBillingMail(kind: string, lang: MailLang, d: BillingMailData): MailContent | null {
  // estorno parcial tem texto próprio (o aviso de estorno total diz que "o pagamento foi estornado")
  const isPartialRefund = kind === 'refunded' && d.partial === true
  const t = TEXTS[lang]?.[isPartialRefund ? 'refunded_partial' : kind]
  if (!t) return null
  const L = LABELS[lang]
  const rows: [string, string][] = []
  if (d.amount != null && !isPartialRefund) rows.push([L.amount, money(d.amount, lang)])
  if (d.dueDate) rows.push([L.due, day(d.dueDate, lang)])
  const m = methodName(d.billingType, lang)
  if (m) rows.push([L.method, m])
  if (kind === 'payment_received' && d.validUntil) rows.push([L.until, day(d.validUntil, lang)])
  const dashboard = `${d.appUrl}/client/dashboard`
  // suspensão, cartão recusado e checkout abandonado levam à aba Assinatura (QR Code e cartão na própria tela); os demais, à fatura
  const pay = `${dashboard}?tab=subscription${/^pay_[A-Za-z0-9]+$/.test(d.paymentId || '') ? `&pay=${d.paymentId}` : ''}`
  // cancelada e "acesso termina" levam à aba Assinatura, onde está o aviso e o botão de reativar
  const url = kind === 'suspended' || kind === 'card_refused' || kind === 'checkout_reminder' || kind === 'canceled' || kind === 'ending_soon' || kind.startsWith('price_change') ? pay : kind === 'payment_received' ? dashboard : (d.invoiceUrl || dashboard)
  const note = t.note ? t.note(d, lang) : ''
  const html = mailShell(t.title,
    `<p style="margin:0 0 20px 0;">${esc(t.intro(d, lang))}</p>` + (rows.length ? infoBox(L.box, rows) : '') +
    (note ? `<p style="margin:0 0 18px 0;color:#b45309;font-weight:600;">${esc(note)}</p>` : '') + (t.button ? button(t.button, url) : ''),
    `© ${new Date().getFullYear()} METABUILDER PRO · ${L.why}`)
  const text = [t.title, '', t.intro(d, lang), ...(rows.length ? ['', ...rows.map(([k, v]) => `${k}: ${v}`)] : []), ...(note ? ['', note] : []), ...(t.button ? ['', `${t.button}: ${url}`] : [])].join('\n')
  return { subject: typeof t.subject === 'function' ? t.subject(d, lang) : t.subject, html, text }
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
  /** estorno parcial: quanto foi devolvido (amount é o total do pagamento) */
  refundedAmount?: number | null
  /** resumo diário */
  digest?: { overdue: number; dueSoon: number; suspendedToday: number; received24h: number; failedNotices: number } | null
  /** alerta da chave de API do Asaas: nome da chave e quando expira (o que o Asaas informar; nunca o valor da chave) */
  keyName?: string | null
  expiresAt?: string | null
  /** a conta do Asaas tem mais de um app: a chave é nossa ("own"), de outro app cadastrado ("other") ou desconhecida ("unknown"); vazio = como antes */
  keyScope?: 'own' | 'other' | 'unknown' | null
  appUrl: string
}

/** O que cada evento da chave de API do Asaas significa para o sistema e o que fazer. O checkout e os repasses dependem da chave guardada em ASAAS_API_KEY. */
const KEY_ALERTS: Record<string, { title: string; intro: string; todo: string }> = {
  ACCESS_TOKEN_EXPIRING_SOON: { title: 'Chave de API do Asaas vai expirar', intro: 'Uma chave de API do Asaas está perto de expirar. Se for a chave que o sistema usa, o checkout e os repasses a parceiros vão parar quando ela expirar.', todo: 'Gere uma chave nova (com permissão de Transferências) em Asaas > Integrações > Chaves de API e atualize ASAAS_API_KEY nos Secrets das Edge Functions do Supabase, antes de expirar.' },
  ACCESS_TOKEN_DISABLED: { title: 'Chave de API do Asaas desabilitada', intro: 'Uma chave de API do Asaas foi desabilitada (o Asaas desabilita chaves sem uso por 3 meses). Se for a chave do sistema, o checkout passa a responder "A chave de API fornecida é inválida" e os repasses falham.', todo: 'Reabilite a chave em Asaas > Integrações > Chaves de API, ou gere uma nova e atualize ASAAS_API_KEY nos Secrets das Edge Functions do Supabase.' },
  ACCESS_TOKEN_EXPIRED: { title: 'Chave de API do Asaas expirou', intro: 'Uma chave de API do Asaas expirou de vez e não volta a funcionar. Se for a chave do sistema, o checkout e os repasses estão parados.', todo: 'Gere uma chave nova (com permissão de Transferências) em Asaas > Integrações > Chaves de API e atualize ASAAS_API_KEY nos Secrets das Edge Functions do Supabase.' },
  ACCESS_TOKEN_CREATED: { title: 'Nova chave de API criada no Asaas', intro: 'Foi criada uma chave de API na conta do Asaas.', todo: 'Se não foi você, revogue a chave em Asaas > Integrações > Chaves de API e troque a senha da conta do Asaas.' },
  ACCESS_TOKEN_ENABLED: { title: 'Chave de API do Asaas habilitada', intro: 'Uma chave de API do Asaas foi habilitada de novo.', todo: 'Se não foi você, desabilite a chave em Asaas > Integrações > Chaves de API e troque a senha da conta do Asaas.' },
  ACCESS_TOKEN_DELETED: { title: 'Chave de API do Asaas excluída', intro: 'Uma chave de API do Asaas foi excluída. Se for a chave do sistema, o checkout e os repasses param.', todo: 'Se não foi você, troque a senha da conta do Asaas. Se a chave era a do sistema, gere uma nova em Asaas > Integrações > Chaves de API e atualize ASAAS_API_KEY nos Secrets das Edge Functions do Supabase.' },
}

/** Alerta ao admin (null se o tipo for desconhecido). O resumo diário traz só contagens, nunca dados de cliente. */
export function adminBillingMail(kind: string, d: AdminBillingData): MailContent | null {
  const who = [d.customerName, d.customerEmail].filter(Boolean).join(' · ') || 'cliente não identificado'
  const url = `${d.appUrl}/admin/platform`
  const row = (k: string, v: unknown): [string, string] => [k, String(v ?? '-')]
  let title = '', intro = '', rows: [string, string][] = []
  let partialRows = false
  const brl = (n: number) => money(n, 'pt')
  if (kind === 'admin_overdue') {
    title = 'Cobrança vencida'; intro = `A cobrança de ${who} venceu e não foi paga.`
    rows = [row('Cliente', who), row('Valor', d.amount != null ? `R$ ${Number(d.amount).toFixed(2)}` : '-'), row('Vencimento', d.dueDate), row('Cobrança', d.paymentId)]
  } else if (kind === 'admin_refund') {
    // estorno parcial e estorno negado não revogam nada: o texto não pode dizer o contrário
    if (d.event === 'PAYMENT_PARTIALLY_REFUNDED') {
      title = 'Estorno parcial'; intro = 'Houve um estorno parcial de um pagamento. A cobrança continua paga; comissões e recompensas não foram alteradas.'
      partialRows = true
    } else if (d.event === 'PAYMENT_REFUND_DENIED') {
      title = 'Estorno negado'; intro = 'O Asaas negou o estorno pedido. Nada foi devolvido ao cliente; confira o motivo no painel do Asaas.'
    } else {
      title = 'Estorno ou chargeback'; intro = `Houve ${d.event === 'PAYMENT_CHARGEBACK_REQUESTED' ? 'um pedido de chargeback' : 'um estorno'} de pagamento. As comissões e recompensas ligadas a ele foram revogadas.`
    }
    // estorno parcial: "Valor devolvido" é o estornado e "Valor do pagamento" é o total (antes aparecia só o total, como se tudo tivesse sido devolvido)
    rows = partialRows
      ? [row('Cliente', who), row('Valor devolvido', d.refundedAmount != null ? brl(d.refundedAmount) : 'veja no painel do Asaas'), row('Valor do pagamento', d.amount != null ? brl(d.amount) : '-'), row('Evento', d.event), row('Cobrança', d.paymentId)]
      : [row('Cliente', who), row('Valor', d.amount != null ? brl(d.amount) : '-'), row('Evento', d.event), row('Cobrança', d.paymentId)]
  } else if (kind === 'admin_unresolved') {
    title = 'Pagamento sem cliente identificado'; intro = 'O Asaas avisou de um pagamento que o sistema não conseguiu ligar a nenhum cliente. É preciso conferir à mão no painel do Asaas.'
    rows = [row('Evento', d.event), row('Cobrança', d.paymentId), row('Valor', d.amount != null ? `R$ ${Number(d.amount).toFixed(2)}` : '-')]
  } else if (kind === 'admin_digest' && d.digest) {
    title = 'Resumo diário de cobranças'; intro = 'Situação das cobranças de hoje.'
    rows = [row('Vencidas em aberto', d.digest.overdue), row('Vencem nos próximos 7 dias', d.digest.dueSoon), row('Suspensas hoje', d.digest.suspendedToday), row('Pagamentos nas últimas 24 h', d.digest.received24h), row('Avisos com falha de envio', d.digest.failedNotices)]
  } else if (kind === 'admin_key_alert' && d.event && KEY_ALERTS[d.event]) {
    const a = KEY_ALERTS[d.event]
    if (d.keyScope === 'other') {
      // chave de OUTRO app que usa a mesma conta do Asaas: informativo, sem urgência e sem mandar mexer nos Secrets do MetaBuilder
      title = `${a.title} (outro app)`
      intro = `O Asaas avisou sobre uma chave cadastrada como de OUTRO app que usa a mesma conta (${d.keyName || 'sem nome'}). Isso não afeta o checkout nem os repasses do MetaBuilder.`
      rows = [row('Evento', d.event), row('Chave', d.keyName || '-'), row('Expira em', d.expiresAt || '-'), row('O que fazer', 'Nada no MetaBuilder. Avise o responsável pelo outro app, se for o caso.')]
    } else {
      title = a.title; intro = a.intro
      rows = [row('Evento', d.event), row('Chave', d.keyName || '-'), row('Expira em', d.expiresAt || '-'), row('O que fazer', a.todo)]
      // nome que não está cadastrado em "Apps neste Asaas": pode ser de outro app; pede para cadastrar e, assim, deixar de receber alerta de urgência
      if (d.keyScope === 'unknown') rows.push(row('Chave cadastrada?', 'Não. Se for de outro app, cadastre o nome em Sistema > Avisos de cobrança > Apps neste Asaas; se for a do MetaBuilder, cadastre como "nossa".'))
    }
  } else return null
  const html = mailShell(title, `<p style="margin:0 0 20px 0;">${esc(intro)}</p>` + infoBox('Detalhes', rows) + button('Abrir o painel', url),
    `© ${new Date().getFullYear()} METABUILDER PRO · Alerta de cobrança para a equipe.`, false)
  const text = [title, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', `Painel: ${url}`].join('\n')
  const noWho = kind === 'admin_digest' || kind === 'admin_key_alert'
  return { subject: `${title}${noWho ? '' : `: ${who}`}`.replace(/[\r\n]+/g, ' ').slice(0, 200), html, text }
}
