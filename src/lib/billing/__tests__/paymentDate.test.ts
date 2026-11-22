import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { paymentDisplayDate } from '../paymentDate'

describe('data da cobrança na tela do cliente', () => {
  const created = '2026-11-16T11:24:51Z'
  const paidAt = '2026-11-22T03:36:09Z'

  it('paga mostra a data do pagamento, não a de criação', () => {
    expect(paymentDisplayDate({ status: 'paid', created_at: created, webhook_received_at: paidAt })).toBe(paidAt)
    expect(paymentDisplayDate({ status: ' PAID ', created_at: created, webhook_received_at: paidAt })).toBe(paidAt)
  })

  it('paga sem data do aviso, e as demais, mostram a de criação', () => {
    expect(paymentDisplayDate({ status: 'paid', created_at: created, webhook_received_at: null })).toBe(created)
    // pendente/vencida nunca usam a data do aviso (pode ter vindo de outro evento)
    for (const status of ['pending', 'overdue', 'canceled', 'refunded']) expect(paymentDisplayDate({ status, created_at: created, webhook_received_at: paidAt }), status).toBe(created)
  })

  it('sem dados, nada', () => {
    expect(paymentDisplayDate(null)).toBeNull()
    expect(paymentDisplayDate({ status: 'paid' })).toBeNull()
  })

  it('a página lê webhook_received_at e a tela usa o helper nas duas datas', () => {
    expect(readFileSync('src/app/client/dashboard/page.tsx', 'utf8')).toContain('created_at, webhook_received_at')
    const view = readFileSync('src/components/client/ClientSubscriptionView.tsx', 'utf8')
    expect(view).toContain('formatDate(paymentDisplayDate(lastSuccessfulPayment))')
    expect(view).toContain('formatDate(paymentDisplayDate(p))')
    expect(view).not.toContain('formatDate(p.created_at)')
  })
})
