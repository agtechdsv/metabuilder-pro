import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { lastRefundValueFromPayload, partialRefundValue } from '../../../supabase/functions/_shared/adminBilling'
import { reactivationDueDate } from '../../../supabase/functions/_shared/billingCore'
import { adminBillingMail, customerBillingMail } from '../billing/billingMailText'
import { UPCOMING_INVOICE_DAYS, daysUntilDue, isInvoiceFarOff } from '../billing/upcomingInvoice'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

/** banco falso: toda a cadeia from().select().eq()...maybeSingle() devolve a linha dada */
function fakeDb(row: unknown, fail = false) {
  const chain: any = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'maybeSingle') return async () => { if (fail) throw new Error('banco fora'); return { data: row } }
      return () => chain
    },
  })
  return { from: () => chain }
}

describe('valor do estorno parcial', () => {
  it('usa o valor pedido pelo SuperAdmin (registro solicitado), e não o total do pagamento', async () => {
    expect(await partialRefundValue(fakeDb({ amount: '2.00' }), 'pay_x', { value: 5 })).toBe(2)
  })

  it('sem registro nosso (feito no painel do Asaas): último valor devolvido do payload', async () => {
    const payment = { value: 5, refunds: [{ value: 1 }, { value: 2.5, status: 'DONE' }] }
    expect(await partialRefundValue(fakeDb(null), 'pay_x', payment)).toBe(2.5)
    expect(lastRefundValueFromPayload(payment)).toBe(2.5)
  })

  it('sem nenhuma das duas fontes (ou banco fora) devolve null, sem lançar', async () => {
    expect(await partialRefundValue(fakeDb(null), 'pay_x', { value: 5 })).toBeNull()
    expect(await partialRefundValue(fakeDb(null, true), 'pay_x', {})).toBeNull()
    expect(lastRefundValueFromPayload({ refunds: [{ value: 'x' }, { value: 0 }] })).toBeNull()
    expect(lastRefundValueFromPayload(undefined)).toBeNull()
  })

  it('o webhook lê o valor ANTES de fechar o registro e avisa o cliente do estorno parcial', () => {
    const src = read('supabase/functions/asaas-webhook/index.ts')
    expect(src).toContain('import { closeRefundLog, partialRefundValue }')
    expect(src.indexOf('await partialRefundValue(')).toBeGreaterThan(0)
    expect(src.indexOf('await partialRefundValue(')).toBeLessThan(src.indexOf('await closeRefundLog(supabase, payment.id, event, partial'))
    expect(src).toContain('partial: true')
    expect(src).toContain('await notify("refunded", ctx.userId, noticeRef(["partial"')
  })
})

describe('e-mails do estorno parcial', () => {
  const base = { name: 'Fulano', amount: 5, refundedAmount: 2, partial: true, appUrl: 'https://x.test' }

  it('cliente: diz quanto foi devolvido e que a assinatura continua (nos três idiomas)', () => {
    const pt = customerBillingMail('refunded', 'pt', base)!
    expect(pt.subject).toBe('Parte do seu pagamento foi estornada')
    expect(pt.text).toContain('R$ 2,00')
    expect(pt.text).toContain('R$ 5,00')
    expect(pt.text).toContain('continua ativa')
    expect(customerBillingMail('refunded', 'en', base)!.subject).toBe('Part of your payment was refunded')
    expect(customerBillingMail('refunded', 'es', base)!.subject).toBe('Se reembolsó parte de su pago')
  })

  it('cliente: estorno parcial sem o valor não inventa um número', () => {
    const m = customerBillingMail('refunded', 'pt', { ...base, refundedAmount: null })!
    expect(m.text).toContain('parte do seu pagamento de R$ 5,00')
    expect(m.text).not.toContain('R$ 0,00')
  })

  it('cliente: o estorno TOTAL continua com o texto de antes', () => {
    const m = customerBillingMail('refunded', 'pt', { name: 'Fulano', amount: 5, appUrl: 'https://x.test' })!
    expect(m.subject).toBe('Seu pagamento foi estornado')
    expect(m.text).toContain('O pagamento de R$ 5,00 foi estornado')
  })

  it('admin: mostra o valor devolvido separado do valor do pagamento (e em formato brasileiro)', () => {
    const m = adminBillingMail('admin_refund', { customerName: 'FeedBack', customerEmail: 'f@x', amount: 5, refundedAmount: 2, event: 'PAYMENT_PARTIALLY_REFUNDED', paymentId: 'pay_1', appUrl: 'https://x.test' })!
    expect(m.text).toContain('Valor devolvido: R$ 2,00')
    expect(m.text).toContain('Valor do pagamento: R$ 5,00')
    const sem = adminBillingMail('admin_refund', { amount: 5, event: 'PAYMENT_PARTIALLY_REFUNDED', appUrl: 'https://x.test' })!
    expect(sem.text).toContain('veja no painel do Asaas')
  })

  it('admin: estorno total segue com uma linha só de valor', () => {
    const m = adminBillingMail('admin_refund', { amount: 5, event: 'PAYMENT_REFUNDED', appUrl: 'https://x.test' })!
    expect(m.text).toContain('Valor: R$ 5,00')
    expect(m.text).not.toContain('Valor devolvido')
  })
})

describe('e-mail de assinatura cancelada leva à aba Assinatura', () => {
  it('cancelada e "acesso termina" apontam para ?tab=subscription (onde está o botão de reativar)', () => {
    for (const k of ['canceled', 'ending_soon']) {
      const m = customerBillingMail(k, 'pt', { name: 'Fulano', validUntil: '2026-12-22T03:00:00Z', appUrl: 'https://x.test' })!
      expect(m.html, k).toContain('href="https://x.test/client/dashboard?tab=subscription"')
    }
    // o recibo de pagamento continua indo ao painel
    expect(customerBillingMail('payment_received', 'pt', { name: 'F', appUrl: 'https://x.test' })!.html).toContain('href="https://x.test/client/dashboard"')
  })
})

describe('fatura longe de vencer', () => {
  const now = new Date('2026-11-23T15:00:00Z') // 12:00 em Brasília

  it(`até ${UPCOMING_INVOICE_DAYS} dias é cobrança pendente; depois disso é só a próxima fatura`, () => {
    expect(daysUntilDue('2026-11-23', now)).toBe(0)
    expect(isInvoiceFarOff('2026-11-23', now)).toBe(false)
    expect(isInvoiceFarOff('2026-11-26', now)).toBe(false) // 3 dias: ainda é aviso normal
    expect(isInvoiceFarOff('2026-11-27', now)).toBe(true)
    expect(isInvoiceFarOff('2026-12-18', now)).toBe(true)
  })

  it('vencida, sem data ou data inválida nunca é "longe"', () => {
    expect(isInvoiceFarOff('2026-11-16', now)).toBe(false)
    expect(isInvoiceFarOff(null, now)).toBe(false)
    expect(isInvoiceFarOff('lixo', now)).toBe(false)
    expect(Number.isNaN(daysUntilDue(undefined, now))).toBe(true)
  })

  it('o dia é o de Brasília (02:00 UTC ainda é o dia anterior)', () => {
    expect(daysUntilDue('2026-11-24', new Date('2026-11-24T02:00:00Z'))).toBe(1)
  })

  it('a tela usa o aviso discreto só para quem já é cliente PRO', () => {
    const v = read('src/components/client/ClientSubscriptionView.tsx')
    expect(v).toContain('const farOff = !isFree && isInvoiceFarOff(')
    expect(v).toContain("client_views.subscription.pending_invoice_title_next")
  })
})

describe('reativação da assinatura', () => {
  const now = new Date('2026-11-23T15:00:00Z')

  it('cancelada com acesso pago: a primeira cobrança é no fim do acesso (dia de Brasília)', () => {
    expect(reactivationDueDate('canceled', '2026-12-22T03:36:09.23+00:00', now)).toBe('2026-12-22')
    expect(reactivationDueDate('Canceled', new Date('2026-12-22T02:00:00Z'), now)).toBe('2026-12-21') // 23:00 do dia 21 em Brasília
  })

  it('qualquer outra situação não é reativação (compra normal, cobrada hoje)', () => {
    expect(reactivationDueDate('active', '2026-12-22T03:00:00Z', now)).toBeNull()
    expect(reactivationDueDate('blocked', '2026-12-22T03:00:00Z', now)).toBeNull()
    expect(reactivationDueDate(null, '2026-12-22T03:00:00Z', now)).toBeNull()
    expect(reactivationDueDate('canceled', null, now)).toBeNull()
    expect(reactivationDueDate('canceled', 'lixo', now)).toBeNull()
    expect(reactivationDueDate('canceled', '2026-11-20T03:00:00Z', now)).toBeNull() // acesso já terminou
  })

  it('o servidor decide pelo perfil no banco, nunca pelo navegador, e não mexe no fim do acesso', () => {
    const src = read('supabase/functions/asaas-checkout/index.ts')
    expect(src).toContain('reactivationDueDate(prevProfile?.subscription_status, prevProfile?.subscription_expires_at')
    expect(src).toContain('const reactivationDue = !isUpgrade ?')
    expect(src).toContain('const nextDueDate = reactivationDue ??')
    // só o objeto da reativação (sem os comentários): ativa a assinatura e NÃO grava subscription_expires_at
    const start = src.indexOf('.update(reactivationDue')
    const patch = src.slice(start, src.indexOf(': {', start + 40)).split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(patch).toContain('subscription_status: "active"')
    expect(patch).not.toContain('subscription_expires_at')
    expect(src).toContain('reactivated: !!reactivationDue')
  })

  it('a tela de assinatura cancelada mostra o botão de reativar e troca "Alterar Plano" (que não serve sem assinatura no Asaas)', () => {
    const v = read('src/components/client/ClientSubscriptionView.tsx')
    expect(v).toContain('data-testid="reactivate-banner"')
    expect(v).toContain("router.push('/checkout?mode=reactivate')")
    expect(v).toContain("isCanceled ? '/checkout?mode=reactivate' : '/checkout?mode=upgrade'")
    const c = read('src/components/checkout/hooks/useCheckoutState.ts')
    expect(c).toContain('if (data.reactivated)')
    expect(read('src/components/checkout/CheckoutClient.tsx')).toContain('data-testid="reactivation-note"')
  })

  it('os textos novos existem nos três idiomas', () => {
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(read(`src/i18n/translations/${l}.json`))
      for (const k of ['pending_invoice_title_next', 'pending_invoice_desc_next', 'reactivate_title', 'reactivate_desc', 'reactivate_desc_expired', 'reactivate_button']) {
        expect(j.client_views?.subscription?.[k], `${l}: client_views.subscription.${k}`).toBeTruthy()
      }
      expect(j.checkout?.reactivation_note, `${l}: checkout.reactivation_note`).toBeTruthy()
    }
  })
})
