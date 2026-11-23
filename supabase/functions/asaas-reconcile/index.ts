import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { OPEN_ASAAS_STATUSES, classifyGone, planOpenCharge, type AsaasCharge } from "../_shared/reconcile.ts";

/**
 * Conciliação diária das cobranças com o Asaas (regras em ../_shared/reconcile.ts). Chamada todo dia pelo cron do site (/api/cron/asaas-reconcile) com a
 * chave de serviço no cabeçalho Authorization; a chave do Asaas fica só aqui, nos Secrets.
 *
 * Para cada assinante ativo (ou suspenso) com assinatura no Asaas:
 *  - cobranças ABERTAS (pendentes e vencidas) do Asaas que não existem aqui são gravadas em `payments` (a renovação que o webhook deixou passar);
 *  - as que existem e divergem (vencimento, valor, pendente x vencida) são ajustadas, só se estiverem abertas aqui;
 *  - cobrança aberta aqui que o Asaas já não lista: apagada no Asaas vira "canceled"; PAGA no Asaas só é relatada (o webhook é quem registra pagamento).
 * Roda em lotes (cursor `after` = último id de perfil); a resposta traz `next` (null quando acabou).
 */
const BATCH = 25;
const MAX_GONE_CHECKS = 10; // por assinante, para não gastar a cota do Asaas
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  const serviceKey = (Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "");
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!serviceKey || bearer !== serviceKey) return json({ error: "Unauthorized" }, 401);

  const asaasKey = Deno.env.get("ASAAS_API_KEY")?.trim();
  if (!asaasKey) return json({ error: "Chave de API do Asaas não configurada" }, 500);
  const asaasUrl = Deno.env.get("ASAAS_URL")?.trim() || "https://api.asaas.com/v3";
  const asaas = async (path: string) => fetch(`${asaasUrl}${path}`, { headers: { access_token: asaasKey } });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
    const body = await req.json().catch(() => ({}));
    const after = typeof body?.after === "string" && /^[0-9a-f-]{36}$/i.test(body.after) ? body.after : null;

    let q = supabase.from("profiles").select("id, asaas_subscription_id, subscription_cycle")
      .in("subscription_status", ["active", "blocked"]).not("asaas_subscription_id", "is", null).gt("subscription_licenses", 0)
      .order("id", { ascending: true }).limit(BATCH);
    if (after) q = q.gt("id", after);
    const { data: profiles, error: profErr } = await q;
    if (profErr) throw profErr;

    const out = { scanned: 0, inserted: 0, updated: 0, canceled: 0, paidNotRecorded: [] as string[], failures: [] as string[] };

    for (const p of profiles || []) {
      out.scanned++;
      try {
        // 1) cobranças abertas do Asaas
        const open: AsaasCharge[] = [];
        for (const st of OPEN_ASAAS_STATUSES) {
          const r = await asaas(`/payments?subscription=${encodeURIComponent(p.asaas_subscription_id)}&status=${st}&limit=100`);
          if (!r.ok) throw new Error(`Asaas ${r.status} ao listar ${st}`);
          for (const c of (await r.json())?.data ?? []) open.push(c as AsaasCharge);
        }
        const openIds = new Set(open.map(c => c.id));

        // 2) o que já existe aqui
        const { data: existing } = openIds.size
          ? await supabase.from("payments").select("id, status, due_date, amount, asaas_payment_id").in("asaas_payment_id", Array.from(openIds))
          : { data: [] as any[] };
        const local = new Map((existing || []).map((r: any) => [r.asaas_payment_id as string, r]));

        for (const c of open) {
          const plan = planOpenCharge(c, local.get(c.id) ?? null, p.id, p.subscription_cycle);
          if (plan.kind === "insert") {
            const { error } = await supabase.from("payments").insert(plan.row);
            if (error && error.code !== "23505") { out.failures.push(`${c.id}: ${error.message}`); continue; } // 23505 = já gravada por outro caminho
            if (!error) {
              out.inserted++;
              // renovação vencida que o webhook nunca viu: começa a contagem do atraso (a suspensão segue a carência, como no webhook)
              if (plan.row.status === "overdue") await supabase.from("profiles").update({ overdue_since: new Date().toISOString() }).eq("id", p.id).is("overdue_since", null);
            }
          } else if (plan.kind === "patch") {
            const { error } = await supabase.from("payments").update(plan.patch).eq("asaas_payment_id", c.id).in("status", ["pending", "overdue"]);
            if (error) out.failures.push(`${c.id}: ${error.message}`); else out.updated++;
          }
        }

        // 3) aberta aqui, mas o Asaas já não lista como aberta
        const { data: localOpen } = await supabase.from("payments").select("id, asaas_payment_id").eq("user_id", p.id).in("status", ["pending", "overdue"]).not("asaas_payment_id", "is", null).limit(50);
        let checks = 0;
        for (const row of (localOpen || []) as any[]) {
          if (openIds.has(row.asaas_payment_id) || checks >= MAX_GONE_CHECKS) continue;
          checks++;
          const r = await asaas(`/payments/${encodeURIComponent(row.asaas_payment_id)}`);
          const kind = classifyGone(r.status, r.ok ? await r.json().catch(() => null) : null);
          if (kind === "deleted") {
            const { error } = await supabase.from("payments").update({ status: "canceled", webhook_processed: true }).eq("id", row.id).in("status", ["pending", "overdue"]);
            if (!error) out.canceled++;
          } else if (kind === "paid") {
            out.paidNotRecorded.push(row.asaas_payment_id);
            console.error(`[asaas-reconcile] ATENÇÃO: ${row.asaas_payment_id} está PAGA no Asaas e aberta aqui (o webhook de pagamento não foi processado)`);
          }
        }
      } catch (e) {
        out.failures.push(`${p.id}: ${(e as Error)?.message}`);
        console.error("[asaas-reconcile] erro ao conciliar", p.id, (e as Error)?.message);
      }
    }

    const next = (profiles?.length || 0) >= BATCH ? profiles![profiles!.length - 1].id : null;
    return json({ success: true, ...out, next });
  } catch (e: any) {
    console.error("[asaas-reconcile] erro:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
