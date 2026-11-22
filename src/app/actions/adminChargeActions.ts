'use server'

import { createClient } from '@/utils/supabase/server'
import { billingFunctionUrl } from '@/lib/admin/billingCancel'
import { readChargeActionResponse, type ChargeActionResult } from '@/lib/billing/chargeActions'

/**
 * Ações do SuperAdmin sobre cobranças (cancelar uma cobrança, cancelar a assinatura, estornar). Este arquivo só repassa o pedido à Edge Function
 * `admin-cancel-billing` com a SESSÃO do SuperAdmin: quem fala com o Asaas, confere as regras e grava o registro (mb_admin_billing_log) é a função,
 * que guarda a chave do Asaas. Aqui nada é gravado e a chave de serviço nunca é usada. Quem agiu vem da sessão, nunca do corpo do pedido.
 */
async function callFunction(body: Record<string, unknown>): Promise<ChargeActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'forbidden' }
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return { ok: false, code: 'forbidden' }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { ok: false, code: 'forbidden' }
  try {
    const res = await fetch(billingFunctionUrl(process.env.NEXT_PUBLIC_SUPABASE_URL!), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    return readChargeActionResponse(res.status, json)
  } catch (e: any) {
    return { ok: false, code: 'unknown', error: `Não foi possível falar com o Asaas agora: ${e?.message || 'falha de rede'}` }
  }
}

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)

/** Cancela UMA cobrança aberta no Asaas. A assinatura continua e gera a próxima no ciclo seguinte. */
export async function cancelChargeAction(paymentId: string, reason?: string): Promise<ChargeActionResult> {
  if (!uuid(paymentId)) return { ok: false, code: 'invalid_input' }
  return callFunction({ mode: 'cancel_charge', paymentId, reason: String(reason ?? '').slice(0, 300) })
}

/** Cancela a assinatura (acesso até o fim do período). `cancelCharges`: apagar também as cobranças abertas (padrão: sim). */
export async function cancelSubscriptionAction(userId: string, reason?: string, cancelCharges = true): Promise<ChargeActionResult> {
  if (!uuid(userId)) return { ok: false, code: 'invalid_input' }
  return callFunction({ mode: 'cancel_subscription', userId, reason: String(reason ?? '').slice(0, 300), cancelCharges: cancelCharges !== false })
}

/** Pede o estorno (Pix ou cartão). Sem `value` é total. O motivo é obrigatório. Quem confirma é o webhook do Asaas. */
export async function refundChargeAction(input: { paymentId: string; reason: string; value?: number | null; cancelSubscription?: boolean }): Promise<ChargeActionResult> {
  if (!uuid(input?.paymentId)) return { ok: false, code: 'invalid_input' }
  const reason = String(input.reason ?? '').trim()
  if (!reason) return { ok: false, code: 'reason_required' }
  const body: Record<string, unknown> = { mode: 'refund', paymentId: input.paymentId, reason: reason.slice(0, 300), cancelSubscription: !!input.cancelSubscription }
  if (input.value != null) body.value = Number(input.value)
  return callFunction(body)
}
