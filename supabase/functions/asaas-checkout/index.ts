import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { campaignFromProfile, findEligibleCampaign, referralPercentFor } from "../_shared/iclub.ts";
import { CYCLE_MONTHS, chargeBreakdown, isCycle, isCycleEnabled, nextChargeValue, type CampaignTerms } from "../_shared/pricing.ts";
import { buildPaymentRef, isOwnCustomerRef, ownCustomerRef } from "../_shared/familyRefs.ts";
import { reactivationDueDate } from "../_shared/billingCore.ts";

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
      isUpgrade,
      action,
      language
    } = body;

    const isQuote = action === "quote";
    if (isQuote ? !licenses : (!licenses || !cycle || !paymentMethod || !billingName || !billingCpfCnpj || !billingEmail || !workspaceId)) {
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

    // Ciclo e valor: cálculo ÚNICO em ../_shared/pricing.ts (campanha, desconto de indicação, licenças). Nada do preço vem do navegador.
    const { data: prevProfile } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();

    // Campanha: só para quem NUNCA pagou (cliente novo). Quem faz upgrade mantém a campanha que já comprou (as licenças acrescentadas pagam preço regular).
    let campaignTerms: CampaignTerms | null = null;
    let newCampaign: any = null;
    let monthsUsed = 0;
    if (isUpgrade) {
      campaignTerms = campaignFromProfile(prevProfile);
      monthsUsed = Number(prevProfile?.campaign_months_used) || 0;
    } else {
      const { count: paidBefore } = await supabaseClient.from("payments").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "paid");
      if (!paidBefore) {
        newCampaign = await findEligibleCampaign(supabaseClient, user.email);
        if (newCampaign) {
          campaignTerms = { percent: Number(newCampaign.discount_percent), months: Number(newCampaign.months), licenses: Number(licenses) };
        }
      }
    }
    const referralPercent = await referralPercentFor(supabaseClient, user.id);

    // Cotação: o site mostra exatamente o que será cobrado (campanha incluída), para cada ciclo disponível. Não cria nada no Asaas.
    if (isQuote) {
      const quotes: Record<string, unknown> = {};
      for (const c of ["monthly", "quarterly", "semiannual", "yearly"] as const) {
        if (!isCycleEnabled(rules, c, prevProfile?.subscription_cycle)) continue;
        quotes[c] = nextChargeValue({ rules, licenses: Number(licenses), cycle: c, campaign: campaignTerms, monthsUsed, referralPercent });
      }
      return new Response(
        JSON.stringify({
          success: true,
          quotes,
          campaign: newCampaign
            ? { id: newCampaign.id, name: newCampaign.name, headline: newCampaign.headline, percent: Number(newCampaign.discount_percent), months: Number(newCampaign.months), ends_at: newCampaign.ends_at }
            : null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isCycle(cycle)) {
      return new Response(
        JSON.stringify({ error: "Ciclo de faturamento inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const months = CYCLE_MONTHS[cycle];
    const asaasCycle = cycle === "monthly" ? "MONTHLY" : cycle === "quarterly" ? "QUARTERLY" : cycle === "semiannual" ? "SEMIANNUALLY" : "YEARLY";
    if (!isCycleEnabled(rules, cycle, prevProfile?.subscription_cycle)) {
      return new Response(
        JSON.stringify({ error: "Este ciclo de faturamento não está disponível" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const cyclePrice = nextChargeValue({ rules, licenses: Number(licenses), cycle, campaign: campaignTerms, monthsUsed, referralPercent }).total;

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

    // 2. Cliente no Asaas. A conta do Asaas pode ser compartilhada com OUTROS apps (ex.: TraderMasterPRO), então NUNCA se procura o cliente só pelo
    // e-mail: ele poderia ser de outro app, e aí mexeríamos no cadastro dele (inclusive desligando as notificações). Só se usa cliente que é NOSSO:
    //  1) o que já está ligado ao perfil deste usuário (se ainda existir no Asaas e não for marcado como de outro app);
    //  2) o marcado com a nossa referência externa (mb_<id do usuário>);
    //  3) senão, cria um novo, já com a marca. (A API do Asaas permite clientes duplicados.)
    const ownCustomerRefValue = ownCustomerRef(user.id);
    let asaasCustomerId = "";

    const linkedCustomerId = typeof prevProfile?.asaas_customer_id === "string" ? prevProfile.asaas_customer_id.trim() : "";
    if (linkedCustomerId) {
      const linkedRes = await fetch(`${ASAAS_URL}/customers/${encodeURIComponent(linkedCustomerId)}`, { headers: { "access_token": ASAAS_API_KEY } });
      if (linkedRes.ok) {
        const linked = await linkedRes.json().catch(() => null);
        const linkedRef = linked?.externalReference;
        // sem marca = cliente antigo do MetaBuilder (nós adotamos e marcamos); com marca que não é nossa = é de outro app: não usa
        if (linked && !linked.deleted && (!linkedRef || isOwnCustomerRef(linkedRef))) asaasCustomerId = linkedCustomerId;
      }
    }

    if (!asaasCustomerId) {
      const taggedRes = await fetch(`${ASAAS_URL}/customers?externalReference=${encodeURIComponent(ownCustomerRefValue)}&limit=1`, { headers: { "access_token": ASAAS_API_KEY } });
      if (taggedRes.ok) {
        const tagged = await taggedRes.json().catch(() => null);
        const first = tagged?.data?.[0];
        if (first?.id && !first.deleted && first.externalReference === ownCustomerRefValue) asaasCustomerId = first.id;
      }
    }

    if (asaasCustomerId) {
      // Cliente NOSSO: garante a marca e as notificações do Asaas desativadas (os avisos de cobrança são do MetaBuilder)
      await fetch(`${ASAAS_URL}/customers/${asaasCustomerId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY
        },
        body: JSON.stringify({
          notificationDisabled: true,
          externalReference: ownCustomerRefValue
        })
      });
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
          notificationDisabled: true,
          externalReference: ownCustomerRefValue
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

    // idioma do cliente para os avisos de cobrança (pt, en ou es); qualquer outro valor é ignorado
    if (language === "pt" || language === "en" || language === "es") {
      await supabaseClient.from("profiles").update({ billing_language: language }).eq("id", user.id);
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
    // Reativação (assinatura cancelada com acesso ainda pago): a assinatura nova começa a cobrar só no fim do acesso, para não cobrar o mesmo período
    // duas vezes. Quem decide é o perfil no banco (nunca o navegador). Fora desse caso, a primeira cobrança é hoje, como sempre.
    const reactivationDue = !isUpgrade ? reactivationDueDate(prevProfile?.subscription_status, prevProfile?.subscription_expires_at, new Date()) : null;
    const nextDueDate = reactivationDue ?? d.toISOString().split("T")[0];

    // Referência externa no padrão da Família PRO (mb_ws_<workspace>_<l|u>_<licenças>_cy_<ciclo>_t_<timestamp>; ~64 caracteres, limite do Asaas: 100).
    // Upgrade usa "u" no lugar de "l". Ver supabase/functions/_shared/familyRefs.ts e docs/familia-pro-referencias.md.
    const cycleCode = cycle === "monthly" ? "mo" : cycle === "quarterly" ? "qu" : cycle === "semiannual" ? "se" : "ye";
    const externalReference = buildPaymentRef({ workspaceId, licenses: Number(licenses), upgrade: !!isUpgrade, cycleCode, timestamp: Math.floor(Date.now() / 1000) });

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
        const oldCyclePrice = isCycle(profile.subscription_cycle)
          ? chargeBreakdown({ rules, licenses: Number(profile.subscription_licenses) || 1, cycle: profile.subscription_cycle }).total
          : 0;

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
          body: JSON.stringify({ 
            value: cyclePrice, 
            cycle: asaasCycle,
            description: `MetaBuilderPRO - Assinatura Pro (${licenses} licenças)`
          })
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
      // Nova assinatura. Se o cliente já tinha uma (ex.: foi suspenso e está voltando a pagar), a antiga é cancelada no Asaas ANTES, para não
      // cobrar duas vezes nem deixar assinatura órfã. O vínculo no perfil é limpo primeiro: assim o evento de exclusão que o Asaas manda
      // não é atribuído ao cliente (não marca cancelado nem revoga recompensas). Se o cancelamento falhar, segue: o Asaas recusa o que não existe.
      if (profile?.asaas_subscription_id) {
        const oldSubscriptionId = profile.asaas_subscription_id;
        await supabaseClient.from("profiles").update({ asaas_subscription_id: null }).eq("id", user.id);
        try {
          const del = await fetch(`${ASAAS_URL}/subscriptions/${oldSubscriptionId}`, { method: "DELETE", headers: { "access_token": ASAAS_API_KEY } });
          if (!del.ok && del.status !== 404) console.error("[checkout] não foi possível cancelar a assinatura antiga no Asaas:", oldSubscriptionId, del.status);
        } catch (e) {
          console.error("[checkout] erro ao cancelar a assinatura antiga:", (e as Error)?.message);
        }
      }
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
        .update(reactivationDue
          ? {
            // reativação: o cliente já tem acesso pago até o fim do período; a assinatura volta a valer agora e o acesso (subscription_expires_at) NÃO muda.
            // A campanha que ele já tinha fica como está (não é zerada).
            asaas_subscription_id: asaasSubscriptionId,
            subscription_amount: cyclePrice,
            subscription_status: "active",
            is_blocked: false,
            subscription_cycle: cycle,
            subscription_licenses: Number(licenses),
          }
          : {
            asaas_subscription_id: asaasSubscriptionId,
            subscription_amount: cyclePrice,
            // a campanha comprada fica gravada (mudar a campanha depois não altera quem já comprou); sem campanha, zera
            campaign_id: newCampaign ? newCampaign.id : null,
            campaign_percent: newCampaign ? Number(newCampaign.discount_percent) : null,
            campaign_months: newCampaign ? Number(newCampaign.months) : null,
            campaign_licenses: newCampaign ? Number(licenses) : null,
            campaign_months_used: 0
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
        identificationField: firstPayment?.identificationField || null,
        // reativação com a primeira cobrança no fim do acesso: nada a pagar agora (o cliente pode antecipar pela aba Assinatura)
        reactivated: !!reactivationDue && firstPayment?.status !== "CONFIRMED" && firstPayment?.status !== "RECEIVED",
        firstChargeDate: reactivationDue
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
