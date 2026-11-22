import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { checkRefund, cleanReason, closeRefundLog, isOpenChargeStatus, isUuid, refundLogOutcome, runChargeAction } from '../../../supabase/functions/_shared/adminBilling'
import { cancelAsaasBilling, deleteCharge, deleteSubscription, refundCharge } from '../../../supabase/functions/_shared/adminCancel'
import { availableActions, parseMoneyInput, readChargeActionResponse } from '../billing/chargeActions'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

// ---------- Asaas falso -------------------------------------------------------------------------------------------------------------------
function fakeAsaas(rules: (method: string, path: string, body: any) => { status: number; body?: any }) {
  const calls: { method: string; path: string; body: any }[] = []
  const fetcher = (async (url: string, init: any) => {
    const path = String(url).replace('https://asaas.test', '')
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method: init.method, path, body })
    const r = rules(init.method, path, body)
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} }
  }) as any
  return { calls, access: { url: 'https://asaas.test', key: 'k', fetcher } }
}
/** As dependências que a Edge Function injeta no orquestrador: as chamadas reais ao Asaas (com o fetch falso) e um aviso que não faz nada. */
const opsFor = (asaas: any) => ({ asaas, cancelAsaasBilling, deleteCharge, deleteSubscription, refundCharge, notifyCanceled: async () => {} })
const asaasOk = () => fakeAsaas((m, p) => (m === 'GET' ? { status: 200, body: { data: [], hasMore: false } } : { status: 200, body: { status: 'REFUND_REQUESTED', deleted: true } }))

// ---------- banco falso (só o que o código usa) -------------------------------------------------------------------------------------------
type Row = Record<string, any>
function fakeDb(seed: Record<string, Row[]>, opts: { missingTables?: string[] } = {}) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed))
  let seq = 0
  const builder = (table: string) => {
    const filters: ((r: Row) => boolean)[] = []
    let mode: 'select' | 'update' | 'insert' = 'select'
    let patch: Row = {}
    let inserted: Row | null = null
    let wantOne = false
    const rows = () => tables[table] || (tables[table] = [])
    const run = () => {
      if (opts.missingTables?.includes(table)) return { data: null, error: { message: `relation "${table}" does not exist` } }
      if (mode === 'insert') {
        const row = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, created_at: new Date().toISOString(), ...inserted }
        rows().push(row)
        return { data: wantOne ? row : [row], error: null }
      }
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (mode === 'update') { for (const r of hit) Object.assign(r, patch); return { data: hit, error: null } }
      return { data: wantOne ? (hit[0] ?? null) : hit, error: null }
    }
    const b: any = {
      select: () => b, order: () => b, limit: () => b,
      eq: (c: string, v: any) => { filters.push(r => r[c] === v); return b },
      neq: (c: string, v: any) => { filters.push(r => r[c] !== v); return b },
      in: (c: string, v: any[]) => { filters.push(r => v.includes(r[c])); return b },
      gte: (c: string, v: any) => { filters.push(r => String(r[c]) >= String(v)); return b },
      update: (p: Row) => { mode = 'update'; patch = p; return b },
      insert: (p: Row) => { mode = 'insert'; inserted = p; return b },
      maybeSingle: () => { wantOne = true; return Promise.resolve(run()) },
      single: () => { wantOne = true; return Promise.resolve(run()) },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    }
    return b
  }
  return { from: builder, tables }
}

const USER = '11111111-1111-4111-8111-111111111111'
const ADMIN = '99999999-9999-4999-8999-999999999999'
const PAY = '22222222-2222-4222-8222-222222222222'
const OTHER = '33333333-3333-4333-8333-333333333333'

const payRow = (over: Row = {}): Row => ({ id: PAY, user_id: USER, amount: 5, status: 'paid', billing_type: 'PIX', asaas_payment_id: 'pay_abc', ...over })
const profile = (over: Row = {}): Row => ({ id: USER, asaas_customer_id: 'cus_1', asaas_subscription_id: 'sub_1', subscription_status: 'active', subscription_expires_at: '2026-12-22T00:00:00Z', overdue_since: '2026-11-17', ...over })
const logOf = (db: ReturnType<typeof fakeDb>) => db.tables.mb_admin_billing_log || []

describe('regras do estorno', () => {
  it('só cobrança paga, de Pix ou cartão', () => {
    expect(checkRefund({ status: 'pending', method: 'PIX', paidAmount: 5 })).toEqual({ ok: false, code: 'not_paid' })
    expect(checkRefund({ status: 'refunded', method: 'PIX', paidAmount: 5 })).toEqual({ ok: false, code: 'not_paid' })
    expect(checkRefund({ status: 'paid', method: 'BOLETO', paidAmount: 5 })).toEqual({ ok: false, code: 'method_not_supported' })
    expect(checkRefund({ status: 'paid', method: null, paidAmount: 5 })).toEqual({ ok: false, code: 'method_not_supported' })
    expect(checkRefund({ status: ' PAID ', method: 'credit_card', paidAmount: 5 })).toMatchObject({ ok: true })
  })

  it('sem valor é o total; com valor, de 0,01 até o que foi pago', () => {
    expect(checkRefund({ status: 'paid', method: 'PIX', paidAmount: '5.00' })).toEqual({ ok: true, value: 5, full: true })
    expect(checkRefund({ status: 'paid', method: 'PIX', paidAmount: 5, value: 2.5 })).toEqual({ ok: true, value: 2.5, full: false })
    expect(checkRefund({ status: 'paid', method: 'PIX', paidAmount: 5, value: 5 })).toEqual({ ok: true, value: 5, full: true })
    for (const v of [0, -1, 0.001, NaN, 'abc']) expect(checkRefund({ status: 'paid', method: 'PIX', paidAmount: 5, value: v }), String(v)).toEqual({ ok: false, code: 'invalid_value' })
    expect(checkRefund({ status: 'paid', method: 'PIX', paidAmount: 5, value: 5.01 })).toEqual({ ok: false, code: 'value_too_big' })
    expect(checkRefund({ status: 'paid', method: 'PIX', paidAmount: 0 })).toEqual({ ok: false, code: 'invalid_value' })
  })

  it('auxiliares: cobrança aberta, motivo limpo, uuid, resultado do aviso do Asaas', () => {
    expect(isOpenChargeStatus('pending')).toBe(true)
    expect(isOpenChargeStatus('OVERDUE')).toBe(true)
    for (const s of ['paid', 'canceled', 'refunded', '', null]) expect(isOpenChargeStatus(s), String(s)).toBe(false)
    expect(cleanReason('  cliente   pediu \n arrependimento  ')).toBe('cliente pediu arrependimento')
    expect(cleanReason('x'.repeat(500)).length).toBe(300)
    expect(isUuid(PAY)).toBe(true)
    expect(isUuid('pay_abc')).toBe(false)
    expect(refundLogOutcome('PAYMENT_REFUNDED')).toBe('done')
    expect(refundLogOutcome('PAYMENT_PARTIALLY_REFUNDED')).toBe('done')
    expect(refundLogOutcome('PAYMENT_REFUND_DENIED')).toBe('failed')
    expect(refundLogOutcome('PAYMENT_REFUND_IN_PROGRESS')).toBe('progress')
    expect(refundLogOutcome('PAYMENT_RECEIVED')).toBeNull()
  })
})

describe('chamadas ao Asaas', () => {
  it('apagar cobrança e assinatura; 404 conta como já feito; erro traz a mensagem do Asaas', async () => {
    const a = fakeAsaas((m, p) => (p.includes('pay_gone') || p.includes('sub_gone') ? { status: 404 } : p.includes('pay_bad') ? { status: 400, body: { errors: [{ description: 'Cobrança já recebida' }] } } : { status: 200 }))
    expect(await deleteCharge(a.access, 'pay_1')).toMatchObject({ ok: true, gone: false, error: null })
    expect(await deleteCharge(a.access, 'pay_gone')).toMatchObject({ ok: true, gone: true })
    expect(await deleteSubscription(a.access, 'sub_gone')).toMatchObject({ ok: true, gone: true })
    expect(await deleteCharge(a.access, 'pay_bad')).toMatchObject({ ok: false, error: 'Cobrança já recebida' })
    expect(a.calls[0]).toMatchObject({ method: 'DELETE', path: '/payments/pay_1' })
  })

  it('estorno: total não manda valor; parcial manda; o motivo vai como descrição', async () => {
    const a = fakeAsaas(() => ({ status: 200, body: { status: 'REFUND_REQUESTED' } }))
    await refundCharge(a.access, 'pay_1', undefined, 'arrependimento')
    await refundCharge(a.access, 'pay_1', 2.5)
    expect(a.calls[0]).toEqual({ method: 'POST', path: '/payments/pay_1/refund', body: { description: 'arrependimento' } })
    expect(a.calls[1].body).toEqual({ value: 2.5 })
  })
})

describe('estornar (Edge Function)', () => {
  it('estorno total: pede ao Asaas, registra "requested" e NÃO muda a cobrança para estornada', async () => {
    const db = fakeDb({ payments: [payRow()], profiles: [profile()] })
    const asaas = asaasOk()
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'refund', paymentId: PAY, reason: 'Arrependimento em 7 dias' })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ success: true, requested: true, full: true, value: 5 })
    expect(asaas.calls).toEqual([{ method: 'POST', path: '/payments/pay_abc/refund', body: { description: 'Arrependimento em 7 dias' } }])
    expect(db.tables.payments[0].status).toBe('paid') // quem muda é o webhook, quando o Asaas confirmar
    expect(logOf(db)).toHaveLength(1)
    expect(logOf(db)[0]).toMatchObject({ actor_id: ADMIN, action: 'refund', status: 'requested', amount: 5, payment_id: PAY, asaas_payment_id: 'pay_abc', reason: 'Arrependimento em 7 dias' })
  })

  it('estorno parcial manda o valor', async () => {
    const db = fakeDb({ payments: [payRow()] })
    const asaas = asaasOk()
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'refund', paymentId: PAY, reason: 'desconto', value: 2 })
    expect(r.json).toMatchObject({ success: true, full: false, value: 2 })
    expect(asaas.calls[0].body).toEqual({ value: 2, description: 'desconto' })
  })

  it('recusa sem falar com o Asaas: sem motivo, não paga, boleto, valor acima, cobrança de outro id', async () => {
    const cases: [Row, Row, string][] = [
      [payRow(), { reason: '' }, 'reason_required'],
      [payRow({ status: 'overdue' }), { reason: 'x' }, 'not_paid'],
      [payRow({ billing_type: 'BOLETO' }), { reason: 'x' }, 'method_not_supported'],
      [payRow(), { reason: 'x', value: 5.5 }, 'value_too_big'],
      [payRow({ asaas_payment_id: null }), { reason: 'x' }, 'no_asaas_id'],
    ]
    for (const [row, extra, code] of cases) {
      const db = fakeDb({ payments: [row] })
      const asaas = asaasOk()
      const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'refund', paymentId: PAY, ...extra })
      expect(r.json.code, code).toBe(code)
      expect(asaas.calls, code).toHaveLength(0)
      expect(logOf(db), code).toHaveLength(0)
    }
    const db = fakeDb({ payments: [payRow()] })
    const asaas = asaasOk()
    expect((await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'refund', paymentId: OTHER, reason: 'x' })).json.code).toBe('not_found')
    expect((await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'refund', paymentId: 'pay_abc', reason: 'x' })).json.code).toBe('invalid_input')
    expect(asaas.calls).toHaveLength(0)
  })

  it('clique duplo: o segundo pedido da mesma cobrança é recusado enquanto o primeiro espera o Asaas', async () => {
    const db = fakeDb({ payments: [payRow()] })
    const asaas = asaasOk()
    const body = { mode: 'refund', paymentId: PAY, reason: 'x' }
    expect((await runChargeAction(db, opsFor(asaas.access), ADMIN, body)).status).toBe(200)
    const again = await runChargeAction(db, opsFor(asaas.access), ADMIN, body)
    expect(again.status).toBe(409)
    expect(again.json.code).toBe('duplicate')
    expect(asaas.calls).toHaveLength(1) // só um pedido ao Asaas
  })

  it('o Asaas recusa: o registro vira "failed" e a cobrança continua paga', async () => {
    const db = fakeDb({ payments: [payRow()] })
    const asaas = fakeAsaas(() => ({ status: 400, body: { errors: [{ description: 'Saldo insuficiente' }] } }))
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'refund', paymentId: PAY, reason: 'x' })
    expect(r.status).toBe(502)
    expect(r.json).toMatchObject({ success: false, code: 'asaas_failed', error: 'Saldo insuficiente' })
    expect(logOf(db)[0].status).toBe('failed')
    expect(db.tables.payments[0].status).toBe('paid')
  })

  it('sem a tabela de registro (script não rodado), NADA é feito no Asaas', async () => {
    const db = fakeDb({ payments: [payRow()] }, { missingTables: ['mb_admin_billing_log'] })
    const asaas = asaasOk()
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'refund', paymentId: PAY, reason: 'x' })
    expect(r.json.code).toBe('log_unavailable')
    expect(asaas.calls).toHaveLength(0)
  })

  it('estorno com "cancelar a assinatura": cancela depois do pedido de estorno; falha ali não desfaz o estorno', async () => {
    const db = fakeDb({ payments: [payRow()], profiles: [profile()] })
    const asaas = asaasOk()
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'refund', paymentId: PAY, reason: 'x', cancelSubscription: true })
    expect(r.json).toMatchObject({ success: true, subscription: { ok: true } })
    expect(asaas.calls[0].path).toBe('/payments/pay_abc/refund') // o estorno vem primeiro
    expect(asaas.calls.some(c => c.method === 'DELETE' && c.path === '/subscriptions/sub_1')).toBe(true)
    expect(db.tables.profiles[0].subscription_status).toBe('canceled')
    expect(logOf(db).map(l => l.action).sort()).toEqual(['cancel_subscription', 'refund'])

    const db2 = fakeDb({ payments: [payRow()], profiles: [profile()] })
    const a2 = fakeAsaas((m, p) => (m === 'DELETE' ? { status: 400, body: { errors: [{ description: 'Assinatura bloqueada' }] } } : { status: 200, body: {} }))
    const r2 = await runChargeAction(db2, opsFor(a2.access), ADMIN, { mode: 'refund', paymentId: PAY, reason: 'x', cancelSubscription: true })
    expect(r2.json).toMatchObject({ success: true, requested: true, subscription: { ok: false } })
    expect(logOf(db2).find(l => l.action === 'refund')?.status).toBe('requested')
  })
})

describe('cancelar uma cobrança (Edge Function)', () => {
  it('apaga no Asaas, marca a linha como cancelada e, se era a única vencida, tira o atraso do cliente', async () => {
    const db = fakeDb({ payments: [payRow({ status: 'overdue' })], profiles: [profile()] })
    const asaas = asaasOk()
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'cancel_charge', paymentId: PAY, reason: 'teste' })
    expect(r.status).toBe(200)
    expect(asaas.calls).toEqual([{ method: 'DELETE', path: '/payments/pay_abc', body: undefined }])
    expect(db.tables.payments[0].status).toBe('canceled')
    expect(db.tables.profiles[0].overdue_since).toBeNull()
    expect(logOf(db)[0]).toMatchObject({ action: 'cancel_charge', status: 'done', actor_id: ADMIN })
  })

  it('havendo OUTRA vencida, o atraso continua; a assinatura nunca é tocada', async () => {
    const db = fakeDb({ payments: [payRow({ status: 'overdue' }), payRow({ id: OTHER, status: 'overdue', asaas_payment_id: 'pay_2' })], profiles: [profile()] })
    const asaas = asaasOk()
    await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'cancel_charge', paymentId: PAY })
    expect(db.tables.profiles[0].overdue_since).toBe('2026-11-17')
    expect(asaas.calls.some(c => c.path.startsWith('/subscriptions'))).toBe(false)
    expect(db.tables.profiles[0].subscription_status).toBe('active')
  })

  it('cobrança paga não se cancela (se estorna); falha do Asaas não mexe na linha', async () => {
    const db = fakeDb({ payments: [payRow()], profiles: [profile()] })
    const asaas = asaasOk()
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'cancel_charge', paymentId: PAY })
    expect(r.json.code).toBe('not_open')
    expect(asaas.calls).toHaveLength(0)

    const db2 = fakeDb({ payments: [payRow({ status: 'pending' })], profiles: [profile()] })
    const bad = fakeAsaas(() => ({ status: 400, body: { errors: [{ description: 'Não foi possível' }] } }))
    const r2 = await runChargeAction(db2, opsFor(bad.access), ADMIN, { mode: 'cancel_charge', paymentId: PAY })
    expect(r2.status).toBe(502)
    expect(db2.tables.payments[0].status).toBe('pending')
    expect(logOf(db2)[0].status).toBe('failed')
  })
})

describe('cancelar a assinatura (Edge Function)', () => {
  it('padrão: cancela a assinatura e as cobranças abertas; o cliente fica "canceled" (acesso até o fim do período) e o vínculo permanece', async () => {
    const db = fakeDb({ payments: [payRow({ status: 'overdue' })], profiles: [profile()] })
    const asaas = fakeAsaas((m, p) => (m === 'GET' ? { status: 200, body: { data: p.includes('status=OVERDUE') ? [{ id: 'pay_abc', status: 'OVERDUE', value: 5, dueDate: '2026-11-16' }] : [], hasMore: false } } : { status: 200 }))
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'cancel_subscription', userId: USER, reason: 'a pedido' })
    expect(r.json).toMatchObject({ success: true, chargesDeleted: 1, accessUntil: '2026-12-22T00:00:00Z' })
    expect(asaas.calls.find(c => c.method === 'DELETE')?.path).toBe('/subscriptions/sub_1') // a assinatura vem antes
    expect(db.tables.profiles[0]).toMatchObject({ subscription_status: 'canceled', asaas_subscription_id: 'sub_1', overdue_since: null })
    expect(db.tables.payments[0].status).toBe('canceled')
    expect(logOf(db)[0]).toMatchObject({ action: 'cancel_subscription', status: 'done', asaas_subscription_id: 'sub_1' })
  })

  it('sem cancelar as cobranças: só a assinatura sai do Asaas e as cobranças ficam como estão', async () => {
    const db = fakeDb({ payments: [payRow({ status: 'pending' })], profiles: [profile()] })
    const asaas = asaasOk()
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'cancel_subscription', userId: USER, cancelCharges: false })
    expect(r.json.success).toBe(true)
    expect(asaas.calls).toEqual([{ method: 'DELETE', path: '/subscriptions/sub_1', body: undefined }])
    expect(db.tables.payments[0].status).toBe('pending')
    expect(db.tables.profiles[0].subscription_status).toBe('canceled')
  })

  it('cliente bloqueado continua bloqueado; sem assinatura ou já cancelada: recusa sem tocar no Asaas', async () => {
    const dbB = fakeDb({ payments: [], profiles: [profile({ subscription_status: 'blocked' })] })
    await runChargeAction(dbB, opsFor(asaasOk().access), ADMIN, { mode: 'cancel_subscription', userId: USER, cancelCharges: false })
    expect(dbB.tables.profiles[0].subscription_status).toBe('blocked')

    for (const [over, code] of [[{ asaas_subscription_id: null }, 'no_subscription'], [{ subscription_status: 'canceled' }, 'already_canceled']] as [Row, string][]) {
      const db = fakeDb({ payments: [], profiles: [profile(over)] })
      const asaas = asaasOk()
      const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'cancel_subscription', userId: USER })
      expect(r.json.code, code).toBe(code)
      expect(asaas.calls, code).toHaveLength(0)
    }
  })

  it('o Asaas recusa: nada muda no nosso banco', async () => {
    const db = fakeDb({ payments: [payRow({ status: 'pending' })], profiles: [profile()] })
    const asaas = fakeAsaas(() => ({ status: 400, body: { errors: [{ description: 'Recusado' }] } }))
    const r = await runChargeAction(db, opsFor(asaas.access), ADMIN, { mode: 'cancel_subscription', userId: USER })
    expect(r.status).toBe(502)
    expect(db.tables.profiles[0].subscription_status).toBe('active')
    expect(db.tables.payments[0].status).toBe('pending')
    expect(logOf(db)[0].status).toBe('failed')
  })

  it('ação desconhecida ou cliente inválido', async () => {
    const db = fakeDb({ payments: [], profiles: [] })
    expect((await runChargeAction(db, opsFor(asaasOk().access), ADMIN, { mode: 'apagar_tudo' })).json.code).toBe('invalid_input')
    expect((await runChargeAction(db, opsFor(asaasOk().access), ADMIN, { mode: 'cancel_subscription', userId: 'x' })).json.code).toBe('invalid_input')
    expect((await runChargeAction(db, opsFor(asaasOk().access), ADMIN, { mode: 'cancel_subscription', userId: USER })).json.code).toBe('not_found')
  })
})

describe('webhook fecha o registro do estorno', () => {
  const rowsFor = () => [{ id: 'l1', action: 'refund', asaas_payment_id: 'pay_abc', status: 'requested' }, { id: 'l2', action: 'refund', asaas_payment_id: 'pay_zzz', status: 'requested' }]

  it('estornada = feito; negada = falhou; só a cobrança do evento', async () => {
    const db = fakeDb({ mb_admin_billing_log: rowsFor() })
    await closeRefundLog(db, 'pay_abc', 'PAYMENT_REFUNDED', { value: 5 })
    expect(db.tables.mb_admin_billing_log.map(l => l.status)).toEqual(['done', 'requested'])
    const db2 = fakeDb({ mb_admin_billing_log: rowsFor() })
    await closeRefundLog(db2, 'pay_abc', 'PAYMENT_REFUND_DENIED')
    expect(db2.tables.mb_admin_billing_log[0].status).toBe('failed')
  })

  it('em andamento e evento que não é de estorno não fecham; erro do banco não derruba o webhook', async () => {
    const db = fakeDb({ mb_admin_billing_log: rowsFor() })
    await closeRefundLog(db, 'pay_abc', 'PAYMENT_REFUND_IN_PROGRESS')
    await closeRefundLog(db, 'pay_abc', 'PAYMENT_RECEIVED')
    expect(db.tables.mb_admin_billing_log[0].status).toBe('requested')
    await expect(closeRefundLog(fakeDb({}, { missingTables: ['mb_admin_billing_log'] }), 'pay_abc', 'PAYMENT_REFUNDED')).resolves.toBeUndefined()
  })
})

describe('botões da tela e leitura da resposta', () => {
  const base = { group: 'paid' as const, method: 'PIX', subscriptionActive: false, refundRequested: false, asaasPaymentId: 'pay_1' }

  it('cada situação mostra só o que faz sentido', () => {
    expect(availableActions({ ...base, group: 'overdue' })).toEqual(['cancel_charge'])
    expect(availableActions({ ...base, group: 'upcoming', subscriptionActive: true })).toEqual(['cancel_charge', 'cancel_subscription'])
    expect(availableActions(base)).toEqual(['refund'])
    expect(availableActions({ ...base, method: 'CREDIT_CARD', subscriptionActive: true })).toEqual(['refund', 'cancel_subscription'])
    expect(availableActions({ ...base, method: 'BOLETO' })).toEqual([]) // boleto se estorna no painel do Asaas
    expect(availableActions({ ...base, refundRequested: true })).toEqual([]) // já pedido: espera o Asaas
    expect(availableActions({ ...base, group: 'canceled' })).toEqual([])
    expect(availableActions({ ...base, group: 'refunded', subscriptionActive: true })).toEqual(['cancel_subscription'])
    expect(availableActions({ ...base, group: 'overdue', asaasPaymentId: null })).toEqual([])
  })

  it('valor digitado: vírgula ou ponto, vazio = total, lixo = inválido', () => {
    expect(parseMoneyInput('')).toBeNull()
    expect(parseMoneyInput('  ')).toBeNull()
    expect(parseMoneyInput('2,5')).toBe(2.5)
    expect(parseMoneyInput('R$ 1.234,50')).toBe(1234.5)
    expect(parseMoneyInput('2.50')).toBe(2.5)
    expect(parseMoneyInput('5')).toBe(5)
    for (const bad of ['abc', '2,555', '-1', '1,2,3']) expect(parseMoneyInput(bad), bad).toBeNaN()
  })

  it('resposta da função vira resultado com código', () => {
    expect(readChargeActionResponse(200, { success: true, requested: true, subscription: { ok: false, error: 'x' } })).toMatchObject({ ok: true, subscription: { ok: false } })
    expect(readChargeActionResponse(409, { success: false, code: 'duplicate', error: 'já há' })).toEqual({ ok: false, code: 'duplicate', error: 'já há' })
    expect(readChargeActionResponse(502, { success: false, code: 'asaas_failed', error: 'Saldo insuficiente' })).toMatchObject({ code: 'asaas_failed', error: 'Saldo insuficiente' })
    expect(readChargeActionResponse(403, {})).toEqual({ ok: false, code: 'forbidden' })
    expect(readChargeActionResponse(401, {})).toEqual({ ok: false, code: 'forbidden' })
    expect(readChargeActionResponse(500, { code: 'inventado' }).code).toBe('unknown')
    expect(readChargeActionResponse(404, { code: 'NOT_FOUND' }).error).toContain('ainda não foi publicada')
  })
})

describe('segurança e fiação (conferência do código)', () => {
  const fn = read('supabase/functions/admin-cancel-billing/index.ts')
  const actions = read('supabase/functions/_shared/adminBilling.ts')

  it('a chave de serviço do site nunca faz as ações novas: elas exigem a sessão do SuperAdmin', () => {
    expect(fn).toContain('actorId = user.id')
    expect(fn).toContain('if (!actorId) return json({ error: "Esta ação exige a sessão do SuperAdmin." }, 403)')
    // a recusa da chave de serviço (purpose != abandoned) vem antes do ramo das ações novas
    expect(fn.indexOf('A chave de serviço só pode cancelar cobrança abandonada')).toBeLessThan(fn.indexOf('runChargeAction('))
    expect(fn.indexOf('is_super_admin')).toBeLessThan(fn.indexOf('runChargeAction('))
  })

  it('cada ação grava o registro ANTES de falar com o Asaas', () => {
    for (const [call, label] of [['ops.deleteCharge(ops.asaas', 'cancel_charge'], ['ops.refundCharge(ops.asaas', 'refund'], ['ops.cancelAsaasBilling(ops.asaas', 'cancel_subscription'], ['ops.deleteSubscription(ops.asaas', 'cancel_subscription (sem cobranças)']]) {
      const at = actions.indexOf(call)
      expect(at, label).toBeGreaterThan(0)
      expect(actions.lastIndexOf('startLog(db', at), label).toBeGreaterThan(0)
      expect(actions.lastIndexOf('startLog(db', at), label).toBeLessThan(at)
    }
    expect(actions).toContain('if (!logId) return NO_LOG()')
  })

  it('o estorno nunca marca a cobrança como estornada; quem faz isso é o webhook', () => {
    const refundBlock = actions.slice(actions.indexOf('if (mode === "refund")'))
    expect(refundBlock).not.toContain('status: "refunded"')
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    expect(hook).toContain('closeRefundLog(supabase, payment.id, event')
    for (const ev of ['PAYMENT_PARTIALLY_REFUNDED', 'PAYMENT_REFUND_DENIED', 'PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_DELETED', 'PAYMENT_RESTORED', 'PAYMENT_UPDATED']) {
      expect(hook, ev).toContain(`event === "${ev}"`)
    }
  })

  it('o estorno parcial não revoga comissão nem recompensas', () => {
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    const i = hook.indexOf('event === "PAYMENT_PARTIALLY_REFUNDED"')
    const block = hook.slice(i, hook.indexOf('PAYMENT_DELETED', i))
    expect(block).not.toContain('revokePartnerCommissionForPayment')
    expect(block).not.toContain('revokeReferralRewards')
  })

  it('o site só repassa o pedido com a sessão (sem chave de serviço) e confere SuperAdmin', () => {
    const src = read('src/app/actions/adminChargeActions.ts')
    expect(src).toContain('is_super_admin')
    expect(src).toContain('session.access_token')
    expect(src).not.toMatch(/createAdminClient|slotAdminDb|SERVICE_ROLE/)
    for (const w of ['.insert(', '.update(', '.delete(', '.upsert(']) expect(src, w).not.toContain(w)
  })

  it('o script cria a tabela de registro trancada (só o servidor)', () => {
    const sql = read('scripts/admin-cobrancas.sql')
    expect(sql).toContain('create table if not exists public.mb_admin_billing_log')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('revoke all on public.mb_admin_billing_log from public, anon, authenticated')
    expect(sql).toContain("('cancel_charge', 'cancel_subscription', 'refund')")
  })

  it('o aviso ao admin não diz que revogou comissão num estorno parcial ou negado', () => {
    const t = read('src/lib/billing/billingMailText.ts')
    const i = t.indexOf("kind === 'admin_refund'")
    const block = t.slice(i, i + 1400)
    expect(block).toContain('PAYMENT_PARTIALLY_REFUNDED')
    expect(block).toContain('PAYMENT_REFUND_DENIED')
  })
})
