import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

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
      workspaceId: string;
      planId: string;
      cycle: string;
      externalReference: string;
    }

    const resolveContext = async (): Promise<Context | null> => {

      // --- Strategy 1: Look up by asaas_payment_id in our payments table ---
      // This is the most reliable path because the checkout always inserts the
      // payment row with user_id, plan_id, cycle — independent of externalReference.
      if (payment?.id) {
        console.log(`[S1] Looking up payments by asaas_payment_id=${payment.id}`);
        const { data, error } = await supabase
          .from("payments")
          .select("user_id, workspace_id, plan_id, cycle, external_reference")
          .eq("asaas_payment_id", payment.id)
          .maybeSingle();

        if (error) console.error("[S1] DB error:", error);
        if (data?.user_id) {
          console.log(`[S1] Success: user_id=${data.user_id}`);
          return {
            userId: data.user_id,
            workspaceId: data.workspace_id,
            planId: data.plan_id,
            cycle: data.cycle,
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
          .select("id, plan_id, subscription_cycle")
          .eq("asaas_subscription_id", subId)
          .maybeSingle();

        if (error) console.error("[S2] DB error:", error);
        if (data?.id) {
          console.log(`[S2] Success: user_id=${data.id}`);
          const { data: ws } = await supabase
            .from("workspaces")
            .select("id")
            .eq("owner_id", data.id)
            .maybeSingle();
          return {
            userId: data.id,
            workspaceId: ws?.id || "",
            planId: data.plan_id || "",
            cycle: data.subscription_cycle || "",
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
        let workspaceId = "";
        let planId = "";
        let cycleRaw = "";

        if (parts[0] === "u") {
          userId = parts[1]; workspaceId = parts[3]; planId = parts[5]; cycleRaw = parts[7];
        } else {
          workspaceId = parts[1]; planId = parts[3]; cycleRaw = parts[5];
        }

        userId = formatUUID(userId);
        workspaceId = formatUUID(workspaceId);
        planId = formatUUID(planId);

        let cycle = cycleRaw;
        if (cycleRaw === "mo") cycle = "monthly";
        else if (cycleRaw === "qu") cycle = "quarterly";
        else if (cycleRaw === "se") cycle = "semiannual";
        else if (cycleRaw === "ye") cycle = "yearly";

        // If userId not in ref, look up workspace owner
        if (!userId && workspaceId) {
          const { data: ws } = await supabase
            .from("workspaces")
            .select("owner_id")
            .eq("id", workspaceId)
            .maybeSingle();
          if (ws?.owner_id) userId = ws.owner_id;
        }

        if (userId && workspaceId) {
          console.log(`[S3] Success: user_id=${userId}`);
          return { userId, workspaceId, planId, cycle, externalReference: extRef };
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

      // Activate the profile
      const updatePayload: Record<string, any> = {
        subscription_status: "active",
        is_blocked: false,
        subscription_expires_at: expirationDate.toISOString()
      };
      if (ctx.planId) updatePayload.plan_id = ctx.planId;
      if (ctx.cycle) updatePayload.subscription_cycle = ctx.cycle;

      const { error: profileError } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", ctx.userId);

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
            workspace_id: ctx.workspaceId || null,
            plan_id: ctx.planId || null,
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

      // =======================================================================
      // iClub: Process Referral Conversion & Apply Discounts
      // =======================================================================
      try {
        // Fetch the user's profile to get email and details
        const { data: subscribedUserProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", ctx.userId)
          .single();

        if (subscribedUserProfile) {
          const userEmail = subscribedUserProfile.email?.toLowerCase();

          // Check if there is a pending referral for this user
          const { data: referral, error: refError } = await supabase
            .from("iclub_referrals")
            .select("id, referrer_id, status")
            .eq("status", "registered")
            .or(`referred_id.eq.${ctx.userId},referred_email.eq.${userEmail}`)
            .maybeSingle();

          if (referral) {
            console.log(`[iClub] Found referral conversion! ReferralId=${referral.id}, ReferrerId=${referral.referrer_id}`);

            // 1. Update referral status to subscribed
            await supabase
              .from("iclub_referrals")
              .update({
                referred_id: ctx.userId,
                status: "subscribed",
                updated_at: new Date().toISOString()
              })
              .eq("id", referral.id);

            // 2. Fetch active referral discount rules
            const { data: rules } = await supabase
              .from("iclub_rules")
              .select("reward_value")
              .eq("benefit_type", "referral_discount")
              .eq("is_active", true)
              .maybeSingle();

            const discountValue = rules ? Number(rules.reward_value) : 5.00; // fallback to 5%

            // 3. Create active reward for referrer
            await supabase
              .from("iclub_rewards")
              .insert({
                user_id: referral.referrer_id,
                reward_type: "percent_discount",
                reward_value: discountValue,
                status: "active",
                notes: `Indicação de ${subscribedUserProfile.full_name || userEmail} (${userEmail})`
              });

            // 4. Recalculate referrer's next invoice value and apply to Asaas
            const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")?.trim();
            const ASAAS_URL = Deno.env.get("ASAAS_URL")?.trim() || "https://api.asaas.com/v3";

            if (ASAAS_API_KEY) {
              // Get referrer profile
              const { data: referrerProfile } = await supabase
                .from("profiles")
                .select("asaas_subscription_id")
                .eq("id", referral.referrer_id)
                .single();

              if (referrerProfile?.asaas_subscription_id) {
                // Get all active percent discount rewards for referrer
                const { data: activeRewards } = await supabase
                  .from("iclub_rewards")
                  .select("reward_value")
                  .eq("user_id", referral.referrer_id)
                  .eq("reward_type", "percent_discount")
                  .eq("status", "active");

                const totalDiscountPercent = Math.min(
                  activeRewards ? activeRewards.reduce((sum, r) => sum + Number(r.reward_value), 0) : 0,
                  100
                );

                console.log(`[iClub] Referrer total discount percentage: ${totalDiscountPercent}%`);

                if (totalDiscountPercent > 0) {
                  // Fetch referrer's subscription from Asaas to get base price
                  const subRes = await fetch(`${ASAAS_URL}/subscriptions/${referrerProfile.asaas_subscription_id}`, {
                    headers: { "access_token": ASAAS_API_KEY }
                  });

                  if (subRes.ok) {
                    const subData = await subRes.json();
                    const basePrice = Number(subData.value);

                    // Fetch next pending payment
                    const paymentsRes = await fetch(
                      `${ASAAS_URL}/payments?subscription=${referrerProfile.asaas_subscription_id}&status=PENDING`,
                      { headers: { "access_token": ASAAS_API_KEY } }
                    );

                    if (paymentsRes.ok) {
                      const paymentsData = await paymentsRes.json();
                      if (paymentsData.data && paymentsData.data.length > 0) {
                        const firstPendingPayment = paymentsData.data[0];
                        const newPrice = Math.max(0, basePrice * (1 - totalDiscountPercent / 100));

                        console.log(`[iClub] Updating pending payment ${firstPendingPayment.id} in Asaas from ${basePrice} to ${newPrice}`);

                        // Update payment value in Asaas
                        const updatePayRes = await fetch(`${ASAAS_URL}/payments/${firstPendingPayment.id}`, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            "access_token": ASAAS_API_KEY
                          },
                          body: JSON.stringify({ value: newPrice })
                        });

                        if (!updatePayRes.ok) {
                          const payErr = await updatePayRes.json().catch(() => ({}));
                          console.error(`[iClub] Error updating payment in Asaas:`, payErr);
                        } else {
                          console.log(`[iClub] Successfully updated payment ${firstPendingPayment.id} value in Asaas.`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // 5. Consume active rewards for the user who just made a payment (if they have active percent_discount rewards)
        const { data: userRewardsToConsume } = await supabase
          .from("iclub_rewards")
          .select("id")
          .eq("user_id", ctx.userId)
          .eq("reward_type", "percent_discount")
          .eq("status", "active");

        if (userRewardsToConsume && userRewardsToConsume.length > 0) {
          const rewardIds = userRewardsToConsume.map(r => r.id);
          console.log(`[iClub] Consuming ${rewardIds.length} active percent_discount rewards for user ${ctx.userId}`);
          
          await supabase
            .from("iclub_rewards")
            .update({
              status: "applied",
              notes: `Aplicado no pagamento Asaas ID ${payment?.id || 'unknown'}`,
              updated_at: new Date().toISOString()
            })
            .in("id", rewardIds);
        }
      } catch (iclubErr) {
        console.error("[iClub] Error processing referral conversion / discounts:", iclubErr);
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
      }
    }

    else if (event === "PAYMENT_OVERDUE") {
      const ctx = await resolveContext();
      if (ctx?.userId) {
        await supabase
          .from("profiles")
          .update({ subscription_status: "blocked", is_blocked: true })
          .eq("id", ctx.userId);
      }
      if (payment?.id) {
        await supabase
          .from("payments")
          .update({
            status: "overdue",
            webhook_payload: body,
            webhook_received_at: new Date().toISOString(),
            webhook_processed: true
          })
          .eq("asaas_payment_id", payment.id);
      }
      console.log(`[PAYMENT_OVERDUE] Profile blocked for ${ctx?.userId}`);
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
