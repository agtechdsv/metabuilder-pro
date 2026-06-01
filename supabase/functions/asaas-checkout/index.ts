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

    // 1. Initialize Supabase client for authentication
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current authenticated user
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceRoleKey = Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    // Initialize Supabase Client with service role to bypass RLS for DB operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );

    const body = await req.json();
    const {
      licenses,
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
      workspaceId,
      isUpgrade
    } = body;

    if (!licenses || !cycle || !paymentMethod || !billingName || !billingCpfCnpj || !billingEmail || !workspaceId) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios ausentes" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch pricing rules
    const { data: rules, error: rulesError } = await supabaseClient
      .from("pricing_rules")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (rulesError || !rules) {
      return new Response(
        JSON.stringify({ error: "Regras de precificação não encontradas" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine cycle price and Asaas cycle name
    const basePrice = Number(rules.base_price) || 450;
    let volDiscount = 0;
    if (rules.volume_tiers && rules.volume_tiers.length > 0) {
      const sorted = [...rules.volume_tiers].sort((a: any, b: any) => b.min_licenses - a.min_licenses);
      const tier = sorted.find((t: any) => licenses >= t.min_licenses);
      if (tier) volDiscount = tier.discount_percent;
    }
    
    const unitPrice = basePrice * (1 - volDiscount / 100);

    let months = 1;
    let asaasCycle = "MONTHLY";
    if (cycle === "quarterly") {
      months = 3;
      asaasCycle = "QUARTERLY";
    } else if (cycle === "semiannual") {
      months = 6;
      asaasCycle = "SEMIANNUALLY";
    } else if (cycle === "yearly") {
      months = 12;
      asaasCycle = "YEARLY";
    } else if (cycle !== "monthly") {
      return new Response(
        JSON.stringify({ error: "Ciclo de faturamento inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cycleDiscount = 0;
    if (cycle !== "monthly" && rules.cycle_discounts) {
      cycleDiscount = rules.cycle_discounts[cycle] || 0;
    }

    const cyclePrice = (unitPrice * licenses * months) * (1 - cycleDiscount / 100);

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

    // Fetch profile
    const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();

    // Update profile with customer id if it's new
    if (profile?.asaas_customer_id !== asaasCustomerId) {
      await supabaseClient
        .from("profiles")
        .update({ asaas_customer_id: asaasCustomerId })
        .eq("id", user.id);
    }

    // Format Asaas billing type
    let asaasBillingType = "";
    if (paymentMethod === "card") asaasBillingType = "CREDIT_CARD";
    else if (paymentMethod === "pix") asaasBillingType = "PIX";
    else if (paymentMethod === "boleto") asaasBillingType = "BOLETO";

    // Setup due date (today for immediate card and pix billing, today + 1 day for Boleto first charge)
    const d = new Date();
    if (paymentMethod === "boleto") {
      d.setDate(d.getDate() + 1);
    }
    const nextDueDate = d.toISOString().split("T")[0];

    // External reference structure (shortened to fit under Asaas 100-char limit)
    const cycleCode = cycle === "monthly" ? "mo" : cycle === "quarterly" ? "qu" : cycle === "semiannual" ? "se" : "ye";
    const cleanWorkspaceId = workspaceId.replace(/-/g, "");
    const timestamp = Math.floor(Date.now() / 1000);
    // Para upgrades, usamos o prefixo _u_ em vez de _l_
    const prefix = isUpgrade ? "u" : "l";
    const externalReference = `w_${cleanWorkspaceId}_${prefix}_${licenses}_c_${cycleCode}_${timestamp}`;

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

    // 3. Create Subscription or Upgrade Payment in Asaas
    let asaasSubscriptionId = profile?.asaas_subscription_id;
    let firstPayment: any = null;
    let subData: any = null;
    
    if (isUpgrade && asaasSubscriptionId) {
      // É um upgrade. Calcular o valor prorata.
      const subRes = await fetch(`${ASAAS_URL}/subscriptions/${asaasSubscriptionId}`, { headers: { "access_token": ASAAS_API_KEY } });
      if (!subRes.ok) {
        return new Response(
          JSON.stringify({ error: "Erro ao buscar assinatura atual no Asaas" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      subData = await subRes.json();
      // Garantir que backend e frontend usem a mesma data base para dias restantes
      const currentNextDueDate = new Date(profile.subscription_expires_at || subData.nextDueDate);
      const now = new Date();
      const diffTime = currentNextDueDate.getTime() - now.getTime();
      const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      
      // Calculate old price using profile.subscription_amount if available
      let oldMonths = 1;
      if (profile.subscription_cycle === "quarterly") oldMonths = 3;
      else if (profile.subscription_cycle === "semiannual") oldMonths = 6;
      else if (profile.subscription_cycle === "yearly") oldMonths = 12;

      let oldDailyRate = 0;
      if (profile.subscription_amount && profile.subscription_amount > 0) {
        oldDailyRate = profile.subscription_amount / (oldMonths * 30);
      } else {
        let oldVolDiscount = 0;
        if (rules.volume_tiers && rules.volume_tiers.length > 0) {
          const sorted = [...rules.volume_tiers].sort((a: any, b: any) => b.min_licenses - a.min_licenses);
          const tier = sorted.find((t: any) => (profile.subscription_licenses || 1) >= t.min_licenses);
          if (tier) oldVolDiscount = tier.discount_percent;
        }
        const oldUnitPrice = basePrice * (1 - oldVolDiscount / 100);

        let oldCycleDiscount = 0;
        if (profile.subscription_cycle !== "monthly" && rules.cycle_discounts) {
          oldCycleDiscount = rules.cycle_discounts[profile.subscription_cycle] || 0;
        }
        const oldCyclePrice = (oldUnitPrice * (profile.subscription_licenses || 1) * oldMonths) * (1 - oldCycleDiscount / 100);

        oldDailyRate = oldCyclePrice / (oldMonths * 30);
      }
      const newDailyRate = cyclePrice / (months * 30);

      const diff = (newDailyRate - oldDailyRate) * daysRemaining;

      if (diff >= 5) {
        let prorataValue = diff;
        
        // Criar cobrança avulsa (Payment)
        const paymentPayload = {
          customer: asaasCustomerId,
          billingType: asaasBillingType,
          value: prorataValue,
          dueDate: nextDueDate,
          description: `MetaBuilderPRO - Upgrade Prorata (${licenses} licenças)`,
          externalReference: externalReference,
          ...creditCardPayload
        };
        
        const paymentRes = await fetch(`${ASAAS_URL}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
          body: JSON.stringify(paymentPayload)
        });
        
        if (!paymentRes.ok) {
          const errData = await paymentRes.json().catch(() => ({}));
          return new Response(
            JSON.stringify({ error: errData.errors?.[0]?.description || "Erro ao criar cobrança de upgrade no Asaas" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        firstPayment = await paymentRes.json();
      } else {
        // Downgrade ou mesmo valor: Atualiza direto o valor base e encerra
        await fetch(`${ASAAS_URL}/subscriptions/${asaasSubscriptionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
          body: JSON.stringify({ value: cyclePrice, cycle: asaasCycle })
        });

        await supabaseClient
          .from("profiles")
          .update({
            subscription_cycle: cycle,
            subscription_licenses: licenses,
            subscription_amount: cyclePrice
          })
          .eq("id", user.id);

        return new Response(
          JSON.stringify({
            success: true,
            subscriptionId: asaasSubscriptionId,
            paymentId: null,
            status: "CONFIRMED"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
    } else {
      // Nova assinatura
      const subscriptionPayload = {
        customer: asaasCustomerId,
        billingType: asaasBillingType,
        value: cyclePrice,
        nextDueDate: nextDueDate,
        cycle: asaasCycle,
        description: `MetaBuilderPRO - Assinatura Pro (${licenses} licenças)`,
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

      subData = await subRes.json();
      asaasSubscriptionId = subData.id;

      // Fetch payments of this subscription to get the first invoice ID
      const paymentsRes = await fetch(`${ASAAS_URL}/payments?subscription=${asaasSubscriptionId}`, {
        headers: { "access_token": ASAAS_API_KEY }
      });

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        firstPayment = paymentsData.data?.[0];
      }

      // Update profile with subscription id and amount
      await supabaseClient
        .from("profiles")
        .update({ 
          asaas_subscription_id: asaasSubscriptionId,
          subscription_amount: cyclePrice 
        })
        .eq("id", user.id);
    }
    
    const asaasPaymentId = firstPayment?.id;

    // Save payment log in DB
    const { error: insertError } = await supabaseClient.from("payments").insert({
      user_id: user.id,
      cycle: cycle,
      amount: firstPayment?.value || cyclePrice,
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

    // If Credit Card, and it was approved immediately, activate workspace (and update subscription if upgrade)
    if (paymentMethod === "card" && (firstPayment?.status === "CONFIRMED" || firstPayment?.status === "RECEIVED")) {
      if (isUpgrade && asaasSubscriptionId) {
        // Update subscription base value for next cycle
        await fetch(`${ASAAS_URL}/subscriptions/${asaasSubscriptionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "access_token": ASAAS_API_KEY },
          body: JSON.stringify({ value: cyclePrice, cycle: asaasCycle })
        });
        
        await supabaseClient
          .from("profiles")
          .update({
            subscription_cycle: cycle,
            subscription_licenses: licenses,
            subscription_amount: cyclePrice
          })
          .eq("id", user.id);
      } else {
        let monthsToAdd = 1;
        if (cycle === "quarterly") monthsToAdd = 3;
        else if (cycle === "semiannual") monthsToAdd = 6;
        else if (cycle === "yearly") monthsToAdd = 12;

        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + monthsToAdd);

        await supabaseClient
          .from("profiles")
          .update({
            plan_id: null,
            subscription_status: "active",
            is_blocked: false,
            subscription_cycle: cycle,
            subscription_licenses: licenses,
            subscription_amount: cyclePrice,
            subscription_expires_at: expirationDate.toISOString()
          })
          .eq("id", user.id);
      }
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
