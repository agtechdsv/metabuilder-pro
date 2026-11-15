import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { cancelAsaasBilling, inspectAsaasBilling, listOpenCharges, isAlreadyGone } from '../../../supabase/functions/_shared/adminCancel'
import { billingFunctionUrl, hasOpenBilling, readBillingResponse } from '../admin/billingCancel'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

/** Asaas falso: guarda as chamadas e responde conforme a regra de cada teste. */
function fakeAsaas(rules: (method: string, path: string) => { status: number; body?: any }) {
  const calls: string[] = []
  const fetcher = (async (url: string, init: any) => {
    const path = String(url).replace('https://asaas.test', '')
    calls.push(`${init.method} ${path}`)
    const r = rules(init.method, path)
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} }
  }) as any
  return { calls, access: { url: 'https://asaas.test', key: 'k', fetcher } }
}

const open = (id: string, value: number, status = 'PENDING') => ({ id, value, status, dueDate: '2026-12-01' })

describe('cancelamento de cobrança no Asaas (excluir e bloquear cliente)', () => {
  it('cancela a assinatura primeiro e depois apaga as cobranças abertas (pendentes e vencidas)', async () => {
    const { calls, access } = fakeAsaas((m, p) => {
      if (m === 'DELETE') return { status: 200, body: { deleted: true } }
      if (p.includes('status=PENDING')) return { status: 200, body: { data: [open('pay_1', 5)], hasMore: false } }
      if (p.includes('status=OVERDUE')) return { status: 200, body: { data: [open('pay_2', 5, 'OVERDUE')], hasMore: false } }
      return { status: 200, body: { data: [] } }
    })
    const out = await cancelAsaasBilling(access, { customerId: 'cus_1', subscriptionId: 'sub_1' })
    expect(out).toEqual({ subscriptionCanceled: true, chargesDeleted: 2, failures: [] })
    expect(calls[0]).toBe('DELETE /subscriptions/sub_1') // a assinatura vem antes de qualquer cobrança
    expect(calls).toContain('DELETE /payments/pay_1')
    expect(calls).toContain('DELETE /payments/pay_2')
  })

  it('se a assinatura não cancelar, para: apagar as cobranças de agora não adiantaria', async () => {
    const { calls, access } = fakeAsaas(() => ({ status: 400, body: { errors: [{ description: 'Assinatura bloqueada' }] } }))
    const out = await cancelAsaasBilling(access, { customerId: 'cus_1', subscriptionId: 'sub_1' })
    expect(out.subscriptionCanceled).toBe(false)
    expect(out.failures).toEqual(['Assinatura: Assinatura bloqueada'])
    expect(calls).toEqual(['DELETE /subscriptions/sub_1'])
  })

  it('assinatura que já não existe no Asaas (404) conta como cancelada', async () => {
    expect(isAlreadyGone(404)).toBe(true)
    expect(isAlreadyGone(400)).toBe(false)
    const { access } = fakeAsaas((m) => (m === 'DELETE' ? { status: 404 } : { status: 200, body: { data: [] } }))
    const out = await cancelAsaasBilling(access, { customerId: 'cus_1', subscriptionId: 'sub_1' })
    expect(out).toEqual({ subscriptionCanceled: true, chargesDeleted: 0, failures: [] })
  })

  it('uma cobrança que não dá para apagar entra nas falhas, e as outras continuam', async () => {
    const { access } = fakeAsaas((m, p) => {
      if (m === 'DELETE' && p === '/payments/pay_1') return { status: 400, body: { errors: [{ description: 'Cobrança já paga' }] } }
      if (m === 'DELETE') return { status: 200 }
      if (p.includes('status=PENDING')) return { status: 200, body: { data: [open('pay_1', 5), open('pay_2', 5)] } }
      return { status: 200, body: { data: [] } }
    })
    const out = await cancelAsaasBilling(access, { customerId: 'cus_1', subscriptionId: null })
    expect(out.chargesDeleted).toBe(1)
    expect(out.failures).toEqual(['Cobrança pay_1: Cobrança já paga'])
  })

  it('sem cliente do Asaas lista pelas cobranças da assinatura; sem nenhum dos dois não chama o Asaas', async () => {
    const bySub = fakeAsaas(() => ({ status: 200, body: { data: [] } }))
    await listOpenCharges(bySub.access, { customerId: null, subscriptionId: 'sub_9' })
    expect(bySub.calls[0]).toBe('GET /subscriptions/sub_9/payments?status=PENDING&limit=100&offset=0')
    const none = fakeAsaas(() => ({ status: 200, body: { data: [] } }))
    expect(await inspectAsaasBilling(none.access, { customerId: null, subscriptionId: null })).toEqual({ hasBilling: false, hasSubscription: false, chargeCount: 0, chargeTotal: 0 })
    expect(none.calls).toEqual([])
  })

  it('a consulta não apaga nada e soma o valor aberto', async () => {
    const { calls, access } = fakeAsaas((_m, p) => (p.includes('status=PENDING') ? { status: 200, body: { data: [open('a', 5), open('b', 10.5)] } } : { status: 200, body: { data: [] } }))
    const info = await inspectAsaasBilling(access, { customerId: 'cus_1', subscriptionId: 'sub_1' })
    expect(info).toEqual({ hasBilling: true, hasSubscription: true, chargeCount: 2, chargeTotal: 15.5 })
    expect(calls.every(c => c.startsWith('GET '))).toBe(true)
  })

  it('pagina a listagem (hasMore) e para quando acaba', async () => {
    let page = 0
    const { calls, access } = fakeAsaas((_m, p) => {
      if (!p.includes('status=PENDING')) return { status: 200, body: { data: [] } }
      page++
      return { status: 200, body: { data: [open(`p${page}`, 1)], hasMore: page < 3 } }
    })
    const all = await listOpenCharges(access, { customerId: 'cus_1', subscriptionId: null })
    expect(all.map(c => c.id)).toEqual(['p1', 'p2', 'p3'])
    expect(calls.filter(c => c.includes('status=PENDING')).map(c => c.match(/offset=(\d+)/)![1])).toEqual(['0', '100', '200'])
  })
})

describe('leitura da resposta da função e ponte com o Next', () => {
  it('endereço da função e "há algo a cancelar?"', () => {
    expect(billingFunctionUrl('https://x.supabase.co/')).toBe('https://x.supabase.co/functions/v1/admin-cancel-billing')
    expect(hasOpenBilling(null)).toBe(false)
    expect(hasOpenBilling({ hasBilling: false, hasSubscription: false, chargeCount: 0, chargeTotal: 0 })).toBe(false)
    expect(hasOpenBilling({ hasBilling: true, hasSubscription: true, chargeCount: 0, chargeTotal: 0 })).toBe(true)
    expect(hasOpenBilling({ hasBilling: true, hasSubscription: false, chargeCount: 2, chargeTotal: 10 })).toBe(true)
  })

  it('função não publicada, sessão e permissão viram mensagens claras; falha do Asaas passa a mensagem', () => {
    expect(readBillingResponse(404, { code: 'NOT_FOUND' }).error).toContain('ainda não foi publicada')
    expect(readBillingResponse(404, { error: 'Cliente não encontrado.' }).error).toBe('Cliente não encontrado.')
    expect(readBillingResponse(401, {}).error).toContain('Sessão expirada')
    expect(readBillingResponse(403, {}).error).toContain('SuperAdmin')
    expect(readBillingResponse(502, { success: false, error: 'Assinatura: x' })).toEqual({ ok: false, error: 'Assinatura: x' })
    expect(readBillingResponse(200, { success: true, hasBilling: true, hasSubscription: true, chargeCount: 1, chargeTotal: 5 }).info).toEqual({ hasBilling: true, hasSubscription: true, chargeCount: 1, chargeTotal: 5 })
    expect(readBillingResponse(200, { success: true, subscriptionCanceled: true, chargesDeleted: 2, failures: [] })).toEqual({ ok: true, chargesDeleted: 2 })
  })

  it('excluir: confere parceiro e cancela a cobrança ANTES de apagar qualquer usuário, e não exclui se o Asaas falhar', () => {
    const src = read('src/app/actions/admin.ts')
    const fn = src.slice(src.indexOf('export async function deleteClientAdmin'))
    const partner = fn.indexOf(".from('partners')")
    const cancel = fn.indexOf("mode: 'cancel', purpose: 'delete'")
    const firstDelete = fn.indexOf('auth.admin.deleteUser')
    expect(partner).toBeGreaterThan(0)
    expect(cancel).toBeGreaterThan(partner)
    expect(firstDelete).toBeGreaterThan(cancel)
    expect(fn).toContain('Nada foi excluído.') // falha no Asaas: aborta
    expect(fn.indexOf("agent_tasks")).toBeGreaterThan(cancel) // nem a limpeza de tabelas vem antes do cancelamento
  })

  it('bloquear: só cancela quando o SuperAdmin marcou, e não bloqueia se o cancelamento falhar', () => {
    const src = read('src/app/actions/admin.ts')
    const fn = src.slice(src.indexOf('export async function toggleClientBlock'), src.indexOf('export async function toggleUserCommunityBlock'))
    expect(fn).toContain('cancelBilling = false') // desmarcado por padrão
    expect(fn).toContain('isBlocked && cancelBilling')
    expect(fn.indexOf("purpose: 'block'")).toBeLessThan(fn.indexOf("subscription_status: isBlocked ? 'blocked' : 'active'"))
    expect(fn).toContain('return { success: false, error: r.error }')
  })

  it('a função só aceita o SuperAdmin e só o purpose "delete" refaz os efeitos do webhook', () => {
    const fn = read('supabase/functions/admin-cancel-billing/index.ts')
    expect(fn).toContain('is_super_admin')
    expect(fn).toContain('403')
    expect(fn).toContain('body?.purpose === "delete"')
    expect(fn).toContain('revokeReferralRewards')
    expect(fn).toContain('cancelPartnerReferral')
  })

  it('o webhook não troca "bloqueado" por "cancelado" quando o admin cancela a cobrança de um cliente bloqueado', () => {
    const hook = read('supabase/functions/asaas-webhook/index.ts')
    const i = hook.indexOf('event === "SUBSCRIPTION_DELETED"')
    expect(hook.slice(i, i + 700)).toContain('.neq("subscription_status", "blocked")')
  })
})
