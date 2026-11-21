import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CHECKOUT_REMINDER_MAX_DAYS, checkoutReminderStep, isCheckoutOnly, isCustomerKind } from '../../../supabase/functions/_shared/billingCore'
import { customerBillingMail } from '../billing/billingMailText'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const now = new Date('2026-11-21T12:00:00Z')
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()

describe('FREE que só abriu o checkout: nunca suspenso, só lembrete suave', () => {
  it('só é "checkout" quem é FREE e nunca pagou', () => {
    expect(isCheckoutOnly('free', 0)).toBe(true)
    expect(isCheckoutOnly(null, 0)).toBe(true)
    expect(isCheckoutOnly('', 0)).toBe(true)
    expect(isCheckoutOnly('free', 1)).toBe(false) // já pagou uma vez: segue o trilho do PRO
    expect(isCheckoutOnly('pro', 0)).toBe(false)
    expect(isCheckoutOnly('enterprise', 0)).toBe(false)
  })

  it('lembretes com 1 e 3 dias, e para de avisar depois do limite', () => {
    expect(checkoutReminderStep(ago(0), now)).toBe(0)
    expect(checkoutReminderStep(ago(1), now)).toBe(1)
    expect(checkoutReminderStep(ago(2), now)).toBe(1)
    expect(checkoutReminderStep(ago(3), now)).toBe(3)
    expect(checkoutReminderStep(ago(CHECKOUT_REMINDER_MAX_DAYS), now)).toBe(3)
    expect(checkoutReminderStep(ago(CHECKOUT_REMINDER_MAX_DAYS + 1), now)).toBe(0)
    expect(checkoutReminderStep(null, now)).toBe(0)
    expect(checkoutReminderStep('lixo', now)).toBe(0)
  })

  it('o e-mail é um lembrete, nunca fala em suspensão, e o botão abre a aba Assinatura (nos três idiomas)', () => {
    expect(isCustomerKind('checkout_reminder')).toBe(true)
    for (const lang of ['pt', 'en', 'es'] as const) {
      const m = customerBillingMail('checkout_reminder', lang, { name: 'LGPD', amount: 5, dueDate: '2026-11-16', appUrl: 'https://x.test', invoiceUrl: 'https://asaas.test/i/1' })!
      expect(m, lang).toBeTruthy()
      expect(m.html + m.text).toContain('https://x.test/client/dashboard?tab=subscription')
      expect((m.subject + m.text).toLowerCase()).not.toMatch(/suspen|bloque|blocked/)
    }
  })

  it('suspensão e cartão recusado também levam à aba Assinatura', () => {
    for (const k of ['suspended', 'card_refused']) {
      const m = customerBillingMail(k, 'pt', { name: 'A', amount: 5, appUrl: 'https://x.test', invoiceUrl: 'https://asaas.test/i/1' })!
      expect(m.text).toContain('https://x.test/client/dashboard?tab=subscription')
    }
  })

  it('a rotina, o webhook e o banner usam a regra (não suspende nem avisa atraso a FREE)', () => {
    const svc = read('src/lib/billing/billingService.ts')
    expect(svc).toContain('checkoutOnlyUsers')
    expect(svc).toContain("kind: 'checkout_reminder'")
    expect(svc).toContain('FREE que só abriu o checkout nunca é suspenso')
    expect(svc).toContain("'ignorado: cliente FREE que ainda não pagou'")
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    expect(hook).toContain('isCheckoutOnly')
    expect(hook).toContain('if (ctx?.userId && !checkoutOnly)')
    const act = read('src/app/actions/billingNotices.ts')
    expect(act).toContain("state: 'checkout_pending'")
    const dash = read('src/components/client/ClientDashboardClient.tsx')
    expect(dash).toContain('canPayAsGuest')
    expect(dash).toContain("tab === 'subscription' && canPayAsGuest")
  })

  it('o script de correção só mexe em FREE sem pagamento', () => {
    const sql = read('scripts/corrigir-free-suspenso.sql')
    expect(sql).toContain("coalesce(p.subscription_tier, 'free') = 'free'")
    expect(sql).toContain("x.status = 'paid'")
    expect(sql).toContain("subscription_status = 'pending'")
  })

  it('os textos novos existem nos três idiomas com os mesmos marcadores', () => {
    const keys = ['billing_banner.checkout_title', 'billing_banner.checkout_desc', 'billing_banner.checkout_button', 'client_views.subscription.pending_invoice_title_free', 'client_views.subscription.pending_invoice_desc_free', 'client_dashboard.subscription_guest_subtitle']
    const marks = (s: string) => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',')
    const get = (o: any, p: string) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
    const pt = JSON.parse(read('src/i18n/translations/pt.json'))
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(read(`src/i18n/translations/${l}.json`))
      for (const k of keys) { expect(get(j, k), `${l}: ${k}`).toBeTruthy(); expect(marks(get(j, k)), `${l}: ${k}`).toBe(marks(get(pt, k))) }
    }
  })
})
