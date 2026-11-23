import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { grantVolumeLicenses, processReferralConversion, revokeReferralRewards, syncNextCharge } from "../_shared/iclub.ts";
import { CYCLE_MONTHS, isCycle } from "../_shared/pricing.ts";
import { applyTransferEvent, cancelPartnerReferral, recordPartnerCommission, revokePartnerCommissionForPayment } from "../_shared/partners.ts";
import { billingSettings, pingNotify, queueNotice, queuePayoutNotice } from "../_shared/billing.ts";
import { isCheckoutOnly, noticeRef, payoutIsFinal, type NoticeKind } from "../_shared/billingCore.ts";
import { isForeignAsaasEvent, keyAlertDecision, loadAsaasApps } from "../_shared/asaasApps.ts";
import { closeRefundLog, partialRefundValue } from "../_shared/adminBilling.ts";
import { appOfRef, isOwnRef, parsePaymentRef } from "../_shared/familyRefs.ts";

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

    // O webhook do Asaas é da CONTA INTEIRA: também chegam aqui os eventos de pagamento, assinatura e nota dos OUTROS apps que usam a mesma conta
    // (ex.: TraderMasterPRO). Evento de pagamento/assinatura/nota cuja referência externa NÃO tem o formato do MetaBuilder e que NÃO está no nosso
    // banco é de outro app: ignora (200, para o Asaas não reenviar) em vez de gerar "pagamento sem cliente identificado" ou aviso de estorno.
    // Sem referência externa não dá para saber: segue o fluxo normal (e o alerta de não identificado continua valendo). Falha aqui nunca derruba o evento.
    if (typeof event === "string" && /^(PAYMENT|SUBSCRIPTION|INVOICE)_/.test(event)) {
      try {
        const invoice = (body.invoice || {}) as Record<string, any>;
        const ref = payment?.externalReference ?? subscription?.externalReference ?? invoice.externalReference;
        if (typeof ref === "string" && ref.trim() && !isOwnRef(ref)) {
          const payId = payment?.id ?? invoice.payment;
          const subId = payment?.subscription || subscription?.id;
          const [knownPay, knownSub] = await Promise.all([
            payId ? supabase.from("payments").select("id").eq("asaas_payment_id", payId).maybeSingle() : Promise.resolve({ data: null }),
            subId ? supabase.from("profiles").select("id").eq("asaas_subscription_id", subId).maybeSingle() : Promise.resolve({ data: null }),
          ]);
          if (isForeignAsaasEvent({ externalReference: ref, isOwnFormat: isOwnRef(ref), isKnownPayment: !!knownPay.data, isKnownSubscription: !!knownSub.data })) {
            console.log(`[app-externo] ${event} ignorado: a referência "${String(ref).slice(0, 40)}" não é do MetaBuilder (app da família: ${appOfRef(ref) ?? "fora do padrão"})`);
            return new Response(JSON.stringify({ success: true, ignored: "other_app" }), { status: 200, headers: { "Content-Type": "application/json" } });
          }
        }
      } catch (e) { console.error("[app-externo] erro ao conferir o dono do evento (segue o fluxo normal):", e); }
    }

    // Avisos de cobranca (e-mail e tela) feitos pelo MetaBuilder: desligados por padrao (aí tudo se comporta como antes).
    // Enfileira o aviso; no fim do webhook o site é chamado para enviar na hora (se não responder, a rotina diária envia).
    const cfg = await billingSettings(supabase);
    // payments.external_reference é ÚNICO, mas o Asaas repete a referência da assinatura em TODAS as cobranças dela (renovações). Sem isto o insert da renovação
    // falhava em silêncio e o pagamento não era gravado (sem histórico, sem fila de NFS-e, sem comissão). A primeira cobrança já tem a referência original.
    const renewalRef = (base: string | null | undefined, paymentId: string) => (base ? `${base}~${paymentId}` : `sub_${paymentId}`);
    let queuedAny = false;
    const notify = async (kind: NoticeKind, userId: string | null, ref: string, payload: Record<string, unknown> = {}) => {
      if (await queueNotice(supabase, cfg, { kind, userId, ref, payload })) queuedAny = true;
    };

    // -----------------------------------------------------------------------
    // resolveContext: acha user_id, ciclo etc. por 2 caminhos do nosso banco (pagamento, assinatura).
    // We CANNOT rely solely on payment.externalReference — Asaas sometimes
    // omits it in PAYMENT_RECEIVED payloads for subscription payments.
    // -----------------------------------------------------------------------
    interface Context {
      userId: string;
      cycle: string;
      licenses: number;
      externalReference: string;
    }

    // 0 = a referência não informa as licenças (renovações do Asaas às vezes vêm sem ela): quem chama NÃO deve sobrescrever as licenças do perfil
    const extractLicensesFromExtRef = (extRef: string): number => {
      if (!extRef) return 0;
      // lê pelo padrão da Família PRO (familyRefs.ts), e não pela posição das letras
      const parsed = parsePaymentRef(extRef);
      return parsed ? parsed.licenses || 1 : 0;
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

      // (A antiga "Strategy 3" lia o usuário da própria referência externa, mas a referência traz o WORKSPACE, não o usuário: nunca resolvia nada.
      // Foi removida. O usuário sai sempre do nosso banco: S1 pelo pagamento, S2 pela assinatura.)

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

      const isUpgradePayment = parsePaymentRef(ctx.externalReference)?.upgrade === true;
      
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
          const { error: payInsErr } = await supabase.from("payments").insert({
            user_id: ctx.userId,
            cycle: ctx.cycle || null,
            amount: payment.value || 0,
            status: "paid",
            external_reference: renewalRef(ctx.externalReference, payment.id),
            billing_type: payment.billingType || null,
            asaas_payment_id: payment.id,
            webhook_payload: body,
            webhook_received_at: new Date().toISOString(),
            webhook_processed: true
          });
          if (payInsErr) console.error("[PAYMENT_RECEIVED] erro ao gravar o pagamento:", payInsErr);
          else console.log(`[PAYMENT_RECEIVED] Inserted new payment record for ${payment.id}`);
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
          .eq("id", ctx.userId)
          .neq("subscription_status", "blocked"); // cliente bloqueado pelo admin continua bloqueado (cancelar a cobrança não pode desbloquear o status)
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
            external_reference: renewalRef(ctx.externalReference, payment.id),
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
        // se o estorno foi pedido pela tela do SuperAdmin, fecha o registro dele como "feito"
        await closeRefundLog(supabase, payment.id, event, { value: payment.value ?? null });
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

    // estorno parcial: a cobrança CONTINUA paga (o valor devolvido fica só no registro e no aviso ao admin; comissão e recompensas não mudam)
    // estorno negado: o Asaas recusou; o registro do SuperAdmin vira "falhou". Em andamento: só anota.
    else if (event === "PAYMENT_PARTIALLY_REFUNDED" || event === "PAYMENT_REFUND_DENIED" || event === "PAYMENT_REFUND_IN_PROGRESS") {
      const ctx = await resolveContext();
      if (payment?.id) {
        const partial = event === "PAYMENT_PARTIALLY_REFUNDED";
        // o valor devolvido (payment.value é o TOTAL do pagamento): lido ANTES de fechar o registro, que é de onde ele vem
        const refunded = partial ? await partialRefundValue(supabase, payment.id, payment) : null;
        await closeRefundLog(supabase, payment.id, event, partial ? { value: refunded, paymentValue: payment.value ?? null } : { value: payment.value ?? null });
        // vários estornos parciais do mesmo pagamento são avisos diferentes: a referência leva o valor e quantos estornos já existem
        const partialRef = [payment.id, event, refunded ?? "x", Array.isArray(payment.refunds) ? payment.refunds.length : 0];
        if (event !== "PAYMENT_REFUND_IN_PROGRESS") {
          await notify("admin_refund", null, noticeRef(partial ? partialRef : [payment.id, event]), { event, paymentId: payment.id, userId: ctx?.userId || null, amount: payment.value, refundedAmount: refunded });
        }
        // o cliente também é avisado do estorno parcial (o do total já é avisado no ramo de PAYMENT_REFUNDED)
        if (partial && ctx?.userId) {
          await notify("refunded", ctx.userId, noticeRef(["partial", ...partialRef]), { paymentId: payment.id, amount: payment.value, refundedAmount: refunded, partial: true });
        }
      }
      console.log(`[${event}] payment ${payment?.id} user ${ctx?.userId}`);
    }

    // cobrança apagada (pelo admin ou direto no painel do Asaas): sai da lista de abertas e, se era a única vencida, o atraso acaba
    else if (event === "PAYMENT_DELETED") {
      const ctx = await resolveContext();
      if (payment?.id) {
        await supabase.from("payments").update({ status: "canceled", webhook_processed: true }).eq("asaas_payment_id", payment.id).in("status", ["pending", "overdue"]);
        if (ctx?.userId) {
          const { data: stillOverdue } = await supabase.from("payments").select("id").eq("user_id", ctx.userId).eq("status", "overdue").limit(1).maybeSingle();
          if (!stillOverdue) await supabase.from("profiles").update({ overdue_since: null }).eq("id", ctx.userId);
        }
      }
    }

    // cobrança restaurada no painel do Asaas: volta a ficar em aberto
    else if (event === "PAYMENT_RESTORED") {
      if (payment?.id) {
        await supabase.from("payments").update({ status: "pending", due_date: payment.dueDate || null, webhook_processed: true }).eq("asaas_payment_id", payment.id).eq("status", "canceled");
      }
    }

    // vencimento ou valor mudou no painel do Asaas: só cobrança ABERTA acompanha (paga não muda). Voltar a "aguardando" tira o atraso.
    else if (event === "PAYMENT_UPDATED") {
      const ctx = await resolveContext();
      if (payment?.id) {
        const patch: Record<string, unknown> = { webhook_processed: true };
        if (payment.dueDate) patch.due_date = payment.dueDate;
        if (payment.value != null) patch.amount = payment.value;
        const link = payment.invoiceUrl || payment.bankSlipUrl || null;
        if (link) patch.invoice_url = link;
        const backToPending = String(payment.status || "").toUpperCase() === "PENDING";
        if (backToPending) patch.status = "pending";
        await supabase.from("payments").update(patch).eq("asaas_payment_id", payment.id).in("status", ["pending", "overdue"]);
        if (backToPending && ctx?.userId) {
          const { data: stillOverdue } = await supabase.from("payments").select("id").eq("user_id", ctx.userId).eq("status", "overdue").limit(1).maybeSingle();
          if (!stillOverdue) await supabase.from("profiles").update({ overdue_since: null }).eq("id", ctx.userId);
        }
      }
    }

    // transferências Pix dos lotes de parceiros (o webhook do Asaas precisa assinar os eventos TRANSFER_*)
    else if (typeof event === "string" && event.startsWith("TRANSFER_")) {
      try {
        const outcome = await applyTransferEvent(supabase, event, body.transfer);
        if (outcome) {
          // Pix concluído: avisa o parceiro (um por item). Lote inteiro terminado (pagos ou com falha): resumo ao admin (um por lote). Não dependem do
          // interruptor dos avisos de cobrança; falha ao enfileirar nunca derruba o webhook.
          if (outcome.result === "done" && await queuePayoutNotice(supabase, { kind: "partner_payout_paid", ref: outcome.itemId, payload: { itemId: outcome.itemId } })) queuedAny = true;
          const { data: items } = await supabase.from("partner_payout_items").select("status").eq("payout_id", outcome.payoutId);
          if (payoutIsFinal((items || []).map((i: { status: string }) => i.status))
            && await queuePayoutNotice(supabase, { kind: "admin_payout_summary", ref: outcome.payoutId, payload: { payoutId: outcome.payoutId } })) queuedAny = true;
        }
      } catch (e) { console.error("[parceiros] erro ao aplicar o evento de transferência:", e); }
    }

    // chave de API do Asaas (vai expirar, desabilitada, expirou, criada...): avisa o admin na hora. O checkout e os repasses dependem dela, e uma chave
    // desabilitada derruba tudo em silêncio. Não depende do interruptor dos avisos de cobrança. Nunca guarda nada além do nome e da validade que o Asaas informar.
    else if (typeof event === "string" && event.startsWith("ACCESS_TOKEN_")) {
      try {
        const tok = (body.accessToken || body.apiKey || {}) as Record<string, unknown>;
        const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).slice(0, 120) : null);
        // A conta tem mais de um app: a chave é nossa (urgente), de outro app cadastrado (aviso discreto ou nenhum) ou desconhecida (avisa, pedindo para cadastrar)?
        const { send, scope } = keyAlertDecision(str(tok.name), await loadAsaasApps(supabase));
        if (!send) console.log(`[chave-api] ${event} da chave de outro app ("${str(tok.name)}"): aviso desligado nos ajustes`);
        else if (await queuePayoutNotice(supabase, {
          kind: "admin_key_alert",
          ref: noticeRef([typeof body.id === "string" && body.id ? body.id : `${event}:${new Date().toISOString().slice(0, 13)}`]),
          payload: { event, keyName: str(tok.name), expiresAt: str(tok.expirationDate ?? tok.expiresAt), scope },
        })) queuedAny = true;
      } catch (e) { console.error("[chave-api] erro ao enfileirar o alerta:", e); }
    }

    else if (event === "PAYMENT_OVERDUE") {
      const ctx = await resolveContext();
      // FREE que só abriu o checkout e nunca pagou: não é suspenso, não entra na carência e não recebe aviso de atraso (a rotina diária manda só um lembrete suave)
      let checkoutOnly = false;
      if (ctx?.userId) {
        const { data: tierRow } = await supabase.from("profiles").select("subscription_tier").eq("id", ctx.userId).maybeSingle();
        const { count: paidCount } = await supabase.from("payments").select("id", { count: "exact", head: true }).eq("user_id", ctx.userId).eq("status", "paid");
        checkoutOnly = isCheckoutOnly(tierRow?.subscription_tier, paidCount ?? 0);
      }
      if (ctx?.userId && !checkoutOnly) {
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
      console.log(checkoutOnly ? `[PAYMENT_OVERDUE] ${ctx?.userId} é FREE sem pagamento: nada bloqueado` : `[PAYMENT_OVERDUE] Profile blocked for ${ctx?.userId}`);
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
