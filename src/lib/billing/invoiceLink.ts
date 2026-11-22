/**
 * O que o link da fatura (`payments.invoice_url`, página da fatura no Asaas) é para cada situação da cobrança:
 * paga = comprovante ("receipt"); pendente ou vencida = a mesma página serve para PAGAR ("pay");
 * cancelada, estornada ou desconhecida = não mostra link (null).
 */
export type InvoiceLinkKind = 'receipt' | 'pay' | null

export function invoiceLinkKind(status: string | null | undefined): InvoiceLinkKind {
  switch (String(status ?? '').trim().toLowerCase()) {
    case 'paid': return 'receipt'
    case 'pending':
    case 'overdue': return 'pay'
    default: return null
  }
}
