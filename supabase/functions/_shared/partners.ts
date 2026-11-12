/**
 * Programa de parceiros nas Edge Functions (Deno): gera a comissão quando o indicado paga, revoga no estorno e aplica os eventos de
 * transferência do Asaas aos itens do lote. Regras puras em partnerCommission.ts; SQL em scripts/parceiros.sql.
 */
import { commissionAmount, releaseDate, resolvePercent } from "./partnerCommission.ts";

async function setting(supabase: any, key: string, field: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const v = Number(data?.value?.[field]);
  return Number.isFinite(v) ? v : fallback;
}

/**
 * O indicado de um parceiro pagou: grava a comissão (% sobre o valor LÍQUIDO), disponível depois da carência. Idempotente por pagamento
 * (o Asaas manda PAYMENT_CONFIRMED e PAYMENT_RECEIVED para o mesmo pagamento). Devolve true se gravou uma comissão nova.
 */
export async function recordPartnerCommission(supabase: any, referredUserId: string, payment: { id?: string; value?: number; netValue?: number }): Promise<boolean> {
  if (!payment?.id) return false;
  const { data: prof } = await supabase.from("profiles").select("email").eq("id", referredUserId).maybeSingle();
  const email = (prof?.email || "").toLowerCase();

  const { data: ref } = await supabase.from("partner_referrals").select("id, partner_id, status")
    .in("status", ["registered", "subscribed"]).or(`referred_id.eq.${referredUserId}${email ? `,referred_email.eq.${email}` : ""}`).maybeSingle();
  if (!ref) return false;

  const { data: partner } = await supabase.from("partners").select("id, status, commission_percent").eq("id", ref.partner_id).maybeSingle();
  if (!partner || partner.status !== "active") return false;

  const gross = Number(payment.value) || 0;
  const net = Number(payment.netValue) > 0 ? Number(payment.netValue) : gross;
  const defaultPercent = await setting(supabase, "partner_default_percent", "percent", 20);
  const percent = resolvePercent(partner.commission_percent, defaultPercent);
  const amount = commissionAmount(net, percent);
  if (amount <= 0) return false;

  const graceDays = await setting(supabase, "partner_grace_days", "days", 7);
  const now = new Date();
  const { data: inserted, error } = await supabase.from("partner_commissions").upsert({
    partner_id: partner.id, referral_id: ref.id, asaas_payment_id: payment.id, gross, net, percent, amount,
    status: "pending", release_at: releaseDate(now, graceDays).toISOString(),
  }, { onConflict: "asaas_payment_id", ignoreDuplicates: true }).select("id");
  if (error) { console.error("[parceiros] erro ao gravar a comissão:", error.message); return false; }

  // primeira cobrança paga: a indicação passa a "assinante"
  if (ref.status === "registered") {
    await supabase.from("partner_referrals").update({ referred_id: referredUserId, status: "subscribed", paid_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", ref.id).eq("status", "registered");
  }
  return (inserted?.length || 0) > 0;
}

/**
 * Estorno ou reembolso de um pagamento: a comissão dele deixa de valer. Se ainda não saiu (pendente), é revogada; se já está num lote ou foi paga,
 * fica marcada como "clawback" e o valor é descontado do próximo lote do parceiro.
 */
export async function revokePartnerCommissionForPayment(supabase: any, asaasPaymentId: string, reason: string): Promise<void> {
  if (!asaasPaymentId) return;
  const { data: c } = await supabase.from("partner_commissions").select("id, status, clawback").eq("asaas_payment_id", asaasPaymentId).maybeSingle();
  if (!c || c.status === "revoked") return;
  const now = new Date().toISOString();
  if (c.status === "pending") {
    await supabase.from("partner_commissions").update({ status: "revoked", revoked_reason: reason, updated_at: now }).eq("id", c.id).eq("status", "pending");
  } else if (!c.clawback) {
    await supabase.from("partner_commissions").update({ clawback: true, revoked_reason: reason, updated_at: now }).eq("id", c.id);
  }
}

/** O indicado cancelou a assinatura: não gera comissão dos próximos pagamentos (as já geradas continuam valendo). */
export async function cancelPartnerReferral(supabase: any, referredUserId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabase.from("partner_referrals").update({ status: "canceled", canceled_at: now, updated_at: now })
    .eq("referred_id", referredUserId).in("status", ["registered", "subscribed"]);
}

/** Evento TRANSFER_* do Asaas: conclui ou falha o item do lote que tem esse id de transferência. Idempotente. */
export async function applyTransferEvent(supabase: any, event: string, transfer: any): Promise<void> {
  if (!transfer?.id) return;
  const { data: item } = await supabase.from("partner_payout_items").select("id, status").eq("asaas_transfer_id", transfer.id).maybeSingle();
  if (!item) return;
  if (event === "TRANSFER_DONE") {
    await supabase.rpc("mb_partner_finish_item", { p_item_id: item.id, p_receipt: transfer.transactionReceiptUrl ?? null });
  } else if (event === "TRANSFER_FAILED" || event === "TRANSFER_CANCELLED" || event === "TRANSFER_BLOCKED") {
    // bloqueada pode ser liberada depois pelo Asaas; só marcamos falha nos estados finais
    if (event === "TRANSFER_BLOCKED") { await supabase.from("partner_payout_items").update({ fail_reason: "Bloqueada pelo Asaas (aguarde ou verifique no painel do Asaas)", updated_at: new Date().toISOString() }).eq("id", item.id); return; }
    await supabase.rpc("mb_partner_fail_item", { p_item_id: item.id, p_reason: transfer.failReason || event });
  } else if (event === "TRANSFER_PENDING" || event === "TRANSFER_IN_BANK_PROCESSING" || event === "TRANSFER_CREATED") {
    if (item.status === "sending") await supabase.from("partner_payout_items").update({ status: "sent", updated_at: new Date().toISOString() }).eq("id", item.id);
  }
}
