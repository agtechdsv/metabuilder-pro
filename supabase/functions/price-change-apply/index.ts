import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { loadRules, syncNextCharge } from "../_shared/iclub.ts";
import { campaignUnitPriceFor } from "../_shared/pricing.ts";

/**
 * Reajuste de preços agendado (tabela pricing_changes; ver scripts/reajuste-precos.sql). Chamada todo dia pelo cron do site (/api/cron/price-change)
 * com a chave de serviço no cabeçalho Authorization; a chave do Asaas fica só aqui, nos Secrets.
 *
 *  1) Chegou a data de vigência (dia de Brasília)? Trava o preço promocional de quem comprou em campanha (com a tabela ANTIGA), grava a regra nova em
 *     pricing_rules e marca o reajuste como "applied". Se qualquer passo falhar, o reajuste continua "scheduled" e a rotina tenta de novo no dia seguinte.
 *  2) Recalcula as assinaturas ativas em lotes (o Asaas é lento): o valor da assinatura e as cobranças ABERTAS com vencimento a partir da vigência.
 *     Cobrança com vencimento anterior (vencida, ou já paga) nunca é tocada. Cada cliente recalculado fica marcado em profiles.price_change_synced_id,
 *     então a chamada pode se repetir até acabar (`pending: false`).
 */
const BATCH = 20;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const todayInBrasilia = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

serve(async (req) => {
  const serviceKey = (Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "");
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!serviceKey || bearer !== serviceKey) return json({ error: "Unauthorized" }, 401);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
    const today = todayInBrasilia();
    let applied = 0;

    // 1) aplica o reajuste que chegou na data
    const { data: due, error: dueErr } = await supabase.from("pricing_changes").select("*").eq("status", "scheduled").lte("effective_on", today).order("effective_on", { ascending: true }).limit(1);
    if (dueErr) throw dueErr;
    for (const change of due || []) {
      const oldRules = await loadRules(supabase);
      if (!oldRules) throw new Error("Regras de preço não encontradas");

      // trava o preço promocional de quem ainda não o tem, com a tabela de antes do reajuste
      const { data: toFreeze, error: frzErr } = await supabase.from("profiles").select("id, campaign_percent").not("campaign_id", "is", null).is("campaign_unit_price", null);
      if (frzErr) throw frzErr;
      for (const p of toFreeze || []) {
        const price = campaignUnitPriceFor(oldRules, p.campaign_percent ?? 50);
        const { error } = await supabase.from("profiles").update({ campaign_unit_price: price }).eq("id", p.id);
        if (error) throw error;
      }

      const r = change.rules || {};
      const { error: ruleErr } = await supabase.from("pricing_rules").update({
        base_price: r.base_price, volume_tiers: r.volume_tiers, cycle_discounts: r.cycle_discounts, updated_at: new Date().toISOString(),
      }).eq("id", (oldRules as any).id); // loadRules devolve a linha inteira (select *), mas o tipo PricingRules não declara o id
      if (ruleErr) throw ruleErr;

      const now = new Date().toISOString();
      const { error: markErr } = await supabase.from("pricing_changes").update({ status: "applied", applied_at: now, updated_at: now }).eq("id", change.id).eq("status", "scheduled");
      if (markErr) throw markErr;
      applied++;
      console.log(`[price-change-apply] reajuste ${change.id} aplicado: base ${change.old_base_price} -> ${change.new_base_price} (vigência ${change.effective_on})`);
    }

    // 2) recalcula as assinaturas, em lotes, do reajuste aplicado mais antigo ainda não recalculado por inteiro
    let resynced = 0;
    let failed = 0;
    let pending = false;
    const { data: open, error: openErr } = await supabase.from("pricing_changes").select("id, effective_on").eq("status", "applied").eq("resync_done", false).order("applied_at", { ascending: true }).limit(1);
    if (openErr) throw openErr;
    const change = open?.[0];
    if (change) {
      const { data: users, error: usersErr } = await supabase.from("profiles").select("id")
        .not("asaas_subscription_id", "is", null).neq("subscription_status", "canceled")
        .or(`price_change_synced_id.is.null,price_change_synced_id.neq.${change.id}`).order("id", { ascending: true }).limit(BATCH);
      if (usersErr) throw usersErr;
      for (const u of users || []) {
        // só dá o cliente como sincronizado se o Asaas aceitou tudo; senão ele fica na fila e a rotina tenta de novo no dia seguinte
        const failures: string[] = [];
        try { await syncNextCharge(supabase, u.id, { fromDueDate: change.effective_on, failures }); } catch (e) { failures.push((e as Error)?.message || "erro"); }
        if (failures.length > 0) {
          console.error("[price-change-apply] recálculo incompleto, será tentado de novo:", u.id, failures.join(" | "));
          failed++;
          continue;
        }
        await supabase.from("profiles").update({ price_change_synced_id: change.id }).eq("id", u.id);
        resynced++;
      }
      pending = (users?.length || 0) >= BATCH;
      // com falha, o reajuste continua "não recalculado por inteiro": a próxima rodada tenta de novo só quem falhou
      if (!pending && failed === 0) await supabase.from("pricing_changes").update({ resync_done: true, updated_at: new Date().toISOString() }).eq("id", change.id);
    }

    return json({ success: true, applied, resynced, failed, pending });
  } catch (e: any) {
    console.error("[price-change-apply] erro:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
