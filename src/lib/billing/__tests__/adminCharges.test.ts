import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  CHARGE_GROUPS, DEFAULT_FILTERS, MAX_SUMMARY_ROWS, PAGE_SIZE, chargeGroup, dayEndIso, dayStartIso, normalizeFilters, sanitizeSearch, statusClause, summarizeCharges, toChargeDto,
} from '../adminCharges'

const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const today = '2026-11-22'

describe('situação da cobrança', () => {
  it('paga, estornada, cancelada e vencida seguem o status', () => {
    expect(chargeGroup('paid', '2026-11-16', today)).toBe('paid')
    expect(chargeGroup('refunded', '2026-11-16', today)).toBe('refunded')
    expect(chargeGroup('canceled', null, today)).toBe('canceled')
    expect(chargeGroup('cancelled', null, today)).toBe('canceled')
    expect(chargeGroup('overdue', '2026-11-30', today)).toBe('overdue')
  })

  it('pendente é "a vencer" até o vencimento e "vencida" depois (mesmo sem o aviso do Asaas)', () => {
    expect(chargeGroup('pending', '2026-11-22', today)).toBe('upcoming') // vence hoje: ainda em dia
    expect(chargeGroup('pending', '2026-11-23', today)).toBe('upcoming')
    expect(chargeGroup('pending', '2026-11-21', today)).toBe('overdue')
    expect(chargeGroup('pending', null, today)).toBe('upcoming')
    expect(chargeGroup(null, '2026-11-01', today)).toBe('overdue')
  })
})

describe('filtros vindos do navegador', () => {
  it('o que não vale volta ao padrão', () => {
    expect(normalizeFilters(null)).toEqual(DEFAULT_FILTERS)
    expect(normalizeFilters('lixo')).toEqual(DEFAULT_FILTERS)
    const n = normalizeFilters({ status: 'hack', dateField: 'x', from: '2026-13-45', to: 'ontem', userId: 'não é uuid', method: 'CHEQUE', page: -3 })
    expect(n).toEqual(DEFAULT_FILTERS)
    expect(normalizeFilters({ page: 1.5 }).page).toBe(0)
    expect(normalizeFilters({ page: 3 }).page).toBe(3)
  })

  it('aceita o que a tela manda e troca datas invertidas', () => {
    const uid = '8c72a89a-1792-4833-9dd9-38a4b06a7c1d'
    const n = normalizeFilters({ status: 'overdue', dateField: 'paid', from: '2026-12-31', to: '2026-12-01', userId: uid, method: 'PIX', q: 'lgpd' })
    expect(n).toMatchObject({ status: 'overdue', dateField: 'paid', from: '2026-12-01', to: '2026-12-31', userId: uid, method: 'PIX', q: 'lgpd' })
  })

  it('a busca não leva caractere que quebraria o filtro or() do PostgREST', () => {
    expect(sanitizeSearch('a,b(c)%d*e\\f"g\'h`i;j:k')).toBe('a b c d e f g h i j k')
    expect(sanitizeSearch('  pay_abc123  ')).toBe('pay_abc123')
    expect(sanitizeSearch('x'.repeat(200)).length).toBe(80)
    expect(sanitizeSearch(null)).toBe('')
    expect(normalizeFilters({ q: 'a,id.eq.1)' }).q).not.toMatch(/[,()]/)
  })
})

describe('cláusulas de situação', () => {
  it('uma por grupo, com a data de hoje nas que dependem dela', () => {
    expect(statusClause('all', today)).toBeNull()
    expect(statusClause('paid', today)).toBe('status.eq.paid')
    expect(statusClause('refunded', today)).toBe('status.eq.refunded')
    expect(statusClause('canceled', today)).toBe('status.eq.canceled')
    expect(statusClause('overdue', today)).toBe(`status.eq.overdue,and(status.eq.pending,due_date.lt.${today})`)
    expect(statusClause('upcoming', today)).toBe(`and(status.eq.pending,or(due_date.is.null,due_date.gte.${today}))`)
  })

  it('"vencidas" e "a vencer" nunca se sobrepõem (mesma regra do chargeGroup)', () => {
    const rows = [
      { status: 'pending', due: '2026-11-21' }, { status: 'pending', due: '2026-11-22' }, { status: 'pending', due: null },
      { status: 'overdue', due: '2026-12-31' }, { status: 'paid', due: '2026-11-01' },
    ]
    const inOverdue = (r: any) => r.status === 'overdue' || (r.status === 'pending' && !!r.due && r.due < today)
    const inUpcoming = (r: any) => r.status === 'pending' && (!r.due || r.due >= today)
    for (const r of rows) {
      const g = chargeGroup(r.status, r.due, today)
      expect(inOverdue(r), JSON.stringify(r)).toBe(g === 'overdue')
      expect(inUpcoming(r), JSON.stringify(r)).toBe(g === 'upcoming')
    }
  })

  it('limites do dia de Brasília em UTC', () => {
    expect(dayStartIso('2026-11-22')).toBe('2026-11-22T03:00:00.000Z')
    expect(dayEndIso('2026-11-22')).toBe('2026-11-23T02:59:59.999Z')
  })
})

describe('totais', () => {
  it('conta e soma por grupo, com centavos certos', () => {
    const s = summarizeCharges([
      { status: 'paid', due_date: '2026-11-16', amount: '5.10' },
      { status: 'paid', due_date: '2026-12-16', amount: 5.2 },
      { status: 'pending', due_date: '2026-11-21', amount: '0.1' },
      { status: 'pending', due_date: '2026-11-30', amount: '0.2' },
      { status: 'refunded', due_date: null, amount: null },
    ], today)
    expect(s.paid).toEqual({ count: 2, sum: 10.3 })
    expect(s.overdue).toEqual({ count: 1, sum: 0.1 })
    expect(s.upcoming).toEqual({ count: 1, sum: 0.2 })
    expect(s.refunded).toEqual({ count: 1, sum: 0 })
    expect(s.canceled).toEqual({ count: 0, sum: 0 })
    expect(s.truncated).toBe(false)
    expect(Object.keys(s).filter(k => k !== 'truncated').sort()).toEqual([...CHARGE_GROUPS].sort())
  })

  it('sem linhas, tudo zero', () => {
    const s = summarizeCharges([], today)
    for (const g of CHARGE_GROUPS) expect(s[g]).toEqual({ count: 0, sum: 0 })
  })
})

describe('linha para a tela', () => {
  it('paga mostra o dia do pagamento em Brasília; as outras não', () => {
    const paid = toChargeDto({ id: 'a', user_id: 'u', amount: '5.00', status: 'paid', due_date: '2026-11-16', created_at: '2026-11-16T11:24:51Z', webhook_received_at: '2026-11-22T02:30:00Z', billing_type: 'PIX', asaas_payment_id: 'pay_x' }, { name: 'LGPD', email: 'l@x' }, today)
    expect(paid).toMatchObject({ group: 'paid', paidOn: '2026-11-21', dueDate: '2026-11-16', createdOn: '2026-11-16', name: 'LGPD', amount: 5 }) // 02:30Z ainda é 21/11 em Brasília
    const open = toChargeDto({ id: 'b', user_id: null, amount: 5, status: 'overdue', due_date: '2026-11-16', created_at: '2026-11-16T11:24:51Z', webhook_received_at: '2026-11-22T02:30:00Z' }, undefined, today)
    expect(open.paidOn).toBeNull()
    expect(open.name).toBe('')
    expect(open.userId).toBeNull()
  })
})

describe('ação de servidor e telas', () => {
  const action = read('src/app/actions/adminCharges.ts')

  it('é só do SuperAdmin pela sessão e só lê (nenhuma escrita)', () => {
    expect(action).toContain('is_super_admin')
    expect(action).toContain("code: 'forbidden'")
    expect(action.indexOf('requireSuperAdmin()')).toBeLessThan(action.indexOf('normalizeFilters('))
    for (const w of ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc(']) expect(action, w).not.toContain(w)
  })

  it('filtra pelo texto normalizado e limita a página e os totais', () => {
    expect(action).toContain('normalizeFilters(input)')
    expect(action).toContain('range(f.page * PAGE_SIZE')
    expect(action).toContain('MAX_SUMMARY_ROWS')
    expect(PAGE_SIZE).toBe(25)
    expect(MAX_SUMMARY_ROWS).toBe(5000)
    // por data de pagamento só entram as pagas
    expect(action).toContain(".eq('status', 'paid')")
  })

  it('a subaba Cobranças está em Clientes, entre Clientes e Notas Fiscais, com o atalho por cliente', () => {
    const area = read('src/components/admin/tabs/ClientsArea.tsx')
    expect(area).toContain("(['clients', 'charges', 'nfse'] as const)")
    expect(area).toContain('<ClientsTab hook={hook} onViewCharges={viewCharges} />')
    expect(area).toContain('<ChargesTab hook={charges}')
    expect(area).toContain("useAdminCharges(refreshKey, sub === 'charges')") // só consulta depois de aberta
    const tab = read('src/components/admin/tabs/ClientsTab.tsx')
    expect(tab).toContain('data-testid="client-view-charges"')
    expect(tab).toContain('onViewCharges(client.ownerId')
  })

  it('os textos usados pela tela existem nos três idiomas', () => {
    const tab = read('src/components/admin/tabs/ChargesTab.tsx')
    const used = new Set<string>()
    for (const m of tab.matchAll(/\bk\('([a-z_A-Z]+)'/g)) used.add(m[1])
    for (const g of ['all', ...CHARGE_GROUPS]) used.add(`filter_${g}`)
    for (const g of CHARGE_GROUPS) used.add(`status_${g}`)
    for (const g of ['upcoming', 'overdue', 'paid']) used.add(`card_${g}`) // só estas três viram cartão
    for (const m of ['all', 'PIX', 'CREDIT_CARD', 'BOLETO']) used.add(`method_${m}`)
    for (const e of ['forbidden', 'unknown']) used.add(`err_${e}`)
    used.add('tab'); used.add('view_charges')
    // fase 2: o modal de ações (chaves fixas e as montadas pelo nome da ação)
    const modal = read('src/components/admin/tabs/ChargeActionModal.tsx')
    for (const m of modal.matchAll(/\bk\('([a-z_A-Z]+)'/g)) used.add(m[1])
    for (const a of ['cancel_charge', 'cancel_subscription', 'refund']) for (const p of ['act_', `${a}_title`, `${a}_help`, `btn_${a}`, `ok_${a}`]) used.add(p === 'act_' ? `act_${a}` : p)
    for (const c of ['invalid_input', 'not_found', 'not_open', 'no_asaas_id', 'no_subscription', 'already_canceled', 'not_paid', 'method_not_supported', 'invalid_value', 'value_too_big', 'reason_required', 'duplicate', 'log_unavailable', 'asaas_failed', 'unknown', 'forbidden']) used.add(`err_${c}`)
    for (const key of ['col_actions', 'refund_pending', 'refund_word', 'refund_confirm_label', 'ok_refund_sub_failed']) used.add(key)
    for (const l of ['pt', 'en', 'es']) {
      const j = JSON.parse(read(`src/i18n/translations/${l}.json`))
      for (const key of used) expect(j.admin_charges?.[key], `${l}: admin_charges.${key}`).toBeTruthy()
    }
  })
})
