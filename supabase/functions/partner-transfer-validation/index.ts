import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { decideTransferValidation } from "../_shared/partnerCommission.ts";

/**
 * "Mecanismo de validação de saque" do Asaas (Integrações > Mecanismos de segurança): uns 5 s depois de qualquer saque pela API, o Asaas faz um
 * POST aqui e só efetiva se a resposta for {"status":"APPROVED"}. Aprovamos apenas as transferências Pix criadas por um lote de parceiros
 * confirmado (mesmo valor e mesma chave Pix); todo o resto é recusado, e qualquer erro também (falha segura).
 * Token: o mesmo que se cadastra no Asaas, no segredo ASAAS_TRANSFER_VALIDATION_TOKEN (cabeçalho asaas-access-token).
 */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expected = Deno.env.get("ASAAS_TRANSFER_VALIDATION_TOKEN")?.trim();
  const given = req.headers.get("asaas-access-token")?.trim();
  if (!expected || !given || given !== expected) return json({ error: "Unauthorized" }, 401);

  try {
    const payload = await req.json();
    const serviceKey = (Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);

    const { data: items, error } = await supabase.from("partner_payout_items")
      .select("id, status, amount, pix_key, pix_key_type, asaas_transfer_id").in("status", ["sending", "sent"]);
    if (error) throw error;

    const decision = decideTransferValidation(payload, items || []);
    if (decision.status === "APPROVED") return json({ status: "APPROVED" });
    console.warn("[partner-transfer-validation] recusada:", decision.refuseReason, JSON.stringify(payload?.transfer?.id ?? null));
    return json({ status: "REFUSED", refuseReason: decision.refuseReason });
  } catch (e: any) {
    console.error("[partner-transfer-validation] erro (recusando):", e);
    return json({ status: "REFUSED", refuseReason: "Erro ao validar" });
  }
});
