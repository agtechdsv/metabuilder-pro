import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT",
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

    // 1. Initialize Supabase client for auth
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token de usuário inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceRoleKey = Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    // Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, asaas_subscription_id, asaas_customer_id, plan_id, subscription_cycle")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Perfil do usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")?.trim();
    const ASAAS_URL = Deno.env.get("ASAAS_URL")?.trim() || "https://api.asaas.com/v3";

    if (!ASAAS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Chave de API do Asaas não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- HANDLE GET METHOD: Fetch current card info from Asaas ---
    if (req.method === "GET") {
      if (!profile.asaas_subscription_id) {
        return new Response(
          JSON.stringify({ activeCard: null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${ASAAS_URL}/subscriptions/${profile.asaas_subscription_id}`, {
        headers: { "access_token": ASAAS_API_KEY }
      });

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar assinatura no Asaas" }),
          { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const subscription = await res.json();
      
      // Get the payments list to see if there is any pending invoice
      const paymentsRes = await fetch(`${ASAAS_URL}/payments?subscription=${profile.asaas_subscription_id}&status=PENDING`, {
        headers: { "access_token": ASAAS_API_KEY }
      });
      let pendingInvoice = null;
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        if (paymentsData.data && paymentsData.data.length > 0) {
          const firstPending = paymentsData.data[0];
          
          // If PIX is pending, fetch the QR Code details
          let pixDetails = null;
          if (firstPending.billingType === "PIX") {
            const pixRes = await fetch(`${ASAAS_URL}/payments/${firstPending.id}/pixQrCode`, {
              headers: { "access_token": ASAAS_API_KEY }
            });
            if (pixRes.ok) pixDetails = await pixRes.json();
          }

          pendingInvoice = {
            id: firstPending.id,
            value: firstPending.value,
            dueDate: firstPending.dueDate,
            billingType: firstPending.billingType,
            bankSlipUrl: firstPending.bankSlipUrl || firstPending.invoiceUrl || null,
            pixQrCode: pixDetails?.encodedImage || null,
            pixCopiaCola: pixDetails?.payload || null,
            barCode: firstPending.barCode || null,
            identificationField: firstPending.identificationField || null,
          };
        }
      }

      return new Response(
        JSON.stringify({
          creditCard: subscription.creditCard || null,
          pendingInvoice: pendingInvoice
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- HANDLE POST METHOD: changePlan or updateCard ---
    const body = await req.json();
    const { action } = body;

    if (action === "changePlan") {
      const { planId, cycle } = body;
      if (!planId || !cycle) {
        return new Response(
          JSON.stringify({ error: "planId e cycle são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!profile.asaas_subscription_id) {
        return new Response(
          JSON.stringify({ error: "Nenhuma assinatura ativa encontrada para alteração" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch target plan details
      const { data: plan, error: planError } = await supabaseClient
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (planError || !plan) {
        return new Response(
          JSON.stringify({ error: "Plano de destino não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine cycle price and Asaas cycle name
      let cyclePrice = 0;
      let asaasCycle = "";
      if (cycle === "monthly") {
        cyclePrice = Number(plan.price_monthly || plan.price);
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

      // Update Subscription in Asaas
      const updatePayload = {
        value: cyclePrice,
        cycle: asaasCycle,
        description: `MetaBuilderPRO - Assinatura Plano ${plan.name}`,
      };

      const asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${profile.asaas_subscription_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY
        },
        body: JSON.stringify(updatePayload)
      });

      if (!asaasRes.ok) {
        const errData = await asaasRes.json().catch(() => ({}));
        const errorMsg = errData.errors?.[0]?.description || "Erro ao atualizar assinatura no Asaas";
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatedSub = await asaasRes.json();

      // Recalculate expiration date based on the cycle
      let monthsToAdd = 1;
      if (cycle === "quarterly") monthsToAdd = 3;
      else if (cycle === "semiannual") monthsToAdd = 6;
      else if (cycle === "yearly") monthsToAdd = 12;

      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + monthsToAdd);

      // Update profile in local Supabase
      const { error: updateDbError } = await supabaseClient
        .from("profiles")
        .update({
          plan_id: planId,
          subscription_cycle: cycle,
          subscription_expires_at: expirationDate.toISOString()
        })
        .eq("id", user.id);

      if (updateDbError) {
        console.error("Erro ao atualizar perfil local:", updateDbError);
      }

      return new Response(
        JSON.stringify({ success: true, subscription: updatedSub }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "updateCard") {
      const {
        cardNumber,
        cardName,
        cardExpiry,
        cardCvv,
        billingName,
        billingCpfCnpj,
        billingEmail,
        phone,
        postalCode,
        addressNumber
      } = body;

      if (!cardNumber || !cardName || !cardExpiry || !cardCvv || !billingName || !billingCpfCnpj || !billingEmail || !postalCode || !addressNumber) {
        return new Response(
          JSON.stringify({ error: "Parâmetros de cartão obrigatórios ausentes" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!profile.asaas_subscription_id) {
        return new Response(
          JSON.stringify({ error: "Nenhuma assinatura ativa encontrada para atualizar cartão" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const expiryParts = cardExpiry.split("/");
      const expiryMonth = expiryParts[0]?.trim();
      const expiryYear = "20" + expiryParts[1]?.trim();

      const rawIp = req.headers.get("x-forwarded-for") || "127.0.0.1";
      const remoteIp = rawIp.split(",")[0].trim();

      const cleanCpfCnpj = billingCpfCnpj.replace(/[^\d]/g, "");

      const updateCardPayload = {
        billingType: "CREDIT_CARD",
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
          phone: phone ? phone.replace(/[^\d]/g, "") : "",
          mobilePhone: phone ? phone.replace(/[^\d]/g, "") : ""
        },
        remoteIp: remoteIp
      };

      const asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${profile.asaas_subscription_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY
        },
        body: JSON.stringify(updateCardPayload)
      });

      if (!asaasRes.ok) {
        const errData = await asaasRes.json().catch(() => ({}));
        const errorMsg = errData.errors?.[0]?.description || "Erro ao atualizar dados de pagamento no Asaas";
        return new Response(
          JSON.stringify({ error: errorMsg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatedSub = await asaasRes.json();

      // Extract masked card info from the response
      const cardBrand = updatedSub.creditCard?.creditCardBrand || "CARD";
      const cardLastDigits = updatedSub.creditCard?.creditCardNumber ? updatedSub.creditCard.creditCardNumber.slice(-4) : "";

      // Update local profiles database
      await supabaseClient
        .from("profiles")
        .update({
          card_brand: cardBrand,
          card_last_digits: cardLastDigits
        })
        .eq("id", user.id);

      return new Response(
        JSON.stringify({
          success: true,
          cardBrand,
          cardLastDigits,
          subscription: updatedSub
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida ou não especificada" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
