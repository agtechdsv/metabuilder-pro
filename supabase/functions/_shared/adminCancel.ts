/**
 * Cancelamento de cobrança no Asaas feito pelo SuperAdmin ao bloquear ou excluir um cliente.
 * Só fala com o Asaas (nada de banco aqui), para ser testável com um `fetch` falso.
 *
 * Ordem do cancelamento: 1) a assinatura (para o Asaas parar de gerar cobranças novas); 2) as cobranças já geradas e ainda abertas
 * (pendentes ou vencidas), porque um Pix aberto poderia ser pago depois que a conta deixou de existir. Cobrança já paga não é
 * mexida (devolver dinheiro é estorno, e é decisão à parte, no painel do Asaas).
 */

export interface OpenCharge { id: string; status: string; value: number; dueDate: string | null }
export interface BillingInspection { hasBilling: boolean; hasSubscription: boolean; chargeCount: number; chargeTotal: number }
export interface CancelOutcome { subscriptionCanceled: boolean; chargesDeleted: number; failures: string[] }
export interface AsaasAccess { url: string; key: string; fetcher?: typeof fetch }
export interface BillingIds { customerId: string | null; subscriptionId: string | null }

/** Situações em que o Asaas aceita apagar a cobrança. */
export const OPEN_CHARGE_STATUSES = ["PENDING", "OVERDUE"];

/** 404 = já não existe no Asaas: para o nosso fim é o mesmo que cancelado. */
export const isAlreadyGone = (httpStatus: number) => httpStatus === 404;

async function asaasCall(a: AsaasAccess, method: string, path: string): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await (a.fetcher ?? fetch)(`${a.url}${path}`, { method, headers: { access_token: a.key, "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const asaasError = (body: any, fallback: string) => String(body?.errors?.[0]?.description || fallback);

/** Cobranças abertas do cliente (por cliente do Asaas; sem ele, pela assinatura). Páginas de 100, até 10 páginas. */
export async function listOpenCharges(a: AsaasAccess, ids: BillingIds): Promise<OpenCharge[]> {
  const found: OpenCharge[] = [];
  for (const status of OPEN_CHARGE_STATUSES) {
    for (let offset = 0; offset < 1000; offset += 100) {
      const base = ids.customerId ? `/payments?customer=${encodeURIComponent(ids.customerId)}` : ids.subscriptionId ? `/subscriptions/${encodeURIComponent(ids.subscriptionId)}/payments?` : "";
      if (!base) return found;
      const sep = base.endsWith("?") ? "" : "&";
      const r = await asaasCall(a, "GET", `${base}${sep}status=${status}&limit=100&offset=${offset}`);
      if (!r.ok) throw new Error(asaasError(r.body, `Asaas respondeu ${r.status} ao listar as cobranças`));
      for (const p of r.body?.data ?? []) found.push({ id: String(p.id), status: String(p.status ?? status), value: Number(p.value) || 0, dueDate: p.dueDate ? String(p.dueDate) : null });
      if (!r.body?.hasMore) break;
    }
  }
  return found;
}

/** O que seria cancelado, sem cancelar nada (para o aviso antes de confirmar). */
export async function inspectAsaasBilling(a: AsaasAccess, ids: BillingIds): Promise<BillingInspection> {
  if (!ids.customerId && !ids.subscriptionId) return { hasBilling: false, hasSubscription: false, chargeCount: 0, chargeTotal: 0 };
  const charges = await listOpenCharges(a, ids);
  const total = charges.reduce((s, c) => s + c.value, 0);
  return { hasBilling: true, hasSubscription: !!ids.subscriptionId, chargeCount: charges.length, chargeTotal: Math.round(total * 100) / 100 };
}

/** Cancela a assinatura e apaga as cobranças abertas. Nunca lança: o que não deu certo vai em `failures`. */
export async function cancelAsaasBilling(a: AsaasAccess, ids: BillingIds): Promise<CancelOutcome> {
  const out: CancelOutcome = { subscriptionCanceled: false, chargesDeleted: 0, failures: [] };
  if (ids.subscriptionId) {
    const r = await asaasCall(a, "DELETE", `/subscriptions/${encodeURIComponent(ids.subscriptionId)}`);
    if (r.ok || isAlreadyGone(r.status)) out.subscriptionCanceled = true;
    else {
      // sem cancelar a assinatura o Asaas continuaria gerando cobranças: apagar as de agora não adiantaria
      out.failures.push(`Assinatura: ${asaasError(r.body, `Asaas respondeu ${r.status}`)}`);
      return out;
    }
  }
  let open: OpenCharge[] = [];
  try { open = await listOpenCharges(a, ids); } catch (e: any) { out.failures.push(`Cobranças: ${e?.message || "não foi possível listar"}`); return out; }
  for (const c of open) {
    try {
      const r = await asaasCall(a, "DELETE", `/payments/${encodeURIComponent(c.id)}`);
      if (r.ok || isAlreadyGone(r.status)) out.chargesDeleted++;
      else out.failures.push(`Cobrança ${c.id}: ${asaasError(r.body, `Asaas respondeu ${r.status}`)}`);
    } catch (e: any) { out.failures.push(`Cobrança ${c.id}: ${e?.message || "falha de rede"}`); }
  }
  return out;
}
