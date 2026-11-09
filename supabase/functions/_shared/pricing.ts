/**
 * Cálculo de preço ÚNICO do MetaBuilder PRO. Funções puras (sem imports): serve às Edge Functions (Deno), ao site e aos testes.
 * Antes o preço era calculado em 3 lugares (checkout, troca de plano, webhook) com padrões diferentes; qualquer regra nova mora aqui.
 *
 * Regras (combinadas em 2026-11-09):
 *  - Preço regular por licença/mês = base × (1 − volume) × (1 − ciclo). O volume vale pelo TOTAL de licenças.
 *  - Campanha (ex.: Black November): os N primeiros MESES DE USO custam `percent`% da tabela por licença, e esse preço SUBSTITUI os descontos
 *    (não soma). Vale o menor entre o preço da campanha e o preço regular. Meses depois da campanha: preço regular.
 *    Plano semestral/anual é pago de uma vez: a primeira cobrança já traz os meses da campanha somados.
 *  - Licenças acrescentadas depois da compra pagam preço regular; a campanha vale só para a quantidade da compra original.
 *  - Desconto de indicação (iClub) vale só sobre a parte REGULAR da cobrança (a parte da campanha fica de fora), com teto.
 *  - Licenças da campanha só contam para as "12 licenças" do iClub depois que os meses da campanha acabam.
 */

export type Cycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly'

export const CYCLE_MONTHS: Record<Cycle, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }

export interface PricingRules {
  base_price: number | string
  volume_tiers?: { min_licenses: number; discount_percent: number }[] | null
  cycle_discounts?: Record<string, any> | null
}

/** Condição da campanha GRAVADA na assinatura (mudar a campanha depois não altera quem já comprou). */
export interface CampaignTerms {
  /** % da tabela cobrado por licença nos meses da campanha (50 = metade do preço) */
  percent: number
  /** quantos meses de uso a campanha cobre */
  months: number
  /** quantas licenças foram compradas na campanha (as acrescentadas depois pagam preço regular) */
  licenses: number
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100
const num = (v: unknown, fallback = 0): number => { const n = Number(v); return Number.isFinite(n) ? n : fallback }
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export const isCycle = (c: unknown): c is Cycle => c === 'monthly' || c === 'quarterly' || c === 'semiannual' || c === 'yearly'

/** Ciclos desativados ficam em cycle_discounts.disabled_cycles. O mensal é a base e nunca desativa. */
export function isCycleEnabled(rules: PricingRules, cycle: Cycle, alsoKeep?: string | null): boolean {
  if (cycle === 'monthly' || cycle === alsoKeep) return true
  const disabled = rules.cycle_discounts?.disabled_cycles
  return !(Array.isArray(disabled) && disabled.includes(cycle))
}

export function volumeDiscountPercent(rules: PricingRules, licenses: number): number {
  const tiers = [...(rules.volume_tiers || [])].sort((a, b) => num(b.min_licenses) - num(a.min_licenses))
  const tier = tiers.find(t => licenses >= num(t.min_licenses))
  return tier ? num(tier.discount_percent) : 0
}

/** Desconto do ciclo. Um 0 digitado na tela vale 0 (antes, `|| 15` transformava 0 em 15). */
export function cycleDiscountPercent(rules: PricingRules, cycle: Cycle): number {
  if (cycle === 'monthly') return num(rules.cycle_discounts?.monthly, 0)
  return num(rules.cycle_discounts?.[cycle], 0)
}

export const basePrice = (rules: PricingRules): number => num(rules.base_price, 0)

/** Preço regular de UMA licença por mês neste ciclo (sem arredondar). */
export function regularUnitMonthly(rules: PricingRules, licenses: number, cycle: Cycle): number {
  return basePrice(rules) * (1 - volumeDiscountPercent(rules, licenses) / 100) * (1 - cycleDiscountPercent(rules, cycle) / 100)
}

export interface ChargeInput {
  rules: PricingRules
  licenses: number
  cycle: Cycle
  campaign?: CampaignTerms | null
  /** meses de campanha que ainda restam ANTES desta cobrança (padrão: todos). Use campaignMonthsRemaining() para a próxima cobrança. */
  campaignMonthsRemaining?: number
  /** % de desconto de indicação já limitado pelo teto */
  referralPercent?: number
}

export interface ChargeBreakdown {
  months: number
  /** meses desta cobrança que saem pelo preço da campanha */
  campaignMonths: number
  regularMonths: number
  campaignLicenses: number
  extraLicenses: number
  regularUnit: number
  campaignUnit: number
  campaignPart: number
  regularPart: number
  referralPercent: number
  referralDiscount: number
  total: number
}

export function chargeBreakdown(input: ChargeInput): ChargeBreakdown {
  const licenses = Math.max(1, Math.floor(num(input.licenses, 1)))
  const months = CYCLE_MONTHS[input.cycle]
  const regularUnit = regularUnitMonthly(input.rules, licenses, input.cycle)

  const campaign = input.campaign && input.campaign.months > 0 ? input.campaign : null
  const remaining = campaign ? (input.campaignMonthsRemaining ?? campaign.months) : 0
  const campaignMonths = campaign ? clamp(Math.floor(remaining), 0, months) : 0
  const campaignLicenses = campaign ? clamp(Math.floor(num(campaign.licenses, licenses)), 0, licenses) : 0
  const extraLicenses = licenses - campaignLicenses
  // o menor entre o preço da campanha e o preço regular: a campanha nunca sai pior que a compra normal
  const campaignUnit = campaign ? Math.min(basePrice(input.rules) * (num(campaign.percent, 50) / 100), regularUnit) : regularUnit

  const regularMonths = months - campaignMonths
  const campaignPart = campaignLicenses * campaignMonths * campaignUnit
  const regularPart = campaignLicenses * regularMonths * regularUnit + extraLicenses * months * regularUnit

  const referralPercent = clamp(num(input.referralPercent, 0), 0, 100)
  const referralDiscount = regularPart * (referralPercent / 100)

  return {
    months, campaignMonths, regularMonths, campaignLicenses, extraLicenses,
    regularUnit: round2(regularUnit), campaignUnit: round2(campaignUnit),
    campaignPart: round2(campaignPart), regularPart: round2(regularPart),
    referralPercent, referralDiscount: round2(referralDiscount),
    total: round2(campaignPart + regularPart - referralDiscount),
  }
}

/** Meses de campanha que restam depois de `monthsUsed` meses já cobrados. */
export const campaignMonthsRemaining = (campaign: CampaignTerms | null | undefined, monthsUsed: number): number =>
  campaign ? Math.max(0, campaign.months - Math.max(0, monthsUsed)) : 0

/** Valor da PRÓXIMA cobrança de uma assinatura, dado quantos meses de campanha já foram usados. */
export function nextChargeValue(args: Omit<ChargeInput, 'campaignMonthsRemaining'> & { monthsUsed: number }): ChargeBreakdown {
  return chargeBreakdown({ ...args, campaignMonthsRemaining: campaignMonthsRemaining(args.campaign, args.monthsUsed) })
}

// ---- iClub ----

export interface RewardRow { reward_value: number | string; status: string; release_at?: string | null }

/**
 * Soma dos descontos de indicação que valem AGORA: recompensas ativas, e as pendentes cuja carência já passou. Limitada pelo teto
 * (configurado pelo SuperAdmin) e por 100.
 */
export function referralPercentTotal(rewards: RewardRow[], capPercent: number, now: Date = new Date()): number {
  const sum = (rewards || []).reduce((acc, r) => {
    const live = r.status === 'active' || (r.status === 'pending' && !!r.release_at && new Date(r.release_at).getTime() <= now.getTime())
    return live ? acc + num(r.reward_value) : acc
  }, 0)
  return clamp(sum, 0, Math.min(100, Math.max(0, num(capPercent, 100))))
}

/** Licenças que contam para as "12 licenças": as da campanha só contam depois que os meses da campanha acabam. */
export function iclubCountedLicenses(licenses: number, campaign: CampaignTerms | null | undefined, monthsUsed: number): number {
  const inCampaign = campaign && monthsUsed < campaign.months ? clamp(campaign.licenses, 0, licenses) : 0
  return Math.max(0, licenses - inCampaign)
}

/** Licenças grátis ganhas: 1 (ou `perReward`) a cada `target` licenças contadas. */
export const freeLicensesEarned = (counted: number, target: number, perReward = 1): number =>
  target > 0 ? Math.floor(Math.max(0, counted) / target) * perReward : 0
