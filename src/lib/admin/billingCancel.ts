/**
 * Ponte entre as telas de Clientes e a Edge Function `admin-cancel-billing` (cancela assinatura e cobranças abertas no Asaas).
 * Aqui só ficam as partes sem rede: endereço da função e a leitura da resposta (testáveis).
 */
export interface BillingInspection { hasBilling: boolean; hasSubscription: boolean; chargeCount: number; chargeTotal: number }
export type BillingPurpose = 'block' | 'delete'

export const BILLING_FUNCTION = 'admin-cancel-billing'

export const billingFunctionUrl = (supabaseUrl: string) => `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/${BILLING_FUNCTION}`

export interface BillingResult { ok: boolean; info?: BillingInspection; chargesDeleted?: number; error?: string }

/** Lê a resposta da função. Função ainda não publicada, sessão recusada e falha parcial no Asaas viram mensagens claras. */
export function readBillingResponse(status: number, body: any): BillingResult {
  if (status === 404 && body?.code === 'NOT_FOUND') return { ok: false, error: `A função ${BILLING_FUNCTION} ainda não foi publicada no Supabase. Publique-a e tente de novo.` }
  if (status === 401) return { ok: false, error: 'Sessão expirada. Entre de novo e repita.' }
  if (status === 403) return { ok: false, error: 'Apenas o SuperAdmin pode cancelar cobranças.' }
  if (status < 200 || status >= 300 || body?.success === false) return { ok: false, error: String(body?.error || body?.message || `Falha ao falar com o Asaas (${status}).`) }
  if (typeof body?.hasBilling === 'boolean') {
    return { ok: true, info: { hasBilling: body.hasBilling, hasSubscription: !!body.hasSubscription, chargeCount: Number(body.chargeCount) || 0, chargeTotal: Number(body.chargeTotal) || 0 } }
  }
  return { ok: true, chargesDeleted: Number(body?.chargesDeleted) || 0 }
}

/** Há algo a cancelar no Asaas? (assinatura ou cobrança aberta) */
export const hasOpenBilling = (i: BillingInspection | null | undefined) => !!i && i.hasBilling && (i.hasSubscription || i.chargeCount > 0)
