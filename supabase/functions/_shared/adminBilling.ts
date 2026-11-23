/**
 * Regras puras das ações do SuperAdmin em cobranças (cancelar cobrança, cancelar assinatura, estornar). Sem rede e sem banco, para testar.
 * Quem usa: a Edge Function admin-cancel-billing (o orquestrador runChargeAction, no fim deste arquivo) e o webhook (que fecha o registro do estorno).
 */

export type BillingAction = "cancel_charge" | "cancel_subscription" | "refund";
export const BILLING_ACTIONS: BillingAction[] = ["cancel_charge", "cancel_subscription", "refund"];

/** Formas de pagamento cujo estorno automatizamos. Boleto tem fluxo próprio e assíncrono (o pagador informa dados): fica no painel do Asaas. */
export const REFUNDABLE_METHODS = ["PIX", "CREDIT_CARD"];

/** Dois pedidos de estorno da mesma cobrança dentro desta janela são tratados como clique duplo. */
export const REFUND_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Cobrança em aberto: a única que se pode cancelar (paga não se cancela, se estorna). */
export const isOpenChargeStatus = (s: unknown): boolean => ["pending", "overdue"].includes(String(s ?? "").trim().toLowerCase());

/** Motivo digitado pelo admin: sem espaços sobrando, no máximo 300 letras. */
export const cleanReason = (r: unknown): string => String(r ?? "").replace(/\s+/g, " ").trim().slice(0, 300);

const money2 = (n: number) => Math.round(n * 100) / 100;

export type RefundCheck =
  | { ok: true; value: number; full: boolean }
  | { ok: false; code: "not_paid" | "method_not_supported" | "invalid_value" | "value_too_big" };

/**
 * Pode estornar? Só cobrança PAGA, de Pix ou cartão. Sem valor informado é o estorno total; com valor, de 0,01 até o que foi pago.
 * O Asaas ainda confere o saldo e o que já foi estornado antes (soma dos parciais): o erro dele volta para a tela.
 */
export function checkRefund(input: { status: unknown; method: unknown; paidAmount: unknown; value?: unknown }): RefundCheck {
  if (String(input.status ?? "").trim().toLowerCase() !== "paid") return { ok: false, code: "not_paid" };
  if (!REFUNDABLE_METHODS.includes(String(input.method ?? "").trim().toUpperCase())) return { ok: false, code: "method_not_supported" };
  const paid = money2(Number(input.paidAmount));
  if (!(paid > 0)) return { ok: false, code: "invalid_value" };
  if (input.value === undefined || input.value === null || input.value === "") return { ok: true, value: paid, full: true };
  const v = money2(Number(input.value));
  if (!Number.isFinite(v) || v < 0.01) return { ok: false, code: "invalid_value" };
  if (v > paid) return { ok: false, code: "value_too_big" };
  return { ok: true, value: v, full: v === paid };
}

/**
 * Quando o Asaas avisa do estorno, fecha o registro que o SuperAdmin abriu (mb_admin_billing_log): feito, negado ou "em andamento".
 * Estorno pedido direto no painel do Asaas não tem registro nosso: nada a fechar. Nunca lança (o webhook segue).
 */
export async function closeRefundLog(db: any, asaasPaymentId: string, event: string, extra: Record<string, unknown> = {}): Promise<void> {
  const out = refundLogOutcome(event);
  if (!out || !asaasPaymentId) return;
  try {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (out === "done") patch.status = "done";
    else if (out === "failed") patch.status = "failed";
    patch.detail = { event, ...extra };
    await db.from("mb_admin_billing_log").update(patch).eq("action", "refund").eq("asaas_payment_id", asaasPaymentId).eq("status", "requested");
  } catch (e) { console.error("[cobrancas] erro ao fechar o registro do estorno:", (e as Error)?.message); }
}

/** Último valor devolvido que o payload do Asaas informa (payment.refunds[].value). null se o payload não trouxer. */
export function lastRefundValueFromPayload(payment: any): number | null {
  const list = Array.isArray(payment?.refunds) ? payment.refunds : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const v = Number(list[i]?.value);
    if (Number.isFinite(v) && v > 0) return Math.round(v * 100) / 100;
  }
  return null;
}

/**
 * Valor de um estorno PARCIAL: o que o SuperAdmin pediu (registro ainda "solicitado"; ler ANTES de fechar o registro) ou, se o estorno foi feito direto
 * no painel do Asaas, o último valor devolvido do payload. O `payment.value` do webhook é o valor TOTAL do pagamento, e não serve para isto.
 * null se não der para saber. Nunca lança.
 */
export async function partialRefundValue(db: any, asaasPaymentId: string, payment: any): Promise<number | null> {
  try {
    const { data } = await db.from("mb_admin_billing_log").select("amount").eq("action", "refund").eq("asaas_payment_id", asaasPaymentId)
      .eq("status", "requested").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const a = Number(data?.amount);
    if (Number.isFinite(a) && a > 0) return Math.round(a * 100) / 100;
  } catch (e) { console.error("[cobrancas] erro ao ler o valor do estorno parcial:", (e as Error)?.message); }
  return lastRefundValueFromPayload(payment);
}

/** O que o webhook faz com o registro do estorno quando o Asaas avisa. */
export function refundLogOutcome(event: string): "done" | "failed" | "progress" | null {
  switch (event) {
    case "PAYMENT_REFUNDED":
    case "PAYMENT_PARTIALLY_REFUNDED": return "done";
    case "PAYMENT_REFUND_DENIED": return "failed";
    case "PAYMENT_REFUND_IN_PROGRESS": return "progress";
    default: return null;
  }
}

// =====================================================================================================================================
// Ações do SuperAdmin (chamadas pela Edge Function admin-cancel-billing; sessão do SuperAdmin; a chave do Asaas fica nos Secrets):
//   cancel_charge       apaga UMA cobrança aberta no Asaas; a assinatura continua;
//   cancel_subscription cancela a assinatura (acesso até o fim do período, como quando o próprio cliente cancela), com ou sem as cobranças abertas;
//   refund              pede o estorno de uma cobrança PAGA (Pix ou cartão), total ou parcial, e pode cancelar a assinatura junto.
// Toda ação grava uma linha em mb_admin_billing_log ANTES de falar com o Asaas (sem a tabela, recusa) e a fecha depois. O estorno só vira "feito"
// quando o webhook avisa (PAYMENT_REFUNDED); a linha de payments NÃO muda para "refunded" aqui.
// Este módulo não importa nada (para os testes e o tsc do site o carregarem sem Deno): as chamadas ao Asaas e o aviso por e-mail chegam em `ops`.
// =====================================================================================================================================

export interface ChargeOps {
  /** acesso ao Asaas (url, chave) repassado às funções abaixo */
  asaas: any;
  cancelAsaasBilling: (a: any, ids: { customerId: string | null; subscriptionId: string | null }) => Promise<{ subscriptionCanceled: boolean; chargesDeleted: number; failures: string[] }>;
  deleteCharge: (a: any, paymentId: string) => Promise<{ ok: boolean; gone: boolean; error: string | null; body: any }>;
  deleteSubscription: (a: any, subscriptionId: string) => Promise<{ ok: boolean; gone: boolean; error: string | null; body: any }>;
  refundCharge: (a: any, paymentId: string, value?: number, description?: string) => Promise<{ ok: boolean; gone: boolean; error: string | null; body: any }>;
  /** aviso "renovação cancelada, acesso até a data" ao cliente (nunca atrapalha o cancelamento) */
  notifyCanceled: (userId: string, expiresAt: string | null) => Promise<void>;
}

export interface ActionResult { status: number; json: Record<string, unknown> }
const fail = (status: number, code: string, error: string, extra: Record<string, unknown> = {}): ActionResult => ({ status, json: { success: false, code, error, ...extra } });

const LOG = "mb_admin_billing_log";

async function startLog(db: any, row: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await db.from(LOG).insert(row).select("id").single();
  if (error || !data) { console.error("[cobrancas] registro indisponível:", error?.message); return null; }
  return data.id as string;
}
async function finishLog(db: any, id: string, status: "done" | "failed" | "requested", detail: Record<string, unknown>) {
  try { await db.from(LOG).update({ status, detail, updated_at: new Date().toISOString() }).eq("id", id); } catch (e) { console.error("[cobrancas] erro ao fechar o registro:", (e as Error)?.message); }
}
const NO_LOG = () => fail(500, "log_unavailable", "Não foi possível gravar o registro da ação. Rode o script scripts/admin-cobrancas.sql no Supabase e tente de novo.");

/** Cancela a assinatura do cliente (e, se pedido, as cobranças abertas). Devolve o resultado sem lançar. */
async function cancelSubscriptionFlow(db: any, ops: ChargeOps, actorId: string, userId: string, reason: string, cancelCharges: boolean, parentLogId?: string): Promise<ActionResult> {
  const { data: prof } = await db.from("profiles").select("asaas_customer_id, asaas_subscription_id, subscription_status, subscription_expires_at").eq("id", userId).maybeSingle();
  if (!prof) return fail(404, "not_found", "Cliente não encontrado.");
  if (!prof.asaas_subscription_id) return fail(409, "no_subscription", "Este cliente não tem assinatura ativa no Asaas.");
  if (String(prof.subscription_status ?? "").toLowerCase() === "canceled") return fail(409, "already_canceled", "A assinatura deste cliente já está cancelada.");

  const logId = await startLog(db, { actor_id: actorId, action: "cancel_subscription", user_id: userId, asaas_subscription_id: prof.asaas_subscription_id, reason, detail: { cancelCharges, parent: parentLogId ?? null } });
  if (!logId) return NO_LOG();

  let chargesDeleted = 0;
  if (cancelCharges) {
    // assinatura primeiro (para o Asaas parar de gerar cobrança nova) e depois as abertas
    const out = await ops.cancelAsaasBilling(ops.asaas, { customerId: prof.asaas_customer_id ?? null, subscriptionId: prof.asaas_subscription_id });
    if (out.failures.length) { await finishLog(db, logId, "failed", { failures: out.failures }); return fail(502, "asaas_failed", out.failures.join(" | ")); }
    chargesDeleted = out.chargesDeleted;
  } else {
    const out = await ops.deleteSubscription(ops.asaas, prof.asaas_subscription_id);
    if (!out.ok) { await finishLog(db, logId, "failed", { error: out.error }); return fail(502, "asaas_failed", out.error || "Asaas recusou cancelar a assinatura."); }
  }

  // o vínculo com a assinatura FICA: o evento de exclusão do Asaas chega ao webhook, que também revoga recompensas de indicação e a comissão do parceiro
  await db.from("profiles").update({ subscription_status: "canceled" }).eq("id", userId).neq("subscription_status", "blocked");
  if (cancelCharges) {
    await db.from("payments").update({ status: "canceled" }).eq("user_id", userId).in("status", ["pending", "overdue"]);
    await db.from("profiles").update({ overdue_since: null }).eq("id", userId);
  }
  try { await ops.notifyCanceled(userId, prof.subscription_expires_at ?? null); } catch (e) { console.error("[cobrancas] erro ao avisar o cancelamento:", (e as Error)?.message); }

  await finishLog(db, logId, "done", { chargesDeleted });
  return { status: 200, json: { success: true, chargesDeleted, accessUntil: prof.subscription_expires_at ?? null } };
}

export async function runChargeAction(db: any, ops: ChargeOps, actorId: string, body: any): Promise<ActionResult> {
  const reason = cleanReason(body?.reason);
  const mode = String(body?.mode ?? "");

  // ---- cancelar UMA cobrança ------------------------------------------------------------------------------------------------------------
  if (mode === "cancel_charge") {
    if (!isUuid(body?.paymentId)) return fail(400, "invalid_input", "Cobrança inválida.");
    const { data: row } = await db.from("payments").select("id, user_id, amount, status, asaas_payment_id").eq("id", body.paymentId).maybeSingle();
    if (!row) return fail(404, "not_found", "Cobrança não encontrada.");
    if (!isOpenChargeStatus(row.status)) return fail(409, "not_open", "Só dá para cancelar cobrança pendente ou vencida. Cobrança paga se estorna.");
    if (!row.asaas_payment_id) return fail(409, "no_asaas_id", "Esta cobrança não tem id no Asaas.");

    const logId = await startLog(db, { actor_id: actorId, action: "cancel_charge", user_id: row.user_id, payment_id: row.id, asaas_payment_id: row.asaas_payment_id, amount: row.amount, reason });
    if (!logId) return NO_LOG();
    const out = await ops.deleteCharge(ops.asaas, row.asaas_payment_id);
    if (!out.ok) { await finishLog(db, logId, "failed", { error: out.error }); return fail(502, "asaas_failed", out.error || "Asaas recusou apagar a cobrança."); }

    await db.from("payments").update({ status: "canceled" }).eq("id", row.id).in("status", ["pending", "overdue"]);
    // se era a única vencida, o atraso acaba: a rotina não suspende quem não deve mais nada
    if (row.user_id) {
      const { data: other } = await db.from("payments").select("id").eq("user_id", row.user_id).eq("status", "overdue").neq("id", row.id).limit(1).maybeSingle();
      if (!other) await db.from("profiles").update({ overdue_since: null }).eq("id", row.user_id);
    }
    await finishLog(db, logId, "done", { alreadyGone: out.gone });
    return { status: 200, json: { success: true } };
  }

  // ---- cancelar a assinatura ------------------------------------------------------------------------------------------------------------
  if (mode === "cancel_subscription") {
    if (!isUuid(body?.userId)) return fail(400, "invalid_input", "Cliente inválido.");
    return await cancelSubscriptionFlow(db, ops, actorId, body.userId, reason, body?.cancelCharges !== false);
  }

  // ---- estornar (Pix e cartão) ----------------------------------------------------------------------------------------------------------
  if (mode === "refund") {
    if (!isUuid(body?.paymentId)) return fail(400, "invalid_input", "Cobrança inválida.");
    if (!reason) return fail(400, "reason_required", "Informe o motivo do estorno.");
    const { data: row } = await db.from("payments").select("id, user_id, amount, status, billing_type, asaas_payment_id").eq("id", body.paymentId).maybeSingle();
    if (!row) return fail(404, "not_found", "Cobrança não encontrada.");
    const check = checkRefund({ status: row.status, method: row.billing_type, paidAmount: row.amount, value: body?.value });
    if (!check.ok) {
      const msg: Record<string, string> = {
        not_paid: "Só dá para estornar cobrança paga.",
        method_not_supported: "Só estornamos Pix e cartão por aqui. Boleto se estorna no painel do Asaas.",
        invalid_value: "Valor do estorno inválido.",
        value_too_big: "O valor do estorno não pode passar do que foi pago.",
      };
      const code = (check as { code: string }).code; // o editor do painel compila sem "strict" e não estreita a união
      return fail(400, code, msg[code]);
    }
    if (!row.asaas_payment_id) return fail(409, "no_asaas_id", "Esta cobrança não tem id no Asaas.");

    // clique duplo: já existe um pedido de estorno desta cobrança aguardando o Asaas
    const since = new Date(Date.now() - REFUND_DUPLICATE_WINDOW_MS).toISOString();
    const { data: dup } = await db.from(LOG).select("id").eq("action", "refund").eq("payment_id", row.id).eq("status", "requested").gte("created_at", since).limit(1).maybeSingle();
    if (dup) return fail(409, "duplicate", "Já há um estorno desta cobrança aguardando o Asaas. Espere a confirmação.");

    const logId = await startLog(db, { actor_id: actorId, action: "refund", user_id: row.user_id, payment_id: row.id, asaas_payment_id: row.asaas_payment_id, amount: check.value, reason, detail: { full: check.full } });
    if (!logId) return NO_LOG();
    const out = await ops.refundCharge(ops.asaas, row.asaas_payment_id, check.full ? undefined : check.value, reason);
    if (!out.ok) { await finishLog(db, logId, "failed", { error: out.error }); return fail(502, "asaas_failed", out.error || "Asaas recusou o estorno."); }
    // fica "requested": quem confirma é o webhook do Asaas
    await finishLog(db, logId, "requested", { full: check.full, asaasStatus: out.body?.status ?? null });

    let subscription: Record<string, unknown> | null = null;
    if (body?.cancelSubscription && row.user_id) {
      const r = await cancelSubscriptionFlow(db, ops, actorId, row.user_id, reason, true, logId);
      subscription = { ok: r.status === 200, error: r.status === 200 ? null : (r.json.error ?? null) };
    }
    return { status: 200, json: { success: true, requested: true, full: check.full, value: check.value, subscription } };
  }

  return fail(400, "invalid_input", "Ação desconhecida.");
}
