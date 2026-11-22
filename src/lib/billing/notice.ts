/** Evento da janela: "o pagamento entrou, confira o aviso de cobrança de novo" (a aba Assinatura dispara; o banner escuta). */
export const BILLING_REFRESH_EVENT = 'mb-billing-refresh'

/** O que a tela do dono mostra no aviso fixo de cobrança (banner). */
export type MyBillingNoticeState = 'due_soon' | 'overdue' | 'card_refused' | 'checkout_pending'

export interface MyBillingNotice {
  state: MyBillingNoticeState
  /** vencimento, YYYY-MM-DD */
  dueDate: string | null
  amount: number | null
  billingType: string | null
  /** link da fatura (Pix, boleto) */
  invoiceUrl: string | null
  /** id da cobrança no Asaas (pay_...), para a aba Assinatura abrir exatamente esta cobrança */
  paymentId: string | null
  /** dias até vencer (negativo = vencida) */
  daysToDue: number | null
  /** quando a conta será suspensa se nada for pago (ISO), no estado "vencida" com carência */
  suspendOn: string | null
}

export type BillingErrorCode = 'not_authorized' | 'invalid_grace' | 'invalid_email' | 'unknown'
export interface BillingAdminOverview {
  settings: { enabled: boolean; graceDays: number; adminEmail: string }
  stats: { queued: number; sent7d: number; failed: number; lastSentAt: string | null }
}
