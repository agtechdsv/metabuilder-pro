import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { grantVolumeLicenses, processReferralConversion, revokeReferralRewards, syncNextCharge } from "../_shared/iclub.ts";
import { CYCLE_MONTHS, isCycle } from "../_shared/pricing.ts";
import { applyTransferEvent, cancelPartnerReferral, recordPartnerCommission, revokePartnerCommissionForPayment } from "../_shared/partners.ts";
import { billingSettings, pingNotify, queueNotice } from "../_shared/billing.ts";
import { noticeRef, type NoticeKind } from "../_shared/billingCore.ts";

serve(async (req) => {
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
    console.log(`payment.id=${payment?.id} | payment.externalReference=${payment?.externalReference} | subscription=${payment?.subscription}`);

    // Initialize Supabase Client with service role to bypass RLS
    const serviceRoleKey =
      Deno.env.get("MY_SERVICE_ROLE_KEY")?.trim() ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
      "";
    console.log("serviceRoleKey length:", serviceRoleKey.length);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey
    );

    // Avisos de cobranca (e-mail e tela) feitos pelo MetaBuilder: desligados por padrao (aí tudo se comporta como antes).
    // Enfileira o aviso; no fim do webhook o site é chamado para enviar na hora (se não responder, a rotina diária envia).
    const cfg = await billingSettings(supabase);
    let queuedAny = false;
    const notify = async (kind: NoticeKind, userId: string | null, ref: string, payload: Record<string, unknown> = {}) => {
      if (await queueNotice(supabase, cfg, { kind, userId, ref, payload })) queuedAny = true;
    };

    // -----------------------------------------------------------------------
    // resolveContext: Try 3 strategies to find user_id, plan_id, cycle, etc.
    // We CANNOT rely solely on payment.externalReference — Asaas sometimes
    // omits it in PAYMENT_RECEIVED payloads for subscription payments.
    // -----------------------------------------------------------------------
    const formatUUID = (str: string): string => {
      if (!str || str.includes("-")) return str;
      if (str.length !== 32) return str;
      return `${str.slice(0, 8)}-${str.slice(8, 12)}-${str.slice(12, 16)}-${str.slice(16, 20)}-${str.slice(20)}`;
    };

    interface Context {
      userId: string;
      cycle: string;
      licenses: number;
      externalReference: string;
    }

    // 0 = a referência não informa as licenças (renovações do Asaas às vezes vêm sem ela): quem chama NÃO deve sobrescrever as licenças do perfil
    const extractLicensesFromExtRef = (extRef: string): number => {
      if (!extRef) return 0;
      const parts = extRef.split("_");
      let lIndex = parts.indexOf("l");
      if (lIndex === -1) lIndex = parts.indexOf("u");
      if (lIndex !== -1 && parts[lIndex + 1]) {
        return parseInt(parts[lIndex + 1], 10) || 1;
      }
      return 0;
    };

    const resolveContext = async (): Promise<Context | null> => {

      // --- Strategy 1: Look up by asaas_payment_id in our payments table ---
      // This is the most reliable path because the checkout always inserts the
      // payment row with user_id, plan_id, cycle — independent of externalReference.
      if (payment?.id) {
        console.log(`[S1] Looking up payments by asaas_payment_id=${payment.id}`);
        const { data, error } = await supabase
          .from("payments")
          .select("user_id, cycle, external_reference")
          .eq("asaas_payment_id", payment.id)
          .maybeSingle();

        if (error) console.error("[S1] DB error:", error);
        if (data?.user_id) {
          console.log(`[S1] Success: user_id=${data.user_id}`);
          return {
            userId: data.user_id,
            cycle: data.cycle,
            licenses: extractLicensesFromExtRef(data.external_reference),
            externalReference: data.external_reference
          };
        }
        console.log("[S1] No record found for this payment ID");
      }

      // --- Strategy 2: Look up by asaas_subscription_id in profiles ---
      // Useful when the payment row doesn't exist yet but the subscription was
      // already registered in profiles by the checkout.
      const subId = payment?.subscription || subscription?.id;
      if (subId) {
        console.log(`[S2] Looking up profiles by asaas_subscription_id=${subId}`);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, subscription_cycle, subscription_licenses")
          .eq("asaas_subscription_id", subId)
          .maybeSingle();

        if (error) console.error("[S2] DB error:", error);
        if (data?.id) {
          console.log(`[S2] Success: user_id=${data.id}`);
          return {
            userId: data.id,
            cycle: data.subscription_cycle || "",
            licenses: extractLicensesFromExtRef(payment?.externalReference || "") || Number(data.subscription_licenses) || 0,
            externalReference: payment?.externalReference || ""
          };
        }
        console.log("[S2] No profile found for this subscription ID");
      }

      // --- Strategy 3: Parse externalReference (legacy/fallback) ---
      const extRef = payment?.externalReference || subscription?.externalReference;
      if (extRef && (extRef.startsWith("w_") || extRef.startsWith("ws_"))) {
        console.log(`[S3] Parsing externalReference=${extRef}`);
        const parts = extRef.split("_");
        let userId = "";
        let cycleRaw = "";

        let licenses = 1;

        if ((extRef.includes("_l_") || extRef.includes("_u_")) && extRef.includes("_c_")) {
          let lIndex = parts.indexOf("l");
          if (lIndex === -1) lIndex = parts.indexOf("u");
          if (lIndex !== -1 && parts[lIndex + 1]) licenses = parseInt(parts[lIndex + 1]) || 1;
          const cIndex = parts.indexOf("c");
          if (cIndex !== -1 && parts[cIndex + 1]) cycleRaw = parts[cIndex + 1];
        } else {
          if (parts[0] === "u") {
            userId = parts[1]; cycleRaw = parts[7];
          } else {
            cycleRaw = parts[5];
          }
        }

        userId = formatUUID(userId);

        let cycle = cycleRaw;
        if (cycleRaw === "mo") cycle = "monthly";
        else if (cycleRaw === "qu") cycle = "quarterly";
        else if (cycleRaw === "se") cycle = "semiannual";
        else if (cycleRaw === "ye") cycle = "yearly";

        if (userId) {
          console.log(`[S3] Success: user_id=${userId}`);
          return { userId, cycle, licenses, externalReference: extRef };
        }
      }

      console.warn("[ALL] Could not resolve payment context from any strategy");
      return null;
    };

    // 2. Handle Event Types
    if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
      const ctx = await resolveContext();

      if (!ctx?.userId) {
        console.error("[PAYMENT_RECEIVED] Could not resolve payment context. Full body:", JSON.stringify(body));
        await notify("admin_unresolved", null, noticeRef([payment?.id || "sem-id"]), { event, paymentId: payment?.id, value: payment?.value });
        if (queuedAny) await pingNotify();
        // Return 200 so Asaas stops retrying — manual review needed
        return new Response(
          JSON.stringify({ success: false, message: "Could not resolve payment context — manual review needed" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Calculate expiration date
      let monthsToAdd = 1;
      if (ctx.cycle === "quarterly") monthsToAdd = 3;
      else if (ctx.cycle === "semiannual") monthsToAdd = 6;
      else if (ctx.cycle === "yearly") monthsToAdd = 12;

      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + monthsToAdd);

      const isUpgradePayment = ctx.externalReference?.includes("_u_");
      
      // estava suspenso? (o aviso de pagamento recebido diz que o acesso foi restabelecido)
      const { data: before } = await supabase.from("profiles").select("subscription_status").eq("id", ctx.userId).maybeSingle();
      const wasSuspended = before?.subscription_status === "blocked";

      const updatePayload: Record<string, any> = {
        subscription_status: "active",
        is_blocked: false,
        overdue_since: null, // pagou: a contagem da carência zera
      };
      
      if (!isUpgradePayment) {
        updatePayload.subscription_expires_at = expirationDate.toISOString();
        if (payment?.value) {
          updatePayload.subscription_amount = payment.value;
        }
      }
      
      if (ctx.cycle) updatePayload.subscription_cycle = ctx.cycle;
      if (ctx.licenses) updatePayload.subscription_licenses = ctx.licenses;

      const { error: profileError, data: oldProfile } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", ctx.userId)
        .select("asaas_subscription_id")
        .single();
        
      if (profileError) {
        console.error(`[PAYMENT_RECEIVED] Error updating profile ${ctx.userId}:`, profileError);
        throw profileError;
      }
      console.log(`[PAYMENT_RECEIVED] Profile ${ctx.userId} activated successfully`);

      // Update or insert payment record
      if (payment?.id) {
        const { data: existingPay } = await supabase
          .from("payments")
          .select("id")
          .eq("asaas_payment_id", payment.id)
          .maybeSingle();

        if (existingPay) {
          await supabase
            .from("payments")
            .update({
              status: "paid",
              webhook_payload: body,
              webhook_received_at: new Date().toISOString(),
              webhook_processed: true
            })
            .eq("asaas_payment_id", payment.id);
        } else {
          // Payment not in DB yet — insert it
          await supabase.from("payments").insert({
            user_id: ctx.userId,
            cycle: ctx.cycle || null,
            amount: payment.value || 0,
            status: "paid",
            external_reference: ctx.externalReference || null,
            billing_type: payment.billingType || null,
            asaas_payment_id: payment.id,
            webhook_payload: body,
            webhook_received_at: new Date().toISOString(),
            webhook_processed: true
          });
          console.log(`[PAYMENT_RECEIVED] Inserted new payment record for ${payment.id}`);
        }
      }

      // aviso de pagamento recebido (recibo): um por pagamento (o Asaas manda CONFIRMED e RECEIVED)
      if (payment?.id) {
        await notify("payment_received", ctx.userId, noticeRef([payment.id]), {
          paymentId: payment.id, amount: payment.value, billingType: payment.billingType, validUntil: isUpgradePayment ? null : expirationDate.toISOString(),
          wasSuspended, upgrade: !!isUpgradePayment,
        });
      }

      // =======================================================================
      // Campanha + iClub (regras e cálculo em ../_shared; ver scripts/iclub-campanhas.sql)
      // =======================================================================
      try {
        // meses de uso pagos: conta UMA vez por pagamento (o Asaas manda PAYMENT_CONFIRMED e PAYMENT_RECEIVED); a cobrança extra de upgrade não conta
        if (payment?.id && !isUpgradePayment && isCycle(ctx.cycle)) {
          const { data: claimed } = await supabase
            .from("payments")
            .update({ campaign_counted: true })
            .eq("asaas_payment_id", payment.id)
            .eq("campaign_counted", false)
            .select("id");
          if (claimed?.length) {
            const { data: cur } = await supabase.from("profiles").select("campaign_months_used").eq("id", ctx.userId).single();
            await supabase
              .from("profiles")
              .update({ campaign_months_used: (Number(cur?.campaign_months_used) || 0) + CYCLE_MONTHS[ctx.cycle] })
              .eq("id", ctx.userId);
          }
        }

        // o indicado pagou: quem indicou ganha o desconto (em carência) enquanto ele seguir assinante
        const referrerId = await processReferralConversion(supabase, ctx.userId);
        // licença grátis a cada 12 licenças contadas (as da campanha só contam depois dos meses da campanha)
        await grantVolumeLicenses(supabase, ctx.userId);

        // valor da PRÓXIMA cobrança de quem pagou (campanha que acaba, desconto de indicação, licenças) e de quem indicou
        const next = await syncNextCharge(supabase, ctx.userId);
        if (isUpgradePayment && next) {
          await supabase.from("profiles").update({ subscription_amount: next.total }).eq("id", ctx.userId);
        }
        if (referrerId) await syncNextCharge(supabase, referrerId);
      } catch (iclubErr) {
        console.error("[campanha/iClub] erro ao processar o pagamento:", iclubErr);
      }

      // programa de parceiros: o indicado de um parceiro pagou, gera a comissão (% sobre o valor líquido, disponível após a carência)
      try {
        await recordPartnerCommission(supabase, ctx.userId, { id: payment?.id, value: payment?.value, netValue: payment?.netValue });
      } catch (partnerErr) {
        console.error("[parceiros] erro ao gerar a comissão:", partnerErr);
      }
    }

    else if (event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") {
      const ctx = await resolveContext();
      if (ctx?.userId) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "canceled" })
          .eq("id", ctx.userId);
        console.log(`[SUBSCRIPTION_DELETED] Profile ${ctx.userId} marked canceled`);
        // quem foi indicado por esta pessoa deixa de dar desconto; recalcula a assinatura de quem indicou
        try {
          for (const referrerId of await revokeReferralRewards(supabase, ctx.userId)) await syncNextCharge(supabase, referrerId);
        } catch (e) { console.error("[iClub] erro ao revogar recompensas:", e); }
        try { await cancelPartnerReferral(supabase, ctx.userId); } catch (e) { console.error("[parceiros] erro ao cancelar a indicação:", e); }
      }
    }

    // cobrança nova gerada pelo Asaas (renovação): guarda o vencimento e o link, e avisa o cliente de Pix e boleto (cartão debita sozinho: sem aviso)
    else if (event === "PAYMENT_CREATED") {
      const ctx = await resolveContext();
      if (ctx?.userId && payment?.id) {
        const { data: existing } = await supabase.from("payments").select("id").eq("asaas_payment_id", payment.id).maybeSingle();
        const link = payment.invoiceUrl || payment.bankSlipUrl || null;
        if (existing) {
          // a primeira cobrança já foi gravada pelo checkout: só completa vencimento e link (o cliente está na tela, sem e-mail)
          await supabase.from("payments").update({ due_date: payment.dueDate || null, invoice_url: link }).eq("asaas_payment_id", payment.id);
        } else {
          const { error: insErr } = await supabase.from("payments").insert({
            user_id: ctx.userId,
            cycle: ctx.cycle || "monthly",
            amount: payment.value || 0,
            status: "pending",
            external_reference: ctx.externalReference || `sub_${payment.subscription || payment.id}`,
            billing_type: payment.billingType || null,
            invoice_url: link,
            asaas_payment_id: payment.id,
            due_date: payment.dueDate || null,
          });
          if (insErr) console.error("[PAYMENT_CREATED] erro ao gravar a cobrança:", insErr);
          else if (payment.billingType === "PIX" || payment.billingType === "BOLETO") {
            await notify("invoice_created", ctx.userId, noticeRef([payment.id]), { paymentId: payment.id, amount: payment.value, dueDate: payment.dueDate, billingType: payment.billingType, invoiceUrl: link });
          }
        }
      }
    }

    // cartão recusado na cobrança: avisa o cliente na hora (o atraso e a suspensão seguem o fluxo normal)
    else if (event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED") {
      const ctx = await resolveContext();
      if (ctx?.userId && payment?.id) {
        await notify("card_refused", ctx.userId, noticeRef([payment.id]), { paymentId: payment.id, amount: payment.value, dueDate: payment.dueDate });
      }
    }

    else if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_CHARGEBACK_REQUESTED") {
      const ctx = await resolveContext();
      if (payment?.id) {
        await notify("admin_refund", null, noticeRef([payment.id, event]), { event, paymentId: payment.id, userId: ctx?.userId || null, amount: payment.value });
        if (ctx?.userId && event === "PAYMENT_REFUNDED") await notify("refunded", ctx.userId, noticeRef([payment.id]), { paymentId: payment.id, amount: payment.value });
      }
      if (payment?.id) {
        await supabase
          .from("payments")
          .update({ status: "refunded", webhook_payload: body, webhook_received_at: new Date().toISOString(), webhook_processed: true })
          .eq("asaas_payment_id", payment.id);
      }
      if (ctx?.userId) {
        try {
          for (const referrerId of await revokeReferralRewards(supabase, ctx.userId)) await syncNextCharge(supabase, referrerId);
        } catch (e) { console.error("[iClub] erro ao revogar recompensas:", e); }
      }
      // a comissão desse pagamento deixa de valer (ou é descontada do próximo lote, se já saiu)
      try { if (payment?.id) await revokePartnerCommissionForPayment(supabase, payment.id, event); } catch (e) { console.error("[parceiros] erro ao revogar a comissão:", e); }
      console.log(`[${event}] payment ${payment?.id} user ${ctx?.userId}`);
    }

    // transferências Pix dos lotes de parceiros (o webhook do Asaas precisa assinar os eventos TRANSFER_*)
    else if (typeof event === "string" && event.startsWith("TRANSFER_")) {
      try { await applyTransferEvent(supabase, event, body.transfer); } catch (e) { console.error("[parceiros] erro ao aplicar o evento de transferência:", e); }
    }

    else if (event === "PAYMENT_OVERDUE") {
      const ctx = await resolveContext();
      if (ctx?.userId) {
        const { data: cur } = await supabase.from("profiles").select("overdue_since").eq("id", ctx.userId).maybeSingle();
        const overdueSince = cur?.overdue_since || new Date().toISOString();
        if (!cfg.enabled || cfg.graceDays <= 0) {
          // sem avisos, ou sem carência: suspende já (como sempre foi)
          await supabase
            .from("profiles")
            .update({ subscription_status: "blocked", is_blocked: true, overdue_since: overdueSince })
            .eq("id", ctx.userId);
        } else {
          // com carência: só marca o início do atraso; a rotina diária suspende quando ela acabar (e avisa antes)
          await supabase.from("profiles").update({ overdue_since: overdueSince }).eq("id", ctx.userId);
        }
        if (payment?.id) {
          await notify("overdue_1d", ctx.userId, noticeRef([payment.id]), { paymentId: payment.id, amount: payment.value, dueDate: payment.dueDate, invoiceUrl: payment.invoiceUrl || payment.bankSlipUrl || null, overdueSince });
          await notify("admin_overdue", null, noticeRef([payment.id]), { paymentId: payment.id, userId: ctx.userId, amount: payment.value, dueDate: payment.dueDate });
        }
      }
      if (payment?.id) {
        await supabase
          .from("payments")
          .update({
            due_date: payment.dueDate || undefined,
            status: "overdue",
            webhook_payload: body,
            webhook_received_at: new Date().toISOString(),
            webhook_processed: true
          })
          .eq("asaas_payment_id", payment.id);
      }
      console.log(`[PAYMENT_OVERDUE] Profile blocked for ${ctx?.userId}`);
    }

    // há aviso novo na fila: pede ao site para enviar já (não trava o webhook; sem resposta, a rotina diária envia)
    if (queuedAny) await pingNotify();

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
