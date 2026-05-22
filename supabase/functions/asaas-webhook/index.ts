import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

serve(async (req) => {
  // Webhooks are normally POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. Verify Authentication Token from Asaas header
    const tokenHeader = req.headers.get("asaas-access-token")?.trim();
    const localToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN")?.trim();

    if (!tokenHeader || tokenHeader !== localToken) {
      console.warn("Unauthorized webhook request. Token header:", tokenHeader);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { event, payment, subscription } = body;

    console.log(`Received Asaas Webhook event: ${event}`);

    // Extract externalReference from payment or subscription
    const externalReference = payment?.externalReference || subscription?.externalReference;
    if (!externalReference || (!externalReference.startsWith("ws_") && !externalReference.startsWith("w_"))) {
      console.log(`Webhook ignored: no valid external reference (${externalReference})`);
      return new Response(JSON.stringify({ success: true, message: "Ignored (no reference)" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Parse externalReference: 
    // Legacy: ws_[workspaceId]_pl_[planId]_cy_[cycle]_t_[timestamp]
    // Shortened: w_[workspaceId]_p_[planId]_c_[cycleCode]_[timestamp]
    const parts = externalReference.split("_");
    const workspaceId = parts[1];
    const planId = parts[3];
    const cycleRaw = parts[5];

    let cycle = cycleRaw;
    if (cycleRaw === "mo") cycle = "monthly";
    else if (cycleRaw === "qu") cycle = "quarterly";
    else if (cycleRaw === "se") cycle = "semiannual";
    else if (cycleRaw === "ye") cycle = "yearly";

    if (!workspaceId || !planId || !cycle) {
      console.warn("Invalid external reference format:", externalReference);
      return new Response(JSON.stringify({ error: "Invalid externalReference format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Initialize Supabase Client with service role to bypass RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. Handle Event Types
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      // Calculate expiration date based on the cycle
      let monthsToAdd = 1;
      if (cycle === "quarterly") monthsToAdd = 3;
      else if (cycle === "semiannual") monthsToAdd = 6;
      else if (cycle === "yearly") monthsToAdd = 12;

      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + monthsToAdd);

      // Update workspace status to active
      const { error: wsError } = await supabaseClient
        .from("workspaces")
        .update({
          plan_id: planId,
          subscription_status: "active",
          is_blocked: false,
          subscription_cycle: cycle,
          subscription_expires_at: expirationDate.toISOString()
        })
        .eq("id", workspaceId);

      if (wsError) {
        console.error(`Error updating workspace ${workspaceId}:`, wsError);
        throw wsError;
      }

      // Update payment record
      const { error: payError } = await supabaseClient
        .from("payments")
        .update({
          status: "paid",
          webhook_payload: body,
          webhook_received_at: new Date().toISOString(),
          webhook_processed: true
        })
        .eq("external_reference", externalReference);

      if (payError) {
        console.error("Error updating payment log:", payError);
      }

      console.log(`Workspace ${workspaceId} successfully activated with plan ${planId}`);
    } 
    
    else if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      // Update workspace to canceled (but keep access active until expiration date)
      const { error: wsError } = await supabaseClient
        .from("workspaces")
        .update({
          subscription_status: "canceled"
        })
        .eq("id", workspaceId);

      if (wsError) {
        console.error(`Error updating workspace ${workspaceId}:`, wsError);
        throw wsError;
      }

      console.log(`Subscription deleted/canceled for workspace ${workspaceId}`);
    } 
    
    else if (event === "PAYMENT_OVERDUE") {
      // Block the workspace access immediately since the payment is overdue
      const { error: wsError } = await supabaseClient
        .from("workspaces")
        .update({
          subscription_status: "blocked",
          is_blocked: true
        })
        .eq("id", workspaceId);

      if (wsError) {
        console.error(`Error blocking workspace ${workspaceId}:`, wsError);
        throw wsError;
      }

      // Update corresponding payment status
      if (payment?.id) {
        await supabaseClient
          .from("payments")
          .update({
            status: "overdue",
            webhook_payload: body,
            webhook_received_at: new Date().toISOString(),
            webhook_processed: true
          })
          .eq("asaas_payment_id", payment.id);
      }

      console.log(`Workspace ${workspaceId} blocked due to overdue payment`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Webhook error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
