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
