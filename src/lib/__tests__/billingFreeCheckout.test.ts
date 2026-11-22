import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CHECKOUT_REMINDER_MAX_DAYS, checkoutReminderStep, isCheckoutAbandoned, isCheckoutOnly, isCustomerKind } from '../../../supabase/functions/_shared/billingCore'
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

describe('correções do teste de renovação (21/11/2026)', () => {
  it('a tela mostra a cobrança mais antiga (vencida primeiro), não só a PENDING', () => {
    const fn = read('supabase/functions/asaas-update-subscription/index.ts')
    expect(fn).toContain('["OVERDUE", "PENDING"]')
    expect(fn).toContain('openCharges.sort')
    expect(fn).not.toContain('&status=PENDING`')
  })

  it('o webhook grava a renovação com referência única e registra o erro do insert', () => {
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    expect(hook).toContain('const renewalRef =')
    expect(hook).toContain('`${base}~${paymentId}`')
    expect(hook.match(/renewalRef\(ctx\.externalReference, payment\.id\)/g)?.length).toBe(2)
    expect(hook).toContain('erro ao gravar o pagamento')
  })

  it('a tela confere o pagamento no nosso banco, e o QR tem lupa e janela ampliada', () => {
    const hk = read('src/components/client/hooks/useClientSubscription.ts')
    expect(hk).toContain("eq('status', 'paid')")
    expect(hk).toContain('Pagamento recebido! Obrigado.')
    expect(hk).toContain('setInterval')
    const view = read('src/components/client/ClientSubscriptionView.tsx')
    expect(view).toContain('data-testid="qr-zoom-open"')
    expect(view).toContain('data-testid="qr-zoom-modal"')
  })

  it('o script de reconciliação grava a linha paga uma única vez', () => {
    const sql = read('scripts/reconciliar-pagamento-lgpd-dezembro.sql')
    expect(sql).toContain("'paid'")
    expect(sql).toContain('not exists')
    expect(sql).toContain("'~pay_x66on5rkt3wxmu57'")
  })

  it('a cobrança pedida pelo id só vale se for do usuário da sessão', () => {
    const fn = read('supabase/functions/asaas-update-subscription/index.ts')
    expect(fn).toContain('/^pay_[A-Za-z0-9]+$/.test(askedId)')
    // a conferência de dono vem ANTES de qualquer consulta ao Asaas por esse id
    const own = fn.indexOf('.eq("asaas_payment_id", askedId).eq("user_id", user.id)')
    const asaas = fn.indexOf('payments/${askedId}')
    expect(own).toBeGreaterThan(0)
    expect(asaas).toBeGreaterThan(own)
    // só troca a cobrança se estiver em aberto; senão cai na regra da mais antiga
    expect(fn).toContain('one.status === "PENDING" || one.status === "OVERDUE"')
  })

  it('o link do e-mail leva o id da cobrança (e ignora um id fora do formato)', () => {
    const base = { name: 'A', amount: 5, appUrl: 'https://x.test' }
    const ok = customerBillingMail('checkout_reminder', 'pt', { ...base, paymentId: 'pay_abc123' })!
    expect(ok.text).toContain('https://x.test/client/dashboard?tab=subscription&pay=pay_abc123')
    for (const bad of ['8c72a89a-1792-4833', 'pay_x"><script>', '', null]) {
      const m = customerBillingMail('suspended', 'pt', { ...base, paymentId: bad as any })!
      expect(m.text).toContain('https://x.test/client/dashboard?tab=subscription')
      expect(m.text).not.toContain('&pay=')
    }
  })

  it('banner e tela passam o id da cobrança', () => {
    expect(read('src/components/billing/BillingBanner.tsx')).toContain('&pay=${notice.paymentId}')
    expect(read('src/app/actions/billingNotices.ts')).toContain('paymentId:')
    const hk = read('src/components/client/hooks/useClientSubscription.ts')
    expect(hk).toContain('subscriptionFnName()')
    expect(hk).toContain('asaas-update-subscription?pay=')
  })

  it('checkout abandonado: só depois da janela dos lembretes', () => {
    expect(isCheckoutAbandoned(ago(CHECKOUT_REMINDER_MAX_DAYS), now)).toBe(false) // 10 dias: ainda na janela
    expect(isCheckoutAbandoned(ago(CHECKOUT_REMINDER_MAX_DAYS + 1), now)).toBe(true) // 11 dias
    expect(isCheckoutAbandoned(ago(2), now)).toBe(false)
    expect(isCheckoutAbandoned(null, now)).toBe(false)
    expect(isCheckoutAbandoned('lixo', now)).toBe(false)
  })

  it('o cancelamento do abandonado é protegido nos dois lados (site e Edge Function)', () => {
    const fn = read('supabase/functions/admin-cancel-billing/index.ts')
    // a chave de serviço só serve para "abandoned"; o resto continua exigindo o SuperAdmin
    expect(fn).toContain('body?.purpose !== "abandoned"')
    expect(fn).toContain('is_super_admin')
    // a função reconfere sozinha: FREE e sem pagamento recebido (409 caso contrário), antes de falar com o Asaas
    const guard = fn.indexOf('isCheckoutOnly(target.subscription_tier')
    expect(guard).toBeGreaterThan(0)
    expect(fn.indexOf('cancelAsaasBilling(asaas, ids)')).toBeGreaterThan(guard)
    expect(fn).toContain('409')
    // o vínculo sai antes (o evento do Asaas não marca "cancelado") e volta se o cancelamento falhar
    const clear = fn.indexOf('asaas_subscription_id: null')
    const restore = fn.indexOf('asaas_subscription_id: ids.subscriptionId')
    expect(clear).toBeGreaterThan(0)
    expect(restore).toBeGreaterThan(clear)
    expect(fn).toContain('status: "canceled"')
    const svc = read('src/lib/billing/billingService.ts')
    expect(svc).toContain("purpose: 'abandoned'")
    expect(svc).toContain('Authorization: `Bearer ${key}`')
    // só cancela quando a cobrança MAIS NOVA já passou da janela, e só de quem é FREE do checkout
    expect(svc).toContain('newestOf')
    expect(svc).toContain('checkout.has(id)')
    // roda na rotina diária só com os avisos ligados
    const run = svc.slice(svc.indexOf('export async function runBillingNotices'))
    expect(run.indexOf('if (!cfg.enabled)')).toBeLessThan(run.indexOf('cancelAbandonedCheckouts'))
  })

  it('os textos do QR existem nos três idiomas', () => {
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(read(`src/i18n/translations/${l}.json`))
      for (const k of ['qr_zoom', 'qr_close', 'qr_zoom_title']) expect(j.client_views.subscription[k], `${l}: ${k}`).toBeTruthy()
    }
  })
})
