/**
 * Ajudantes do iClub e da campanha para as Edge Functions (Deno). Usam o cliente do Supabase com service role e a API do Asaas.
 * O cálculo de preço em si mora em pricing.ts (puro e testado); aqui ficam só as leituras/gravações e as chamadas ao Asaas.
 */
import {
  freeLicensesEarned, iclubCountedLicenses, isCycle, nextChargeValue, referralPercentTotal,
  type CampaignTerms, type ChargeBreakdown, type PricingRules,
} from "./pricing.ts";

const asaasUrl = () => Deno.env.get("ASAAS_URL")?.trim() || "https://api.asaas.com/v3";
const asaasKey = () => Deno.env.get("ASAAS_API_KEY")?.trim() || "";
const asaasHeaders = () => ({ "Content-Type": "application/json", "access_token": asaasKey() });

export async function getSetting(supabase: any, key: string, field: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const v = Number(data?.value?.[field]);
  return Number.isFinite(v) ? v : fallback;
}

export async function loadRules(supabase: any): Promise<PricingRules | null> {
  const { data } = await supabase.from("pricing_rules").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ?? null;
}

/** A campanha gravada na assinatura (vazia se o cliente não comprou em campanha). */
export function campaignFromProfile(p: any): CampaignTerms | null {
  if (!p?.campaign_id || !(Number(p.campaign_months) > 0)) return null;
  return { percent: Number(p.campaign_percent) || 50, months: Number(p.campaign_months), licenses: Number(p.campaign_licenses) || Number(p.subscription_licenses) || 1 };
}

/** Desconto de indicação que vale agora para o usuário (ativo, ou pendente com a carência vencida), já limitado pelo teto do SuperAdmin. */
export async function referralPercentFor(supabase: any, userId: string, now: Date = new Date()): Promise<number> {
  const cap = await getSetting(supabase, "iclub_referral_cap_percent", "percent", 30);
  const { data } = await supabase.from("iclub_rewards").select("reward_value,status,release_at")
    .eq("user_id", userId).eq("reward_type", "percent_discount").in("status", ["active", "pending"]);
  return referralPercentTotal(data || [], cap, now);
}

/** Campanha vigente para um cliente novo (ou null). Restrita a e-mails? Só vale para eles. */
export async function findEligibleCampaign(supabase: any, email: string | null | undefined, now: Date = new Date()): Promise<any | null> {
  const iso = now.toISOString();
  const { data } = await supabase.from("pricing_campaigns").select("*")
    .eq("is_active", true).lte("starts_at", iso).gte("ends_at", iso).order("created_at", { ascending: false });
  const mail = (email || "").toLowerCase();
  return (data || []).find((c: any) => !c.allowed_emails?.length || c.allowed_emails.some((e: string) => e.toLowerCase() === mail)) ?? null;
}

/**
 * Coloca a assinatura no Asaas com o valor da PRÓXIMA cobrança (campanha, desconto de indicação e licenças já considerados) e acerta as cobranças
 * pendentes dela. Chamar depois de cada pagamento confirmado e de cada mudança que altere o valor (indicação, cancelamento, troca de plano).
 */
export async function syncNextCharge(supabase: any, userId: string): Promise<ChargeBreakdown | null> {
  const { data: p } = await supabase.from("profiles")
    .select("asaas_subscription_id, subscription_status, subscription_licenses, subscription_cycle, campaign_id, campaign_percent, campaign_months, campaign_licenses, campaign_months_used")
    .eq("id", userId).maybeSingle();
  if (!p?.asaas_subscription_id || !isCycle(p.subscription_cycle) || p.subscription_status === "canceled") return null;
  const rules = await loadRules(supabase);
  if (!rules) return null;

  const referralPercent = await referralPercentFor(supabase, userId);
  const next = nextChargeValue({
    rules, licenses: Number(p.subscription_licenses) || 1, cycle: p.subscription_cycle,
    campaign: campaignFromProfile(p), monthsUsed: Number(p.campaign_months_used) || 0, referralPercent,
  });
  if (!asaasKey()) return next;

  try {
    const put = await fetch(`${asaasUrl()}/subscriptions/${p.asaas_subscription_id}`, {
      method: "PUT", headers: asaasHeaders(), body: JSON.stringify({ value: next.total, updatePendingPayments: true }),
    });
    if (!put.ok) console.error("[syncNextCharge] PUT subscription falhou:", await put.text().catch(() => ""));

    // garante nas cobranças pendentes (caso o Asaas não tenha aplicado updatePendingPayments)
    const pend = await fetch(`${asaasUrl()}/payments?subscription=${p.asaas_subscription_id}&status=PENDING`, { headers: asaasHeaders() });
    if (pend.ok) {
      const list = (await pend.json())?.data || [];
      for (const pay of list) {
        if (Math.abs(Number(pay.value) - next.total) > 0.009) {
          const r = await fetch(`${asaasUrl()}/payments/${pay.id}`, { method: "POST", headers: asaasHeaders(), body: JSON.stringify({ value: next.total }) });
          if (!r.ok) console.error("[syncNextCharge] ajuste da cobrança pendente falhou:", pay.id, await r.text().catch(() => ""));
        }
      }
    }
  } catch (e) {
    console.error("[syncNextCharge] erro ao falar com o Asaas:", e);
  }
  return next;
}

/**
 * O indicado pagou: a indicação vira "assinante" e quem indicou ganha o desconto (em carência pelos dias configurados).
 * Devolve o id de quem indicou (para recalcular a assinatura dele), ou null se não havia indicação pendente.
 */
export async function processReferralConversion(supabase: any, referredUserId: string): Promise<string | null> {
  const { data: prof } = await supabase.from("profiles").select("email, full_name").eq("id", referredUserId).maybeSingle();
  if (!prof) return null;
  const email = (prof.email || "").toLowerCase();

  const { data: referral } = await supabase.from("iclub_referrals").select("id, referrer_id")
    .eq("status", "registered").or(`referred_id.eq.${referredUserId},referred_email.eq.${email}`).maybeSingle();
  if (!referral) return null;

  // atômico: só quem conseguir mudar de "registered" processa (o Asaas repete eventos)
  const { data: claimed } = await supabase.from("iclub_referrals")
    .update({ referred_id: referredUserId, status: "subscribed", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", referral.id).eq("status", "registered").select("id");
  if (!claimed?.length) return null;

  const { data: rule } = await supabase.from("iclub_rules").select("reward_value")
    .eq("benefit_type", "referral_discount").eq("is_active", true).maybeSingle();
  if (!rule) return referral.referrer_id; // sem regra ativa não há recompensa

  const graceDays = await getSetting(supabase, "iclub_grace_days", "days", 7);
  const releaseAt = new Date(Date.now() + Math.max(0, graceDays) * 86_400_000).toISOString();
  await supabase.from("iclub_rewards").insert({
    user_id: referral.referrer_id, referral_id: referral.id, reward_type: "percent_discount", reward_value: Number(rule.reward_value),
    status: graceDays > 0 ? "pending" : "active", release_at: graceDays > 0 ? releaseAt : null,
    notes: `Indicação de ${prof.full_name || email} (${email})`,
  });
  return referral.referrer_id;
}

/** O indicado cancelou, pediu estorno ou reembolso: o desconto de quem indicou acaba. Devolve os ids a recalcular. */
export async function revokeReferralRewards(supabase: any, referredUserId: string): Promise<string[]> {
  const { data: refs } = await supabase.from("iclub_referrals").select("id, referrer_id")
    .eq("referred_id", referredUserId).in("status", ["subscribed", "reward_applied"]);
  if (!refs?.length) return [];
  const ids = refs.map((r: any) => r.id);
  await supabase.from("iclub_referrals").update({ status: "canceled", updated_at: new Date().toISOString() }).in("id", ids);
  await supabase.from("iclub_rewards").update({ status: "revoked", updated_at: new Date().toISOString() })
    .in("referral_id", ids).in("status", ["pending", "active"]);
  return Array.from(new Set(refs.map((r: any) => r.referrer_id as string)));
}

/** Licença grátis a cada N licenças contadas (as da campanha só contam depois dos meses da campanha). Só concede o que ainda não foi concedido. */
export async function grantVolumeLicenses(supabase: any, userId: string): Promise<number> {
  const { data: rule } = await supabase.from("iclub_rules").select("target_count, reward_value")
    .eq("benefit_type", "volume_license").eq("is_active", true).maybeSingle();
  if (!rule) return 0;
  const { data: p } = await supabase.from("profiles")
    .select("subscription_licenses, campaign_id, campaign_percent, campaign_months, campaign_licenses, campaign_months_used").eq("id", userId).maybeSingle();
  if (!p) return 0;

  const counted = iclubCountedLicenses(Number(p.subscription_licenses) || 0, campaignFromProfile(p), Number(p.campaign_months_used) || 0);
  const earned = freeLicensesEarned(counted, Number(rule.target_count), Number(rule.reward_value) || 1);
  const { data: existing } = await supabase.from("iclub_rewards").select("reward_value")
    .eq("user_id", userId).eq("reward_type", "free_license").in("status", ["active", "applied"]);
  const have = (existing || []).reduce((s: number, r: any) => s + Number(r.reward_value), 0);
  if (earned <= have) return 0;
  await supabase.from("iclub_rewards").insert({
    user_id: userId, reward_type: "free_license", reward_value: earned - have, status: "active",
    notes: `Licença grátis por volume (${counted} licenças contadas)`,
  });
  return earned - have;
}
