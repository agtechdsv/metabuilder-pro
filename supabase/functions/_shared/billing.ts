/**
 * Avisos de cobranca nas Edge Functions (Deno): coloca o aviso na FILA (billing_notices) e cutuca o site para enviar na hora.
 * O e-mail em si sai pelo site (Next), que tem o SMTP: aqui so se enfileira. Se o site nao responder, a rotina diaria envia o que sobrou.
 * Regras puras em billingCore.ts; SQL em scripts/avisos-cobranca.sql.
 */
import { type BillingSettings, DEFAULT_BILLING_SETTINGS, type NoticeKind, parseBillingSettings } from "./billingCore.ts";

/** Ajustes dos avisos (desligados por padrao). Qualquer falha de leitura = desligado = comportamento antigo. */
export async function billingSettings(supabase: any): Promise<BillingSettings> {
  try {
    const { data } = await supabase.from("platform_settings").select("value").eq("key", "billing_notices").maybeSingle();
    return parseBillingSettings(data?.value);
  } catch {
    return { ...DEFAULT_BILLING_SETTINGS };
  }
}

/** Enfileira um aviso. Unico por (tipo, referencia): evento repetido nao duplica. Desligado = nao faz nada. Devolve true se entrou na fila agora. */
export async function queueNotice(
  supabase: any,
  cfg: BillingSettings,
  n: { kind: NoticeKind; userId?: string | null; ref: string; payload?: Record<string, unknown> },
): Promise<boolean> {
  if (!cfg.enabled) return false;
  try {
    const { data, error } = await supabase
      .from("billing_notices")
      .upsert({ user_id: n.userId ?? null, kind: n.kind, ref: n.ref, payload: n.payload ?? {} }, { onConflict: "kind,ref", ignoreDuplicates: true })
      .select("id");
    if (error) { console.error("[avisos] falha ao enfileirar:", error.message); return false; }
    return (data?.length ?? 0) > 0;
  } catch (e) {
    console.error("[avisos] erro ao enfileirar:", (e as Error)?.message);
    return false;
  }
}

/** Pede ao site para enviar a fila agora. Sem as variaveis, ou se falhar, a rotina diaria envia depois (nunca trava o webhook). */
export async function pingNotify(): Promise<void> {
  const url = Deno.env.get("BILLING_NOTIFY_URL")?.trim();
  const secret = Deno.env.get("BILLING_NOTIFY_SECRET")?.trim();
  if (!url || !secret) return;
  try {
    await fetch(url, { method: "POST", headers: { "x-billing-secret": secret, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(5000) });
  } catch (e) {
    console.error("[avisos] o site nao respondeu ao aviso de envio (a rotina diaria envia depois):", (e as Error)?.message);
  }
}
