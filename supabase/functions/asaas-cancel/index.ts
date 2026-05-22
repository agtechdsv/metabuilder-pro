import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

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

    // 1. Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // Use service role to write/update workspaces
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

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "Parâmetro workspaceId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch the workspace and verify if the user is the owner
    const { data: workspace, error: wsError } = await supabaseClient
      .from("workspaces")
      .select("id, owner_id, asaas_subscription_id")
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

    const asaasSubscriptionId = workspace.asaas_subscription_id;

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
      .from("workspaces")
      .update({
        subscription_status: "canceled"
      })
      .eq("id", workspaceId);

    if (updateError) {
      console.error("Erro ao atualizar status do workspace para cancelado:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar status local da assinatura" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
