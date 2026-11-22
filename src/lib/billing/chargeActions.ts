/**
 * Ações do SuperAdmin sobre uma cobrança (tela Clientes > Cobranças, fase 2): quais botões cada linha mostra e como ler a resposta da função.
 * Só regras puras, para a tela e os testes. A rede fica em src/app/actions/adminChargeActions.ts; as regras de verdade (e a última palavra) são da
 * Edge Function admin-cancel-billing, que confere tudo de novo.
 */
import type { ChargeDto } from './adminCharges'

export type ChargeActionKind = 'cancel_charge' | 'cancel_subscription' | 'refund'

/** Formas de pagamento que a tela sabe estornar (boleto fica no painel do Asaas). Mesma lista da Edge Function. */
export const REFUNDABLE_METHODS = ['PIX', 'CREDIT_CARD']

/** Ações disponíveis para a linha. */
export function availableActions(c: Pick<ChargeDto, 'group' | 'method' | 'subscriptionActive' | 'refundRequested' | 'asaasPaymentId'>): ChargeActionKind[] {
  const out: ChargeActionKind[] = []
  if ((c.group === 'upcoming' || c.group === 'overdue') && c.asaasPaymentId) out.push('cancel_charge')
  if (c.group === 'paid' && c.asaasPaymentId && !c.refundRequested && REFUNDABLE_METHODS.includes(String(c.method ?? '').toUpperCase())) out.push('refund')
  if (c.subscriptionActive) out.push('cancel_subscription')
  return out
}

/** "12,50", "12.50" ou "1.234,50" para número; vazio = null (estorno total); inválido = NaN. */
export function parseMoneyInput(raw: string): number | null {
  const s = String(raw ?? '').trim().replace(/^R\$\s*/i, '')
  if (!s) return null
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return NaN
  return Number(norm)
}

export type ChargeActionCode =
  | 'forbidden' | 'invalid_input' | 'not_found' | 'not_open' | 'no_asaas_id' | 'no_subscription' | 'already_canceled' | 'not_paid'
  | 'method_not_supported' | 'invalid_value' | 'value_too_big' | 'reason_required' | 'duplicate' | 'log_unavailable' | 'asaas_failed' | 'unknown'
const KNOWN: ChargeActionCode[] = ['forbidden', 'invalid_input', 'not_found', 'not_open', 'no_asaas_id', 'no_subscription', 'already_canceled', 'not_paid',
  'method_not_supported', 'invalid_value', 'value_too_big', 'reason_required', 'duplicate', 'log_unavailable', 'asaas_failed']

export interface ChargeActionResult {
  ok: boolean
  code?: ChargeActionCode
  /** mensagem do servidor (Asaas, por exemplo), mostrada junto do código */
  error?: string
  /** estorno: a assinatura também foi cancelada? (null = não pedido) */
  subscription?: { ok: boolean; error: string | null } | null
  chargesDeleted?: number
}

/** Lê a resposta da Edge Function. Função ainda não publicada, sessão recusada e falha do Asaas viram códigos que a tela traduz. */
export function readChargeActionResponse(status: number, body: any): ChargeActionResult {
  if (status === 404 && body?.code === 'NOT_FOUND') return { ok: false, code: 'unknown', error: 'A função admin-cancel-billing ainda não foi publicada com as ações de cobrança.' }
  if (status === 401 || status === 403) return { ok: false, code: 'forbidden' }
  if (status >= 200 && status < 300 && body?.success !== false) {
    return { ok: true, subscription: body?.subscription ?? null, chargesDeleted: Number(body?.chargesDeleted) || 0 }
  }
  const code = KNOWN.includes(body?.code) ? (body.code as ChargeActionCode) : 'unknown'
  return { ok: false, code, error: typeof body?.error === 'string' ? body.error : undefined }
}
