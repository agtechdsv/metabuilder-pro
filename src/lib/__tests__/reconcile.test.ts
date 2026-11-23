import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { OPEN_ASAAS_STATUSES, chargeExternalRef, classifyGone, localStatusOf, planOpenCharge, type AsaasCharge } from '../../../supabase/functions/_shared/reconcile'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const charge = (over: Partial<AsaasCharge> = {}): AsaasCharge => ({ id: 'pay_a', status: 'PENDING', value: 5, dueDate: '2026-12-15', billingType: 'PIX', invoiceUrl: 'https://asaas/i/1', externalReference: 'mb_ws_x_l_1_cy_mo_t_1', ...over })

describe('conciliação: o que fazer com cada cobrança aberta do Asaas', () => {
  it('cobrança que não existe aqui (a renovação que o webhook deixou passar) é gravada', () => {
    const p = planOpenCharge(charge(), null, 'user-1', 'monthly')
    expect(p.kind).toBe('insert')
    if (p.kind !== 'insert') return
    expect(p.row).toMatchObject({ user_id: 'user-1', cycle: 'monthly', amount: 5, status: 'pending', billing_type: 'PIX', asaas_payment_id: 'pay_a', due_date: '2026-12-15', invoice_url: 'https://asaas/i/1' })
    expect(p.row.external_reference).toBe('mb_ws_x_l_1_cy_mo_t_1~pay_a') // única: a renovação repete a referência da assinatura
  })

  it('vencida no Asaas entra como vencida; sem referência usa sub_<id>; ciclo vazio cai em mensal; boleto usa o link do boleto', () => {
    const p = planOpenCharge(charge({ status: 'OVERDUE', externalReference: null, invoiceUrl: null, bankSlipUrl: 'https://asaas/b/1', billingType: 'BOLETO' }), null, 'u', null)
    expect(p.kind === 'insert' && p.row).toMatchObject({ status: 'overdue', external_reference: 'sub_pay_a', cycle: 'monthly', invoice_url: 'https://asaas/b/1' })
  })

  it('situação que não é aberta no Asaas nunca vira linha', () => {
    for (const st of ['RECEIVED', 'CONFIRMED', 'REFUNDED', 'DELETED', '', 'qualquer']) expect(planOpenCharge(charge({ status: st }), null, 'u', 'monthly').kind, st).toBe('none')
    expect(planOpenCharge(charge({ id: '' }), null, 'u', 'monthly').kind).toBe('none')
  })

  it('cobrança igual nos dois lados não muda nada', () => {
    expect(planOpenCharge(charge(), { id: '1', status: 'pending', due_date: '2026-12-15', amount: '5.00' }, 'u', 'monthly').kind).toBe('none')
  })

  it('cobrança aberta aqui que divergiu no Asaas (vencimento, valor, vencida) é ajustada', () => {
    const p = planOpenCharge(charge({ status: 'OVERDUE', dueDate: '2026-12-20', value: 3 }), { id: '1', status: 'pending', due_date: '2026-12-15', amount: 5 }, 'u', 'monthly')
    expect(p).toEqual({ kind: 'patch', patch: { status: 'overdue', due_date: '2026-12-20', amount: 3 } })
    expect(planOpenCharge(charge({ value: 3 }), { id: '1', status: 'pending', due_date: '2026-12-15', amount: 5 }, 'u', 'monthly')).toEqual({ kind: 'patch', patch: { amount: 3 } })
  })

  it('NUNCA reabre cobrança paga, estornada ou cancelada, mesmo que o Asaas a liste aberta', () => {
    for (const st of ['paid', 'refunded', 'canceled']) {
      expect(planOpenCharge(charge({ status: 'OVERDUE', value: 99 }), { id: '1', status: st, due_date: '2026-01-01', amount: 5 }, 'u', 'monthly').kind, st).toBe('none')
    }
  })

  it('valor com centavos de arredondamento não gera ajuste à toa', () => {
    expect(planOpenCharge(charge({ value: '5.004' }), { id: '1', status: 'pending', due_date: '2026-12-15', amount: 5 }, 'u', 'monthly').kind).toBe('none')
  })

  it('as situações abertas e o mapeamento', () => {
    expect([...OPEN_ASAAS_STATUSES]).toEqual(['PENDING', 'OVERDUE'])
    expect(localStatusOf('PENDING')).toBe('pending')
    expect(localStatusOf('OVERDUE')).toBe('overdue')
    expect(localStatusOf('RECEIVED')).toBeNull()
    expect(chargeExternalRef('base', 'pay_1')).toBe('base~pay_1')
    expect(chargeExternalRef('', 'pay_1')).toBe('sub_pay_1')
  })
})

describe('conciliação: aberta aqui e fora da lista de abertas do Asaas', () => {
  it('apagada (404 ou deleted) é cancelada; paga é só relatada; estornada e dúvida não mudam nada', () => {
    expect(classifyGone(404, null)).toBe('deleted')
    expect(classifyGone(200, { deleted: true, status: 'PENDING' })).toBe('deleted')
    for (const s of ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']) expect(classifyGone(200, { status: s }), s).toBe('paid')
    expect(classifyGone(200, { status: 'REFUNDED' })).toBe('refunded')
    expect(classifyGone(200, { status: 'PENDING' })).toBe('open')
    expect(classifyGone(500, { status: 'RECEIVED' })).toBe('unknown') // erro do Asaas: não decide nada
    expect(classifyGone(200, null)).toBe('unknown')
    expect(classifyGone(200, { status: 'AWAITING_RISK_ANALYSIS' })).toBe('unknown')
  })
})

describe('ligação no servidor', () => {
  it('a Edge Function só atende a chave de serviço e nunca marca pagamento como pago', () => {
    const fn = read('supabase/functions/asaas-reconcile/index.ts')
    expect(fn).toContain('bearer !== serviceKey')
    expect(fn).toContain('.in("subscription_status", ["active", "blocked"])')
    expect(fn).not.toContain('status: "paid"')
    expect(fn).toContain('paidNotRecorded.push(')
    expect(fn).toContain('error.code !== "23505"') // linha já gravada por outro caminho não é erro
    expect(fn).toContain('.in("status", ["pending", "overdue"])') // só mexe em cobrança aberta aqui
  })

  it('o cron está agendado, protegido pelo segredo e roda em lotes', () => {
    expect(JSON.parse(read('vercel.json')).crons.map((c: any) => c.path)).toContain('/api/cron/asaas-reconcile')
    const route = read('src/app/api/cron/asaas-reconcile/route.ts')
    expect(route).toContain('isCronAuthorized(req)')
    expect(route).toContain('/functions/v1/asaas-reconcile')
    expect(route).toContain('body: JSON.stringify({ after })')
  })
})
