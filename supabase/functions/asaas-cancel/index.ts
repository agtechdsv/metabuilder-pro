import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { billingSettings, pingNotify, queueNotice } from "../_shared/billing.ts";
import { noticeRef } from "../_shared/billingCore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceRoleKey = Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    // 1. Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey, // Use service role to write/update workspaces
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { workspaceId } = body;

    if (workspaceId) {
      // 2. Fetch the workspace and verify if the user is the owner
      const { data: workspace, error: wsError } = await supabaseClient
        .from("workspaces")
        .select("id, owner_id")
        .eq("id", workspaceId)
        .single();

      if (wsError || !workspace) {
        return new Response(
          JSON.stringify({ error: "Workspace não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (workspace.owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Apenas o proprietário do workspace pode cancelar a assinatura" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get the subscription ID from the profile
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("asaas_subscription_id, subscription_expires_at")
      .eq("id", user.id)
      .single();

    const asaasSubscriptionId = profile?.asaas_subscription_id;

    // 3. Efetuar chamada no Asaas para cancelar a renovação caso exista a assinatura ativa
    if (asaasSubscriptionId) {
      const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")?.trim();
      const ASAAS_URL = Deno.env.get("ASAAS_URL")?.trim() || "https://api.asaas.com/v3";

      if (!ASAAS_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Chave de API do Asaas não configurada" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Chamada DELETE para cancelar a assinatura no Asaas
      const cancelRes = await fetch(`${ASAAS_URL}/subscriptions/${asaasSubscriptionId}`, {
        method: "DELETE",
        headers: {
          "access_token": ASAAS_API_KEY
        }
      });

      if (!cancelRes.ok) {
        const errData = await cancelRes.json().catch(() => ({}));
        const errorMsg = errData.errors?.[0]?.description || "Erro ao cancelar assinatura no Asaas";
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 4. Alterar o status no banco local para canceled
    const { error: updateError } = await supabaseClient
      .from("profiles")
      .update({
        subscription_status: "canceled"
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Erro ao atualizar status do workspace para cancelado:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar status local da assinatura" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // aviso por e-mail: renovação cancelada, acesso até a data (desligado por padrão; nunca atrapalha o cancelamento)
    try {
      const cfg = await billingSettings(supabaseClient);
      const day = (profile?.subscription_expires_at || "").slice(0, 10);
      if (await queueNotice(supabaseClient, cfg, { kind: "canceled", userId: user.id, ref: noticeRef([user.id, day || "sem-data"]), payload: { expiresAt: profile?.subscription_expires_at || null } })) await pingNotify();
    } catch (e) { console.error("[avisos] erro ao avisar o cancelamento:", e); }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Assinatura cancelada com sucesso. Seu acesso continuará ativo até o fim do ciclo atual."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
