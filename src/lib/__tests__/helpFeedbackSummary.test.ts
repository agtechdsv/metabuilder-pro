import { describe, it, expect } from 'vitest'
import { groupFeedback, suggestsOwnText } from '../helpFeedbackSummary'

const row = (field_id: string | null, zone: string | null, up: number, down: number, screen_id: string | null = 'v1') =>
  ({ screen_id, field_id, zone, up, down })

describe('resumo do feedback da ajuda', () => {
  it('agrupa por campo com uma linha por zona, ordenadas, e os de mais 👎 primeiro', () => {
    const out = groupFeedback(
      [row('a', 'grid', 0, 3), row('a', 'form', 4, 0), row('b', 'filter', 1, 1), row('x', 'form', 9, 9)],
      ['a', 'b'],
    )
    expect(out.map(t => t.fieldId)).toEqual(['a', 'b'])
    expect(out[0].zones.map(z => z.zone)).toEqual(['grid', 'form'])
    expect(out[0].totalDown).toBe(3)
  })

  it('só inclui a ajuda da tela quando ela é desta tela', () => {
    const rows = [row(null, 'screen', 2, 1, 'v1'), row(null, 'screen', 5, 5, 'v2')]
    expect(groupFeedback(rows, [], 'v1')).toHaveLength(1)
    expect(groupFeedback(rows, [])).toHaveLength(0)
  })

  it('voto da Central de Ajuda vira uma linha própria, depois das zonas reais, e não entra na sugestão', () => {
    const [t] = groupFeedback([row('a', 'central', 0, 5), row('a', 'form', 2, 0), row('a', 'grid', 0, 1)], ['a'])
    expect(t.zones.map(z => z.zone)).toEqual(['grid', 'form', 'central'])
    expect(suggestsOwnText(t, 'central', { custom: false, zoneCount: 3 })).toBe(false)
  })

  it('une votos antigos sem zona numa linha própria', () => {
    const out = groupFeedback([row('a', null, 1, 0), row('a', 'form', 0, 1)], ['a'])
    expect(out[0].zones.map(z => z.zone)).toEqual(['form', null])
  })

  it('sugere texto próprio só se a zona está pior, usa o padrão e o campo está em 2+ zonas', () => {
    const [t] = groupFeedback([row('a', 'grid', 1, 3), row('a', 'form', 5, 0)], ['a'])
    expect(suggestsOwnText(t, 'grid', { custom: false, zoneCount: 2 })).toBe(true)
    expect(suggestsOwnText(t, 'form', { custom: false, zoneCount: 2 })).toBe(false)
    expect(suggestsOwnText(t, 'grid', { custom: true, zoneCount: 2 })).toBe(false)
    expect(suggestsOwnText(t, 'grid', { custom: false, zoneCount: 1 })).toBe(false)
    expect(suggestsOwnText(t, 'screen', { custom: false, zoneCount: 2 })).toBe(false)
    expect(suggestsOwnText(t, 'central', { custom: false, zoneCount: 2 })).toBe(false)
  })
})
