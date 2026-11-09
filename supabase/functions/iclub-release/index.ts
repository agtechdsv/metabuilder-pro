import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { syncNextCharge } from "../_shared/iclub.ts";

/**
 * Libera as recompensas de desconto de indicação cuja carência terminou (pending → active) e recalcula a assinatura de quem as ganhou.
 * Chamada uma vez por dia pelo cron do site (/api/cron/iclub-release) com a chave de serviço no cabeçalho Authorization.
 */
serve(async (req) => {
  const serviceKey = (Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "");
  const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!serviceKey || bearer !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey);
    const { data: released, error } = await supabase
      .from("iclub_rewards")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("status", "pending")
      .eq("reward_type", "percent_discount")
      .lte("release_at", new Date().toISOString())
      .select("id, user_id");
    if (error) throw error;

    const users: string[] = Array.from(new Set<string>((released || []).map((r: any) => r.user_id as string)));
    for (const userId of users) await syncNextCharge(supabase, userId);

    return new Response(JSON.stringify({ success: true, released: released?.length || 0, synced: users.length }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[iclub-release] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
