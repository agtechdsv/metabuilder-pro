import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { campaignOffPercent, campaignTimeLeft, localizedText } from '../campaigns'

const read = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n')

describe('campanhas (site)', () => {
  it('texto no idioma da pessoa, com pt de reserva', () => {
    const name = { pt: 'Black November', en: 'Black November', es: 'Black November' }
    expect(localizedText({ pt: 'Olá', en: 'Hello' }, 'en')).toBe('Hello')
    expect(localizedText({ pt: 'Olá', en: 'Hello' }, 'es')).toBe('Olá')
    expect(localizedText(name, 'pt')).toBe('Black November')
    expect(localizedText('texto simples', 'en')).toBe('texto simples')
    expect(localizedText(null, 'pt')).toBe('')
  })
  it('cobra 50% da tabela = 50% de desconto', () => {
    expect(campaignOffPercent({ discount_percent: 50 })).toBe(50)
    expect(campaignOffPercent({ discount_percent: 70 })).toBe(30)
    expect(campaignOffPercent({ discount_percent: 100 })).toBe(0)
  })
  it('quanto falta para a campanha acabar', () => {
    const now = Date.parse('2026-11-25T12:00:00Z')
    expect(campaignTimeLeft('2026-11-27T17:30:00Z', now)).toMatchObject({ days: 2, hours: 5, minutes: 30 })
    expect(campaignTimeLeft('2026-11-25T11:00:00Z', now)).toMatchObject({ ms: 0, days: 0, hours: 0, minutes: 0 })
  })
})

describe('Edge Functions do Asaas (checagens de proteção)', () => {
  const checkout = read('supabase/functions/asaas-checkout/index.ts')
  const update = read('supabase/functions/asaas-update-subscription/index.ts')
  const webhook = read('supabase/functions/asaas-webhook/index.ts')

  it('o preço vem do cálculo único, nunca de conta própria', () => {
    for (const [name, src] of [['checkout', checkout], ['update-subscription', update]] as const) {
      expect(src, name).toContain('../_shared/pricing.ts')
      expect(src, name).not.toMatch(/volume_tiers\s*\)\s*\.sort|\.sort\(\(a: any, b: any\) => b\.min_licenses/)
    }
    expect(update).not.toMatch(/cycle_discounts\?\.\w+ \|\| \d+/) // o padrão antigo `|| 15` tratava 0% digitado como 15%
    expect(checkout).not.toContain('(unitPrice * licenses * months)')
  })
  it('ciclos desativados são recusados e a campanha só vale para quem nunca pagou', () => {
    expect(checkout).toContain('isCycleEnabled(rules, cycle')
    expect(update).toContain('isCycleEnabled(rules, cycle')
    expect(checkout).toMatch(/status", "paid"\)/)
    expect(checkout).toContain('findEligibleCampaign')
  })
  it('a cotação do checkout não cria nada no Asaas (responde antes de criar cliente/assinatura)', () => {
    const quoteAt = checkout.indexOf('if (isQuote) {')
    const customerAt = checkout.indexOf('/customers')
    expect(quoteAt).toBeGreaterThan(0)
    expect(quoteAt).toBeLessThan(customerAt)
  })
  it('o webhook conta cada pagamento uma vez e trata estorno e reembolso', () => {
    expect(webhook).toContain('campaign_counted')
    expect(webhook).toContain('PAYMENT_REFUNDED')
    expect(webhook).toContain('PAYMENT_CHARGEBACK_REQUESTED')
    expect(webhook).toContain('revokeReferralRewards')
    expect(webhook).toContain('processReferralConversion')
    // o desconto de indicação deixou de ser "consumido" no pagamento seguinte (era de uma cobrança só)
    expect(webhook).not.toContain('Consuming active percent_discount')
  })
  it('renovação sem referência não zera as licenças do perfil', () => {
    expect(webhook).toContain('extractLicensesFromExtRef = (extRef: string): number => {\n      if (!extRef) return 0;')
  })
  it('a função que libera a carência só aceita a chave de serviço', () => {
    const release = read('supabase/functions/iclub-release/index.ts')
    expect(release).toContain('bearer !== serviceKey')
  })
  it('o SQL tem tudo o que o código usa', () => {
    const sql = read('scripts/iclub-campanhas.sql')
    for (const s of ['pricing_campaigns', 'campaign_months_used', 'campaign_counted', 'referral_id', 'release_at', "'revoked'", "'canceled'", 'iclub_referral_cap_percent', 'iclub_grace_days', 'allowed_emails']) expect(sql, s).toContain(s)
    // só o servidor grava campanhas (nenhuma policy de escrita)
    expect([...sql.matchAll(/create policy "[^"]+" on public\.pricing_campaigns\s+for (\w+)/g)].map(m => m[1])).toEqual(['select'])
  })
  it('cron do iClub está no vercel.json', () => {
    const vercel = JSON.parse(read('vercel.json'))
    expect(vercel.crons.some((c: any) => c.path === '/api/cron/iclub-release')).toBe(true)
  })
})
