/**
 * E-mails dos repasses a parceiros (modelo da marca): aviso ao PARCEIRO quando o Pix dele foi concluído (pt, en e es) e resumo do lote ao ADMIN
 * (português). Texto puro e testável; a fila e o envio ficam em billingService.ts. Texto de quem escreve (nome) é sempre escapado.
 */
import { button, esc, infoBox, mailShell, type MailContent, type MailLang } from '../security/securityMailText'

const LOCALE: Record<MailLang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }
const money = (n: number | null | undefined, lang: MailLang) => `R$ ${(Number(n) || 0).toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
/** Data e hora no horário de Brasília (o servidor roda em UTC). */
const when = (iso: string | null | undefined, lang: MailLang) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString(LOCALE[lang], { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

export interface PartnerPayoutMailData {
  name: string
  amount: number
  /** quando o Pix foi concluído (ISO) */
  paidAt: string | null
  /** tipo da chave (CPF, CNPJ, EMAIL, PHONE, EVP) */
  type: string
  /** chave mascarada, ex.: •••101 */
  keyMasked: string
  panelUrl: string
}

const PARTNER = {
  pt: { subject: (a: string) => `Sua comissão de ${a} foi paga`, title: 'Comissão paga por Pix', intro: (n: string) => `Olá, ${n}! Enviamos por Pix o pagamento das suas comissões do programa de parceiros do MetaBuilder PRO.`, box: 'Detalhes do pagamento', amount: 'Valor', key: 'Chave Pix', date: 'Data do pagamento', button: 'Abrir meu painel', note: 'O valor pode levar alguns instantes para aparecer na sua conta, conforme o seu banco.', why: 'Você recebeu este e-mail por ser parceiro do MetaBuilder PRO.' },
  en: { subject: (a: string) => `Your commission of ${a} has been paid`, title: 'Commission paid by Pix', intro: (n: string) => `Hello, ${n}! We sent your MetaBuilder PRO partner program commissions by Pix.`, box: 'Payment details', amount: 'Amount', key: 'Pix key', date: 'Payment date', button: 'Open my dashboard', note: 'It may take a few moments to show up in your account, depending on your bank.', why: 'You received this e-mail because you are a MetaBuilder PRO partner.' },
  es: { subject: (a: string) => `Su comisión de ${a} fue pagada`, title: 'Comisión pagada por Pix', intro: (n: string) => `¡Hola, ${n}! Enviamos por Pix el pago de sus comisiones del programa de socios de MetaBuilder PRO.`, box: 'Detalles del pago', amount: 'Valor', key: 'Clave Pix', date: 'Fecha del pago', button: 'Abrir mi panel', note: 'Puede tardar unos instantes en aparecer en su cuenta, según su banco.', why: 'Recibió este e-mail por ser socio de MetaBuilder PRO.' },
} as const

/** Aviso ao parceiro: o Pix da comissão dele foi concluído. */
export function partnerPayoutPaidMail(lang: MailLang, d: PartnerPayoutMailData): MailContent {
  const L = PARTNER[lang] || PARTNER.pt
  const l: MailLang = PARTNER[lang] ? lang : 'pt'
  const rows: [string, string][] = [[L.amount, money(d.amount, l)], [L.key, `${d.type}: ${d.keyMasked}`], [L.date, when(d.paidAt, l)]]
  const html = mailShell(L.title,
    `<p style="margin:0 0 20px 0;">${esc(L.intro(d.name))}</p>` + infoBox(L.box, rows) +
    `<p style="margin:0 0 18px 0;color:#6b7280;">${esc(L.note)}</p>` + button(L.button, d.panelUrl),
    `© ${new Date().getFullYear()} METABUILDER PRO · ${L.why}`)
  const text = [L.title, '', L.intro(d.name), '', ...rows.map(([k, v]) => `${k}: ${v}`), '', L.note, '', `${L.button}: ${d.panelUrl}`].join('\n')
  return { subject: L.subject(money(d.amount, l)), html, text }
}

export interface PayoutSummaryItem {
  partner: string
  amount: number
  /** done = pago; failed = falhou; outro = ainda em andamento */
  status: string
  /** quando terminou (ISO) */
  at: string | null
  failReason?: string | null
  type?: string | null
  keyMasked?: string | null
}

export interface PayoutSummaryData {
  /** quando o lote foi criado (ISO) */
  createdAt: string | null
  note?: string | null
  items: PayoutSummaryItem[]
  appUrl: string
}

const STATUS_PT: Record<string, string> = { done: 'Pago', failed: 'Falhou', sent: 'Em processamento', sending: 'Enviando', pending: 'Preparando' }

/** Resumo do lote ao admin: uma linha por parceiro com valor, situação e data, mais os totais. Só texto escapado de quem escreve (nomes e motivos). */
export function adminPayoutSummaryMail(d: PayoutSummaryData): MailContent {
  const paid = d.items.filter(i => i.status === 'done')
  const failed = d.items.filter(i => i.status === 'failed')
  const sum = (xs: PayoutSummaryItem[]) => xs.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const title = failed.length === 0 ? 'Repasse de parceiros concluído' : paid.length === 0 ? 'Repasse de parceiros falhou' : 'Repasse de parceiros concluído com falhas'
  const intro = `O lote de ${when(d.createdAt, 'pt')} terminou: ${paid.length} pago(s) (${money(sum(paid), 'pt')})${failed.length ? ` e ${failed.length} com falha (${money(sum(failed), 'pt')}, que volta ao saldo do parceiro)` : ''}.`
  const lines: [string, string][] = d.items.map(i => [
    i.partner,
    `${money(i.amount, 'pt')} · ${STATUS_PT[i.status] || i.status} · ${when(i.at, 'pt')}${i.keyMasked ? ` · ${i.type ? i.type + ' ' : ''}${i.keyMasked}` : ''}${i.status === 'failed' && i.failReason ? ` · ${i.failReason}` : ''}`,
  ])
  const totals: [string, string][] = [['Total pago', money(sum(paid), 'pt')], ...(failed.length ? [['Total com falha', money(sum(failed), 'pt')] as [string, string]] : [])]
  const url = `${d.appUrl}/admin/platform`
  const html = mailShell(title,
    `<p style="margin:0 0 20px 0;">${esc(intro)}</p>` + infoBox('Parceiros do lote', lines) + infoBox('Totais', totals) +
    (d.note ? `<p style="margin:0 0 18px 0;color:#6b7280;">Observação do lote: ${esc(d.note)}</p>` : '') + button('Abrir o painel', url),
    `© ${new Date().getFullYear()} METABUILDER PRO · Resumo de repasse para a equipe.`)
  const text = [title, '', intro, '', ...lines.map(([k, v]) => `${k}: ${v}`), '', ...totals.map(([k, v]) => `${k}: ${v}`), ...(d.note ? ['', `Observação do lote: ${d.note}`] : []), '', `Painel: ${url}`].join('\n')
  return { subject: `${title}: ${money(sum(paid), 'pt')}`.slice(0, 200), html, text }
}
