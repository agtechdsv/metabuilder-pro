/**
 * Data que a tela do cliente mostra para uma cobrança: a do PAGAMENTO quando já foi paga (`webhook_received_at`, o momento em que o Asaas avisou),
 * senão a de criação. Mostrar sempre a criação fazia uma fatura de 16/11 paga em 22/11 aparecer como "pago em 16/11".
 * Limite: no cartão o Asaas avisa duas vezes (confirmada e depois recebida), e o aviso mais recente é o que fica gravado.
 */
export interface PaymentDates { status?: string | null; created_at?: string | null; webhook_received_at?: string | null }

export function paymentDisplayDate(p: PaymentDates | null | undefined): string | null {
  if (!p) return null
  const paid = String(p.status ?? '').trim().toLowerCase() === 'paid'
  return (paid && p.webhook_received_at) || p.created_at || null
}

export interface PaymentRowInput extends PaymentDates { due_date?: string | null; asaas_payment_id?: string | null }
/** paid = data do pagamento; due = vencimento (cobrança em aberto); created = criação (cancelada, estornada, ou sem vencimento gravado) */
export type PaymentDateKind = 'paid' | 'due' | 'created'

const isOpen = (status: unknown) => ['pending', 'overdue'].includes(String(status ?? '').trim().toLowerCase())
const validDay = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)

/**
 * A data da linha do histórico de faturamento, com o seu tipo. Cobrança EM ABERTO mostra o vencimento (o Asaas cria a cobrança de um mês
 * dias antes de vencer: a data de criação, 23/11, parecia outra fatura ao lado da "Próxima fatura" que vence em 15/12).
 */
export function paymentRowDate(p: PaymentRowInput | null | undefined): { date: string | null; kind: PaymentDateKind } {
  if (!p) return { date: null, kind: 'created' }
  if (isOpen(p.status) && validDay(p.due_date)) return { date: p.due_date, kind: 'due' }
  const paid = String(p.status ?? '').trim().toLowerCase() === 'paid' && !!p.webhook_received_at
  return { date: paymentDisplayDate(p), kind: paid ? 'paid' : 'created' }
}

/**
 * Esta linha é a MESMA cobrança do bloco "Próxima fatura / Cobrança pendente" que aparece acima do histórico? (pelo id da cobrança no Asaas)
 * Serve para marcá-la, em vez de parecer uma segunda fatura.
 */
export function isShownAbove(p: PaymentRowInput | null | undefined, pendingInvoiceId: string | null | undefined): boolean {
  return !!p && !!pendingInvoiceId && isOpen(p.status) && p.asaas_payment_id === pendingInvoiceId
}
