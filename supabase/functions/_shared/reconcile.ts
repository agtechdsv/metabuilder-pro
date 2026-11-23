/**
 * Conciliação das cobranças com o Asaas (regras PURAS, sem imports: servem à Edge Function asaas-reconcile e aos testes).
 *
 * Por que existe: o webhook do Asaas é a fonte normal da tabela `payments`, mas um evento pode se perder (configurado depois, fila pausada, falha).
 * Quando isso acontece com a RENOVAÇÃO, a cobrança existe no Asaas e não existe aqui: o cliente não recebe os lembretes de vencimento e a aba Cobranças
 * do admin não a mostra. A conciliação diária compara as cobranças ABERTAS (pendentes e vencidas) das assinaturas com a nossa tabela e conserta.
 *
 * Regras de segurança: só cria cobrança aberta e só ajusta cobrança que está aberta aqui. Uma cobrança paga, estornada ou cancelada nunca é reaberta.
 * O que o Asaas diz estar PAGO e aqui está aberto NÃO é marcado como pago pela conciliação (isso ativa o plano, gera comissão e entra na fila de NFS-e:
 * é trabalho do webhook): só é relatado para o admin conferir.
 */

export interface AsaasCharge {
  id: string
  status: string
  value: number | string
  dueDate?: string | null
  billingType?: string | null
  invoiceUrl?: string | null
  bankSlipUrl?: string | null
  externalReference?: string | null
}

export interface LocalCharge {
  id: string
  status: string
  due_date: string | null
  amount: number | string | null
}

/** Situações do Asaas que a conciliação busca (cobranças abertas). */
export const OPEN_ASAAS_STATUSES = ["PENDING", "OVERDUE"] as const
const PAID_ASAAS_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]

/** Situação da nossa tabela para uma situação aberta do Asaas (null = não é aberta). */
export const localStatusOf = (asaasStatus: string): "pending" | "overdue" | null =>
  asaasStatus === "PENDING" ? "pending" : asaasStatus === "OVERDUE" ? "overdue" : null

/**
 * Referência externa da linha (a coluna é ÚNICA): a do Asaas, com o id da cobrança, porque as renovações repetem a referência da assinatura.
 * Mesma regra do webhook (renewalRef): sem referência, `sub_<id>`.
 */
export const chargeExternalRef = (base: string | null | undefined, paymentId: string): string => (base ? `${base}~${paymentId}` : `sub_${paymentId}`)

export type ChargePlan =
  | { kind: "insert"; row: Record<string, unknown> }
  | { kind: "patch"; patch: Record<string, unknown> }
  | { kind: "none" }

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

/** O que fazer com UMA cobrança aberta do Asaas, dada a linha local (ou nenhuma). */
export function planOpenCharge(a: AsaasCharge, local: LocalCharge | null, userId: string, cycle: string | null | undefined): ChargePlan {
  const status = localStatusOf(String(a.status || ""))
  if (!status || !a.id) return { kind: "none" }
  if (!local) {
    return {
      kind: "insert",
      row: {
        user_id: userId, cycle: cycle || "monthly", amount: num(a.value), status, external_reference: chargeExternalRef(a.externalReference, a.id),
        billing_type: a.billingType || null, invoice_url: a.invoiceUrl || a.bankSlipUrl || null, asaas_payment_id: a.id, due_date: a.dueDate || null,
      },
    }
  }
  // paga, estornada, cancelada: nunca reabre
  if (local.status !== "pending" && local.status !== "overdue") return { kind: "none" }
  const patch: Record<string, unknown> = {}
  if (local.status !== status) patch.status = status
  if (a.dueDate && local.due_date !== a.dueDate) patch.due_date = a.dueDate
  if (Math.abs(num(local.amount) - num(a.value)) > 0.009) patch.amount = num(a.value)
  return Object.keys(patch).length ? { kind: "patch", patch } : { kind: "none" }
}

export type GoneKind = "paid" | "deleted" | "open" | "refunded" | "unknown"

/**
 * Uma cobrança que está aberta aqui e o Asaas já não lista como aberta: o que aconteceu com ela? Recebe o status HTTP e o corpo de GET /payments/{id}.
 * "deleted" (apagada: 404 ou deleted=true) vira cancelada aqui; "paid" é só relatado.
 */
export function classifyGone(httpStatus: number, body: { status?: string; deleted?: boolean } | null): GoneKind {
  if (httpStatus === 404) return "deleted"
  if (!body || httpStatus < 200 || httpStatus >= 300) return "unknown"
  if (body.deleted === true) return "deleted"
  const s = String(body.status || "")
  if (PAID_ASAAS_STATUSES.includes(s)) return "paid"
  if (s === "REFUNDED" || s === "PARTIALLY_REFUNDED") return "refunded"
  if (s === "PENDING" || s === "OVERDUE") return "open"
  return "unknown"
}
