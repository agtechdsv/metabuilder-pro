import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { paymentDisplayDate, paymentRowDate, isShownAbove } from '../paymentDate'

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
    expect(view).toContain('formatDate(rowDate.date)') // a linha usa o helper da data (paga: pagamento; em aberto: vencimento)
    expect(view).toContain('const rowDate = paymentRowDate(p)')
    expect(view).not.toContain('formatDate(p.created_at)')
  })

  it('cobrança em aberto mostra o VENCIMENTO, não a criação (23/11 criada, vence 15/12)', () => {
    const base = { created_at: '2026-11-23T10:00:00Z', due_date: '2026-12-15', webhook_received_at: null }
    expect(paymentRowDate({ ...base, status: 'pending' })).toEqual({ date: '2026-12-15', kind: 'due' })
    expect(paymentRowDate({ ...base, status: ' OVERDUE ' })).toEqual({ date: '2026-12-15', kind: 'due' })
    // paga: a data do pagamento; cancelada/estornada: a criação (não há vencimento a cobrar)
    expect(paymentRowDate({ ...base, status: 'paid', webhook_received_at: '2026-11-15T12:00:00Z' })).toEqual({ date: '2026-11-15T12:00:00Z', kind: 'paid' })
    expect(paymentRowDate({ ...base, status: 'canceled' })).toEqual({ date: '2026-11-23T10:00:00Z', kind: 'created' })
    expect(paymentRowDate({ ...base, status: 'refunded' })).toEqual({ date: '2026-11-23T10:00:00Z', kind: 'created' })
  })

  it('em aberto sem vencimento gravado (ou com lixo) cai na criação, sem quebrar', () => {
    for (const due of [null, undefined, '', 'lixo']) {
      expect(paymentRowDate({ status: 'pending', created_at: '2026-11-23T10:00:00Z', due_date: due as any }), String(due)).toEqual({ date: '2026-11-23T10:00:00Z', kind: 'created' })
    }
    expect(paymentRowDate(null)).toEqual({ date: null, kind: 'created' })
  })

  it('marca só a linha que é a MESMA cobrança do bloco de cima (pelo id do Asaas) e só enquanto está em aberto', () => {
    const p = { status: 'pending', asaas_payment_id: 'pay_abc' }
    expect(isShownAbove(p, 'pay_abc')).toBe(true)
    expect(isShownAbove({ ...p, status: 'overdue' }, 'pay_abc')).toBe(true)
    expect(isShownAbove(p, 'pay_outra')).toBe(false)
    expect(isShownAbove({ ...p, status: 'paid' }, 'pay_abc')).toBe(false) // já paga: virou recibo, não está mais "acima"
    for (const id of [null, undefined, '']) expect(isShownAbove(p, id as any), String(id)).toBe(false)
    expect(isShownAbove({ status: 'pending', asaas_payment_id: null }, null)).toBe(false) // dois vazios não são "iguais"
  })

  it('a página lê o vencimento e o id da cobrança, a tela mostra a legenda e a marca, e os textos existem nos três idiomas', () => {
    expect(readFileSync('src/app/client/dashboard/page.tsx', 'utf8')).toContain('due_date, asaas_payment_id')
    const view = readFileSync('src/components/client/ClientSubscriptionView.tsx', 'utf8')
    expect(view).toContain('data-testid="payment-due-caption"')
    expect(view).toContain('data-testid="payment-shown-above"')
    expect(view).toContain('isShownAbove(p, asaasSubData?.pendingInvoice?.id)')
    const marks = (s: string) => (String(s).match(/\{[a-z]+\}/g) || []).sort().join(',')
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(readFileSync(`src/i18n/translations/${l}.json`, 'utf8'))
      for (const k of ['due_on', 'due_overdue', 'row_next_invoice', 'row_open_invoice']) {
        expect(j.client_views.subscription[k], `${l}: ${k}`).toBeTruthy()
        expect(marks(j.client_views.subscription[k]), `${l}: ${k}`).toBe('')
      }
    }
  })
})
