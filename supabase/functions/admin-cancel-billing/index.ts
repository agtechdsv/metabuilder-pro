// Cancelamento de cobrança de um cliente, pedido pelo SuperAdmin (tela Clientes: bloquear ou excluir).
//   POST { userId, mode: "inspect" | "cancel", purpose?: "block" | "delete" }
//   inspect: diz o que seria cancelado (assinatura e cobranças abertas), sem mexer em nada.
//   cancel : cancela a assinatura no Asaas e apaga as cobranças abertas. Com purpose "delete" também faz o que o webhook faria depois
//            (revoga prêmios do iClub e cancela a indicação do parceiro), porque o usuário vai deixar de existir e o webhook não o acharia.
// Só o SuperAdmin chama (confere a sessão); a chave do Asaas fica aqui, nos Secrets, e nunca vai ao navegador.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { revokeReferralRewards, syncNextCharge } from "../_shared/iclub.ts";
import { cancelPartnerReferral } from "../_shared/partners.ts";
import { cancelAsaasBilling, inspectAsaasBilling } from "../_shared/adminCancel.ts";
import { isCheckoutOnly } from "../_shared/billingCore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const serviceRoleKey = Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const db = createClient(url, serviceRoleKey);
    const body = await req.json().catch(() => ({}));

    // Chamada do SERVIDOR do site (rotina diária de avisos): vem com a chave de serviço no lugar da sessão de um usuário. Só vale para o purpose
    // "abandoned" (cobrança de quem abriu o checkout e nunca pagou); o resto exige o SuperAdmin, como sempre.
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceKeys = [Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim(), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim()].filter(Boolean) as string[];
    const fromServer = !!bearer && serviceKeys.includes(bearer);
    if (fromServer) {
      if (body?.purpose !== "abandoned") return json({ error: "A chave de serviço só pode cancelar cobrança abandonada." }, 403);
    } else {
      const asUser = createClient(url, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: userError } = await asUser.auth.getUser();
      if (userError || !user) return json({ error: "Invalid user token" }, 401);
      const { data: caller } = await db.from("profiles").select("is_super_admin").eq("id", user.id).maybeSingle();
      if (!caller?.is_super_admin) return json({ error: "Apenas o SuperAdmin pode fazer isto." }, 403);
    }

    const userId = String(body?.userId || "");
    const mode = body?.mode === "cancel" ? "cancel" : body?.mode === "inspect" ? "inspect" : "";
    if (!userId || !mode) return json({ error: "Informe userId e mode (inspect ou cancel)." }, 400);

    const { data: target } = await db.from("profiles").select("asaas_customer_id, asaas_subscription_id, subscription_tier").eq("id", userId).maybeSingle();
    if (!target) return json({ error: "Cliente não encontrado." }, 404);

    // "abandoned": o servidor pede, mas a função confere sozinha. FREE e SEM nenhum pagamento recebido; quem já pagou alguma vez nunca é tocado.
    if (body?.purpose === "abandoned") {
      const { count: paidCount } = await db.from("payments").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "paid");
      if (!isCheckoutOnly(target.subscription_tier, paidCount ?? 0)) return json({ error: "Este cliente já pagou ou tem plano: a cobrança não é abandonada." }, 409);
    }

    const ids = { customerId: target.asaas_customer_id ?? null, subscriptionId: target.asaas_subscription_id ?? null };
    const apiKey = Deno.env.get("ASAAS_API_KEY")?.trim();
    if (!apiKey && (ids.customerId || ids.subscriptionId)) return json({ error: "Chave de API do Asaas não configurada" }, 500);
    const asaas = { url: Deno.env.get("ASAAS_URL")?.trim() || "https://api.asaas.com/v3", key: apiKey || "" };

    if (mode === "inspect") {
      const info = await inspectAsaasBilling(asaas, ids);
      return json({ success: true, ...info });
    }

    if (!ids.customerId && !ids.subscriptionId) return json({ success: true, subscriptionCanceled: false, chargesDeleted: 0, failures: [] });

    if (body?.purpose === "abandoned") {
      // O vínculo com a assinatura sai do perfil ANTES: o evento de exclusão que o Asaas manda não é atribuído ao cliente (não marca "cancelado" nem
      // mexe em indicação/recompensas). Se o cancelamento falhar, o vínculo volta e a rotina tenta de novo no dia seguinte.
      if (ids.subscriptionId) await db.from("profiles").update({ asaas_subscription_id: null }).eq("id", userId);
      const res = await cancelAsaasBilling(asaas, ids);
      if (res.failures.length) {
        if (ids.subscriptionId) await db.from("profiles").update({ asaas_subscription_id: ids.subscriptionId }).eq("id", userId);
        return json({ success: false, error: res.failures.join(" | "), ...res }, 502);
      }
      // o Asaas apagou; aqui as cobranças abertas viram "canceled" (não há tratamento do evento de cobrança excluída no webhook), e saem do aviso e dos lembretes
      await db.from("payments").update({ status: "canceled" }).eq("user_id", userId).in("status", ["pending", "overdue"]);
      console.log(`[admin-cancel-billing] ${userId}: cobranca abandonada cancelada (assinatura=${res.subscriptionCanceled} cobrancas=${res.chargesDeleted})`);
      return json({ success: true, ...res });
    }

    const out = await cancelAsaasBilling(asaas, ids);
    if (out.failures.length) return json({ success: false, error: out.failures.join(" | "), ...out }, 502);

    if (body?.purpose === "delete") {
      try { for (const referrerId of await revokeReferralRewards(db, userId)) await syncNextCharge(db, referrerId); } catch (e) { console.error("[iClub] erro ao revogar recompensas:", e); }
      try { await cancelPartnerReferral(db, userId); } catch (e) { console.error("[parceiros] erro ao cancelar a indicação:", e); }
    }
    console.log(`[admin-cancel-billing] ${userId}: assinatura=${out.subscriptionCanceled} cobrancas=${out.chargesDeleted} (${body?.purpose || "?"})`);
    return json({ success: true, ...out });
  } catch (error: any) {
    return json({ error: error?.message || "Erro interno do servidor" }, 500);
  }
});
