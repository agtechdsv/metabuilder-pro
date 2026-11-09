import { describe, it, expect } from 'vitest'
import {
  chargeBreakdown, nextChargeValue, campaignMonthsRemaining, referralPercentTotal, iclubCountedLicenses, freeLicensesEarned,
  cycleDiscountPercent, isCycleEnabled, volumeDiscountPercent, type CampaignTerms, type Cycle, type PricingRules,
} from '../../../supabase/functions/_shared/pricing'

// a tabela da tela de preços (Regras de Preços) em 2026-11-09
const RULES: PricingRules = {
  base_price: 349,
  volume_tiers: [{ min_licenses: 5, discount_percent: 5 }, { min_licenses: 20, discount_percent: 10 }, { min_licenses: 50, discount_percent: 15 }],
  cycle_discounts: { monthly: 0, quarterly: 10, semiannual: 10, yearly: 20, disabled_cycles: ['quarterly'] },
}
const camp = (licenses: number): CampaignTerms => ({ percent: 50, months: 2, licenses })
const first = (licenses: number, cycle: Cycle) => chargeBreakdown({ rules: RULES, licenses, cycle, campaign: camp(licenses) }).total
const renewal = (licenses: number, cycle: Cycle) => chargeBreakdown({ rules: RULES, licenses, cycle }).total

describe('preço regular', () => {
  it('bate com a tela de Regras de Preços', () => {
    expect(renewal(1, 'monthly')).toBe(349)
    expect(renewal(1, 'semiannual')).toBe(1884.6)
    expect(renewal(1, 'yearly')).toBe(3350.4)
    expect(renewal(5, 'monthly')).toBe(1657.75)
    expect(renewal(5, 'semiannual')).toBe(8951.85)
    expect(renewal(5, 'yearly')).toBe(15914.4)
    expect(renewal(50, 'yearly')).toBe(142392)
  })
  it('desconto 0 digitado vale 0 (não vira o padrão antigo)', () => {
    const r = { ...RULES, cycle_discounts: { ...RULES.cycle_discounts, semiannual: 0 } }
    expect(cycleDiscountPercent(r, 'semiannual')).toBe(0)
    expect(chargeBreakdown({ rules: r, licenses: 1, cycle: 'semiannual' }).total).toBe(2094)
  })
  it('ciclo desativado é reconhecido; o mensal nunca desativa', () => {
    expect(isCycleEnabled(RULES, 'quarterly')).toBe(false)
    expect(isCycleEnabled(RULES, 'quarterly', 'quarterly')).toBe(true)
    expect(isCycleEnabled(RULES, 'monthly')).toBe(true)
    expect(isCycleEnabled(RULES, 'yearly')).toBe(true)
    expect(volumeDiscountPercent(RULES, 19)).toBe(5)
    expect(volumeDiscountPercent(RULES, 20)).toBe(10)
  })
})

describe('campanha: os exemplos combinados com o dono', () => {
  it('1 licença', () => {
    expect(first(1, 'monthly')).toBe(174.5)
    expect(first(1, 'semiannual')).toBe(1605.4) // 2 × 174,50 + 4 × 314,10
    expect(first(1, 'yearly')).toBe(3141) // 2 × 174,50 + 10 × 279,20
  })
  it('5 licenças', () => {
    expect(first(5, 'monthly')).toBe(872.5)
    expect(first(5, 'semiannual')).toBe(7712.9)
    expect(first(5, 'yearly')).toBe(15007)
  })
  it('a campanha substitui os descontos nos meses dela (não soma)', () => {
    const b = chargeBreakdown({ rules: RULES, licenses: 5, cycle: 'yearly', campaign: camp(5) })
    expect(b.campaignUnit).toBe(174.5)
    expect(b.campaignMonths).toBe(2)
    expect(b.regularMonths).toBe(10)
    expect(b.regularUnit).toBe(265.24)
  })
  it('mensal: 2 cobranças da campanha e depois o preço regular', () => {
    const c = camp(1)
    expect(nextChargeValue({ rules: RULES, licenses: 1, cycle: 'monthly', campaign: c, monthsUsed: 0 }).total).toBe(174.5)
    expect(nextChargeValue({ rules: RULES, licenses: 1, cycle: 'monthly', campaign: c, monthsUsed: 1 }).total).toBe(174.5)
    expect(nextChargeValue({ rules: RULES, licenses: 1, cycle: 'monthly', campaign: c, monthsUsed: 2 }).total).toBe(349)
    expect(nextChargeValue({ rules: RULES, licenses: 5, cycle: 'monthly', campaign: camp(5), monthsUsed: 2 }).total).toBe(1657.75)
  })
  it('semestral/anual: a renovação já vem a preço regular', () => {
    expect(nextChargeValue({ rules: RULES, licenses: 1, cycle: 'semiannual', campaign: camp(1), monthsUsed: 6 }).total).toBe(1884.6)
    expect(nextChargeValue({ rules: RULES, licenses: 1, cycle: 'yearly', campaign: camp(1), monthsUsed: 12 }).total).toBe(3350.4)
  })
  it('campanha mais longa que o ciclo se espalha pelas cobranças (3 meses no mensal; 8 meses no semestral)', () => {
    const c: CampaignTerms = { percent: 50, months: 8, licenses: 1 }
    const semi = (used: number) => nextChargeValue({ rules: RULES, licenses: 1, cycle: 'semiannual', campaign: c, monthsUsed: used })
    expect(semi(0).campaignMonths).toBe(6)
    expect(semi(0).total).toBe(1047) // 6 × 174,50
    expect(semi(6).campaignMonths).toBe(2)
    expect(semi(6).total).toBe(1605.4)
    expect(semi(12).campaignMonths).toBe(0)
  })
  it('nunca sai pior que a compra normal: vale o menor entre campanha e preço regular', () => {
    const agressiva: PricingRules = { ...RULES, volume_tiers: [{ min_licenses: 1, discount_percent: 60 }] }
    const b = chargeBreakdown({ rules: agressiva, licenses: 2, cycle: 'monthly', campaign: { percent: 50, months: 1, licenses: 2 } })
    expect(b.campaignUnit).toBe(139.6) // 349 × 0,4, menor que 174,50
  })
  it('licenças acrescentadas pagam preço regular; a campanha vale só para a quantidade original', () => {
    const b = chargeBreakdown({ rules: RULES, licenses: 6, cycle: 'monthly', campaign: { percent: 50, months: 2, licenses: 4 } })
    expect(b.campaignLicenses).toBe(4)
    expect(b.extraLicenses).toBe(2)
    // 4 × 174,50 + 2 × (349 × 0,95 = 331,55)
    expect(b.total).toBe(1361.1)
  })
  it('campanha com mais licenças que o total (rebaixou) não passa do total', () => {
    const b = chargeBreakdown({ rules: RULES, licenses: 2, cycle: 'monthly', campaign: { percent: 50, months: 2, licenses: 9 } })
    expect(b.campaignLicenses).toBe(2)
    expect(b.extraLicenses).toBe(0)
  })
  it('sem campanha (ou com 0 meses) é o preço regular', () => {
    expect(chargeBreakdown({ rules: RULES, licenses: 3, cycle: 'yearly', campaign: null }).total).toBe(renewal(3, 'yearly'))
    expect(chargeBreakdown({ rules: RULES, licenses: 3, cycle: 'yearly', campaign: { percent: 50, months: 0, licenses: 3 } }).total).toBe(renewal(3, 'yearly'))
  })
  it('campaignMonthsRemaining', () => {
    expect(campaignMonthsRemaining(camp(1), 0)).toBe(2)
    expect(campaignMonthsRemaining(camp(1), 1)).toBe(1)
    expect(campaignMonthsRemaining(camp(1), 5)).toBe(0)
    expect(campaignMonthsRemaining(null, 0)).toBe(0)
  })
})

describe('desconto de indicação (iClub)', () => {
  it('vale só sobre a parte regular; a parte da campanha fica de fora', () => {
    const b = chargeBreakdown({ rules: RULES, licenses: 1, cycle: 'yearly', campaign: camp(1), referralPercent: 10 })
    // campanha 349 + regular 2792, com 10% só nos 2792
    expect(b.referralDiscount).toBe(279.2)
    expect(b.total).toBe(2861.8)
  })
  it('sem campanha, aplica sobre o total', () => {
    expect(chargeBreakdown({ rules: RULES, licenses: 1, cycle: 'monthly', referralPercent: 7 }).total).toBe(324.57)
  })
  it('soma as recompensas que valem agora, respeitando o teto e a carência', () => {
    const now = new Date('2026-11-20T12:00:00Z')
    const rewards = [
      { reward_value: 7, status: 'active' },
      { reward_value: 7, status: 'active' },
      { reward_value: 7, status: 'pending', release_at: '2026-11-19T00:00:00Z' }, // carência já passou
      { reward_value: 7, status: 'pending', release_at: '2026-11-25T00:00:00Z' }, // ainda em carência
      { reward_value: 7, status: 'revoked' },
      { reward_value: 7, status: 'applied' },
    ]
    expect(referralPercentTotal(rewards, 100, now)).toBe(21)
    expect(referralPercentTotal(rewards, 30, now)).toBe(21)
    expect(referralPercentTotal(rewards, 15, now)).toBe(15)
    expect(referralPercentTotal([], 30, now)).toBe(0)
  })
})

describe('licença grátis por volume (iClub)', () => {
  it('as licenças da campanha só contam depois dos meses da campanha', () => {
    expect(iclubCountedLicenses(12, camp(12), 0)).toBe(0)
    expect(iclubCountedLicenses(12, camp(12), 1)).toBe(0)
    expect(iclubCountedLicenses(12, camp(12), 2)).toBe(12)
    expect(iclubCountedLicenses(15, camp(12), 1)).toBe(3) // as 3 acrescentadas contam logo
    expect(iclubCountedLicenses(12, null, 0)).toBe(12)
  })
  it('1 licença grátis a cada 12', () => {
    expect(freeLicensesEarned(11, 12)).toBe(0)
    expect(freeLicensesEarned(12, 12)).toBe(1)
    expect(freeLicensesEarned(25, 12)).toBe(2)
    expect(freeLicensesEarned(5, 0)).toBe(0)
  })
})
