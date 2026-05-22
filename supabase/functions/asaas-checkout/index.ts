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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // Use service role to write payments/workspaces
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
    const {
      planId,
      cycle, // monthly, quarterly, semiannual, yearly
      paymentMethod, // card, pix, boleto
      billingName,
      billingCpfCnpj,
      billingEmail,
      phone,
      postalCode,
      addressNumber,
      // Card specific
      cardNumber,
      cardName,
      cardExpiry, // MM/AA
      cardCvv,
      workspaceId
    } = body;

    if (!planId || !cycle || !paymentMethod || !billingName || !billingCpfCnpj || !billingEmail || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch plan details
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: "Plano de assinatura não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine cycle price and Asaas cycle name
    let cyclePrice = 0;
    let asaasCycle = "";
    if (cycle === "monthly") {
      cyclePrice = Number(plan.price_monthly);
      asaasCycle = "MONTHLY";
    } else if (cycle === "quarterly") {
      cyclePrice = Number(plan.price_quarterly);
      asaasCycle = "QUARTERLY";
    } else if (cycle === "semiannual") {
      cyclePrice = Number(plan.price_semiannually);
      asaasCycle = "SEMIANNUALLY";
    } else if (cycle === "yearly") {
      cyclePrice = Number(plan.price_yearly);
      asaasCycle = "YEARLY";
    } else {
      return new Response(
        JSON.stringify({ error: "Ciclo de faturamento inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Asaas config
    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")?.trim();
    const ASAAS_URL = Deno.env.get("ASAAS_URL")?.trim() || "https://api.asaas.com/v3";

    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Chave de API do Asaas não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean CPF/CNPJ
    const cleanCpfCnpj = billingCpfCnpj.replace(/[^\d]/g, "");

    // 2. Search or Create Customer in Asaas
    let asaasCustomerId = "";
    const searchUrl = `${ASAAS_URL}/customers?email=${encodeURIComponent(billingEmail)}`;
    const searchRes = await fetch(searchUrl, {
      headers: { "access_token": ASAAS_API_KEY }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        asaasCustomerId = searchData.data[0].id;
        
        // Garantir que as notificações estão desativadas no Asaas para este cliente existente
        await fetch(`${ASAAS_URL}/customers/${asaasCustomerId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "access_token": ASAAS_API_KEY
          },
          body: JSON.stringify({
            notificationDisabled: true
          })
        });
      }
    }

    if (!asaasCustomerId) {
      // Create new customer
      const createCustRes = await fetch(`${ASAAS_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY
        },
        body: JSON.stringify({
          name: billingName,
          email: billingEmail,
          cpfCnpj: cleanCpfCnpj,
          phone: phone,
          mobilePhone: phone,
          notificationDisabled: true
        })
      });

      if (!createCustRes.ok) {
        const errData = await createCustRes.json().catch(() => ({}));
        const errorMsg = errData.errors?.[0]?.description || "Erro ao criar cliente no Asaas";
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const custData = await createCustRes.json();
      asaasCustomerId = custData.id;
    }

    // Update workspace with customer id
    await supabaseClient
      .from("workspaces")
      .update({ asaas_customer_id: asaasCustomerId })
      .eq("id", workspaceId);

    // Format Asaas billing type
    let asaasBillingType = "";
    if (paymentMethod === "card") asaasBillingType = "CREDIT_CARD";
    else if (paymentMethod === "pix") asaasBillingType = "PIX";
    else if (paymentMethod === "boleto") asaasBillingType = "BOLETO";

    // Setup due date (today for immediate card billing, today + 3 days for Pix/Boleto first charge)
    const d = new Date();
    if (paymentMethod !== "card") {
      d.setDate(d.getDate() + 3);
    }
    const nextDueDate = d.toISOString().split("T")[0];

    // External reference structure
    const cycleCode = cycle === "monthly" ? "mo" : cycle === "quarterly" ? "qu" : cycle === "semiannual" ? "se" : "ye";
    const externalReference = `w_${workspaceId}_p_${planId}_c_${cycleCode}_${Date.now()}`;

    // Setup card details if applicable
    let creditCardPayload = {};
    if (paymentMethod === "card") {
      const expiryParts = cardExpiry.split("/");
      const expiryMonth = expiryParts[0]?.trim();
      const expiryYear = "20" + expiryParts[1]?.trim(); // e.g., 26 -> 2026

      const rawIp = req.headers.get("x-forwarded-for") || "127.0.0.1";
      const remoteIp = rawIp.split(",")[0].trim();

      creditCardPayload = {
        creditCard: {
          holderName: cardName,
          number: cardNumber.replace(/\s/g, ""),
          expiryMonth: expiryMonth,
          expiryYear: expiryYear,
          ccv: cardCvv
        },
        creditCardHolderInfo: {
          name: billingName,
          email: billingEmail,
          cpfCnpj: cleanCpfCnpj,
          postalCode: postalCode.replace(/[^\d]/g, ""),
          addressNumber: addressNumber,
          phone: phone.replace(/[^\d]/g, ""),
          mobilePhone: phone.replace(/[^\d]/g, "")
        },
        remoteIp: remoteIp
      };
    }

    // 3. Create Subscription in Asaas
    const subscriptionPayload = {
      customer: asaasCustomerId,
      billingType: asaasBillingType,
      value: cyclePrice,
      nextDueDate: nextDueDate,
      cycle: asaasCycle,
      description: `MetaBuilderPRO - Assinatura Plano ${plan.name}`,
      externalReference: externalReference,
      ...creditCardPayload
    };

    const subRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY
      },
      body: JSON.stringify(subscriptionPayload)
    });

    if (!subRes.ok) {
      const errData = await subRes.json().catch(() => ({}));
      const errorMsg = errData.errors?.[0]?.description || "Erro ao criar assinatura no Asaas";
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subData = await subRes.json();
    const asaasSubscriptionId = subData.id;

    // Fetch payments of this subscription to get the first invoice ID
    const paymentsRes = await fetch(`${ASAAS_URL}/payments?subscription=${asaasSubscriptionId}`, {
      headers: { "access_token": ASAAS_API_KEY }
    });

    let firstPayment: any = null;
    if (paymentsRes.ok) {
      const paymentsData = await paymentsRes.json();
      firstPayment = paymentsData.data?.[0];
    }

    const asaasPaymentId = firstPayment?.id;

    // Update workspace with subscription id
    await supabaseClient
      .from("workspaces")
      .update({ asaas_subscription_id: asaasSubscriptionId })
      .eq("id", workspaceId);

    // Save payment log in DB
    const { error: insertError } = await supabaseClient.from("payments").insert({
      user_id: user.id,
      workspace_id: workspaceId,
      plan_id: planId,
      cycle: cycle,
      amount: cyclePrice,
      status: paymentMethod === "card" && firstPayment?.status === "CONFIRMED" ? "paid" : "pending",
      external_reference: externalReference,
      billing_type: asaasBillingType,
      invoice_url: firstPayment?.bankSlipUrl || firstPayment?.invoiceUrl || null,
      asaas_payment_id: asaasPaymentId,
      asaas_response: subData
    });

    if (insertError) {
      console.error("Error inserting payment log:", insertError);
    }

    // If Pix, retrieve the QR Code and copy-paste payload
    let pixData = null;
    if (paymentMethod === "pix" && asaasPaymentId) {
      const pixRes = await fetch(`${ASAAS_URL}/payments/${asaasPaymentId}/pixQrCode`, {
        headers: { "access_token": ASAAS_API_KEY }
      });

      if (pixRes.ok) {
        pixData = await pixRes.json();
      }
    }

    // If Credit Card, and it was approved immediately, activate workspace
    if (paymentMethod === "card" && (firstPayment?.status === "CONFIRMED" || firstPayment?.status === "RECEIVED")) {
      let monthsToAdd = 1;
      if (cycle === "quarterly") monthsToAdd = 3;
      else if (cycle === "semiannual") monthsToAdd = 6;
      else if (cycle === "yearly") monthsToAdd = 12;

      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + monthsToAdd);

      await supabaseClient
        .from("workspaces")
        .update({
          plan_id: planId,
          subscription_status: "active",
          is_blocked: false,
          subscription_cycle: cycle,
          subscription_expires_at: expirationDate.toISOString()
        })
        .eq("id", workspaceId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: asaasSubscriptionId,
        paymentId: asaasPaymentId,
        status: firstPayment?.status || "PENDING",
        invoiceUrl: firstPayment?.bankSlipUrl || firstPayment?.invoiceUrl || null,
        pixQrCode: pixData?.encodedImage || null,
        pixCopiaCola: pixData?.payload || null,
        barCode: firstPayment?.barCode || null,
        identificationField: firstPayment?.identificationField || null
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
