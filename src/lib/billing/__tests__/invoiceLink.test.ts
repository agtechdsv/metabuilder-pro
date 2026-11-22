import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { invoiceLinkKind } from '../invoiceLink'

describe('link da fatura no histórico: recibo só quando pago', () => {
  it('paga = recibo; pendente ou vencida = pagar; o resto = sem link', () => {
    expect(invoiceLinkKind('paid')).toBe('receipt')
    expect(invoiceLinkKind('pending')).toBe('pay')
    expect(invoiceLinkKind('overdue')).toBe('pay')
    expect(invoiceLinkKind(' OVERDUE ')).toBe('pay')
    for (const s of ['canceled', 'refunded', 'blocked', '', null, undefined]) expect(invoiceLinkKind(s as any), String(s)).toBeNull()
  })

  it('a tela usa o rótulo pelo status e os textos existem nos três idiomas', () => {
    const view = readFileSync('src/components/client/ClientSubscriptionView.tsx', 'utf8')
    expect(view).toContain("invoiceLinkKind(p.status) === 'receipt'")
    expect(view).toContain('client_views.subscription.pay_btn')
    expect(view).toContain('client_views.subscription.table_invoice')
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(readFileSync(`src/i18n/translations/${l}.json`, 'utf8'))
      for (const k of ['table_invoice', 'receipt_btn', 'pay_btn']) expect(j.client_views.subscription[k], `${l}: ${k}`).toBeTruthy()
    }
  })
})
