import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { filterPartners, payoutSkipReason, toggleAllVisible } from '../partnersFilter'

const mk = (id: string, over: any = {}) => ({
  id, name: 'Parceiro ' + id, userEmail: id + '@x.com', code: id.toUpperCase(), status: 'active', pixKey: '123', pendingPix: null,
  summary: { payable: 0, waiting: 0, inPayout: 0, paid: 0, clawback: 0 }, ...over,
}) as any

const partners = [
  mk('a', { summary: { payable: 80, waiting: 0 } }),
  mk('b', { summary: { payable: 10, waiting: 5 } }),
  mk('c', { pixKey: null, summary: { payable: 90, waiting: 0 } }),
  mk('d', { status: 'suspended', summary: { payable: 70, waiting: 0 } }),
  mk('e', { pendingPix: { type: 'CPF', key: '1', document: '1', at: 'x' }, summary: { payable: 0, waiting: 20 } }),
]

describe('filtro e seleção da lista de parceiros', () => {
  it('motivo de ficar fora do lote', () => {
    expect(payoutSkipReason(partners[0], 50)).toBeNull()
    expect(payoutSkipReason(partners[1], 50)).toBe('below_min')
    expect(payoutSkipReason(partners[2], 50)).toBe('no_pix')
    expect(payoutSkipReason(partners[3], 50)).toBe('suspended')
  })

  it('cada filtro', () => {
    const ids = (f: any, q = '') => filterPartners(partners, f, q, 50).map(p => p.id)
    expect(ids('all')).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(ids('to_pay')).toEqual(['a'])
    expect(ids('balance')).toEqual(['a', 'b', 'c', 'd'])
    expect(ids('waiting')).toEqual(['b', 'e'])
    expect(ids('no_pix')).toEqual(['c'])
    expect(ids('pending_pix')).toEqual(['e'])
    expect(ids('suspended')).toEqual(['d'])
    expect(ids('all', 'PARCEIRO c')).toEqual(['c'])
    expect(ids('balance', 'd@x')).toEqual(['d'])
  })

  it('selecionar todos vale só para os exibidos e mantém o que já estava marcado fora do filtro', () => {
    const on = toggleAllVisible(new Set(['z']), ['a', 'b'])
    expect([...on].sort()).toEqual(['a', 'b', 'z'])
    const off = toggleAllVisible(on, ['a', 'b'])
    expect([...off]).toEqual(['z'])
    // com alguns marcados, marca os que faltam
    expect([...toggleAllVisible(new Set(['a']), ['a', 'b'])].sort()).toEqual(['a', 'b'])
    // lista vazia não faz nada
    expect([...toggleAllVisible(new Set(['z']), [])]).toEqual(['z'])
  })

  it('a tela usa o filtro, a busca e o "selecionar todos"', () => {
    const ui = readFileSync('src/components/admin/PartnersAdmin.tsx', 'utf8')
    expect(ui).toContain('filterPartners(')
    expect(ui).toContain('toggleAllVisible(prev, visibleIds)')
    expect(ui).toContain('payoutSkipReason(p, settings.minPayout)')
  })
})
