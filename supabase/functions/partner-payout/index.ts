import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

/**
 * Envia ao Asaas, por Pix, os itens de um lote de pagamento de parceiros. Quem chama é a server action do site, DEPOIS de conferir que a pessoa é
 * SuperAdmin e de montar o lote (mb_partner_create_payout): aqui só se confere a chave de serviço no cabeçalho Authorization.
 * A chave do Asaas (ASAAS_API_KEY, com a permissão de transferência) mora só nesta função. Cada item é enviado UMA vez: só sai o que está "pending",
 * e vira "sending" antes da chamada; se algo falhar no meio, o item fica visível como "sending" para o SuperAdmin decidir (nunca reenvia sozinho).
 */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  const serviceKey = (Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "");
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!serviceKey || bearer !== serviceKey) return json({ error: "Unauthorized" }, 401);

  try {
    const { payout_id } = await req.json().catch(() => ({}));
    if (!payout_id || typeof payout_id !== "string") return json({ error: "payout_id obrigatório" }, 400);

    const asaasUrl = Deno.env.get("ASAAS_URL")?.trim() || "https://api.asaas.com/v3";
    const asaasKey = Deno.env.get("ASAAS_API_KEY")?.trim() || "";
    if (!asaasKey) return json({ error: "ASAAS_API_KEY não configurada" }, 500);

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

    // pega só os itens ainda não enviados e já os marca como "sending" (se duas chamadas chegarem juntas, cada item é pego por uma só)
    const { data: items, error } = await supabase.from("partner_payout_items")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("payout_id", payout_id).eq("status", "pending")
      .select("id, amount, pix_key, pix_key_type");
    if (error) throw error;

    const results: { item_id: string; ok: boolean; transfer_id?: string; error?: string }[] = [];
    for (const it of items || []) {
      try {
        const res = await fetch(`${asaasUrl}/transfers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": asaasKey },
          body: JSON.stringify({
            value: Number(it.amount),
            pixAddressKey: it.pix_key,
            pixAddressKeyType: it.pix_key_type,
            description: "Comissão MetaBuilder PRO",
            externalReference: it.id,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.id) {
          const reason = body?.errors?.[0]?.description || `HTTP ${res.status}`;
          await supabase.rpc("mb_partner_fail_item", { p_item_id: it.id, p_reason: reason });
          results.push({ item_id: it.id, ok: false, error: reason });
          continue;
        }
        await supabase.from("partner_payout_items")
          .update({ asaas_transfer_id: body.id, status: "sent", updated_at: new Date().toISOString() }).eq("id", it.id);
        results.push({ item_id: it.id, ok: true, transfer_id: body.id });
      } catch (e: any) {
        // erro de rede no meio: não sabemos se o Asaas criou a transferência. NÃO falha nem reenvia: fica "sending" para conferência manual
        console.error("[partner-payout] erro ao enviar o item", it.id, e);
        results.push({ item_id: it.id, ok: false, error: "Sem resposta do Asaas; confira o painel do Asaas antes de reenviar" });
      }
    }
    return json({ success: true, results });
  } catch (e: any) {
    console.error("[partner-payout] erro:", e);
    return json({ error: e?.message || "Erro interno" }, 500);
  }
});
