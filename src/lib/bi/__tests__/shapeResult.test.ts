import { describe, it, expect } from 'vitest'
import { shapeAggRows, prevValueFromRows } from '../shapeResult'
import type { BiWidget } from '../widget'

const w = (p: Partial<BiWidget>): BiWidget => ({ id: 'w', title: 't', type: 'bar', model_id: 'm', field: 'T.C', calc: 'SUM', ...p } as BiWidget)

describe('shapeAggRows', () => {
  it('KPI sem agrupamento devolve número (chaves em qualquer caixa)', () => {
    expect(shapeAggRows(w({ type: 'kpi' }), [{ BI_VALUE: '12.5' }], 50).data).toBe(12.5)
    expect(shapeAggRows(w({ type: 'gauge' }), [], 50).data).toBe(0)
  })
  it('gráfico sem agrupamento vira um "Total"', () => {
    expect(shapeAggRows(w({ type: 'bar' }), [{ bi_value: 7 }], 50).data).toEqual([{ name: 'Total', value: 7 }])
  })
  it('agrupado ordena por valor desc por padrão e troca nulo por N/A', () => {
    const r = shapeAggRows(w({ group_by: 'T.G' }), [{ bi_name: 'a', bi_value: 1 }, { bi_name: null, bi_value: 9 }, { bi_name: 'c', bi_value: 5 }], 50)
    expect(r.data).toEqual([{ name: 'N/A', value: 9 }, { name: 'c', value: 5 }, { name: 'a', value: 1 }])
  })
  it('respeita sort_by e limit_top_n', () => {
    const rows = [{ bi_name: 'b', bi_value: 1 }, { bi_name: 'a', bi_value: 9 }, { bi_name: 'c', bi_value: 5 }]
    expect(shapeAggRows(w({ group_by: 'T.G', sort_by: 'label_asc' }), rows, 50).data).toEqual([{ name: 'a', value: 9 }, { name: 'b', value: 1 }, { name: 'c', value: 5 }])
    expect(shapeAggRows(w({ group_by: 'T.G', limit_top_n: 2 }), rows, 50).data).toEqual([{ name: 'a', value: 9 }, { name: 'c', value: 5 }])
  })
  it('truncated: só sem limit_top_n e ao atingir o teto', () => {
    const rows = [{ bi_name: 'a', bi_value: 1 }, { bi_name: 'b', bi_value: 2 }]
    expect(shapeAggRows(w({ group_by: 'T.G' }), rows, 2).truncated).toBe(true)
    expect(shapeAggRows(w({ group_by: 'T.G' }), rows, 3).truncated).toBe(false)
    expect(shapeAggRows(w({ group_by: 'T.G', limit_top_n: 5 }), rows, 2).truncated).toBe(false)
  })
  it('segmentado monta uma coluna por série e soma o total', () => {
    const rows = [
      { bi_name: 'jan', bi_series: 'x', bi_value: 1 }, { bi_name: 'jan', bi_series: 'y', bi_value: 2 },
      { bi_name: 'fev', bi_series: 'x', bi_value: 10 },
    ]
    const r = shapeAggRows(w({ group_by: 'T.G', series_by: 'T.S' }), rows, 50)
    expect(r.series?.keys).toEqual(['x', 'y'])
    expect(r.series?.rows).toEqual([{ name: 'fev', value: 10, x: 10, y: 0 }, { name: 'jan', value: 3, x: 1, y: 2 }])
    expect(r.data).toEqual([{ name: 'fev', value: 10 }, { name: 'jan', value: 3 }])
  })
  it('mais de 11 séries: o resto vira "Outros"', () => {
    const rows = Array.from({ length: 13 }, (_, i) => ({ bi_name: 'a', bi_series: `s${i}`, bi_value: 13 - i }))
    const r = shapeAggRows(w({ group_by: 'T.G', series_by: 'T.S' }), rows, 50)
    expect(r.series?.keys).toHaveLength(12)
    expect(r.series?.keys[11]).toBe('Outros')
    expect(r.series?.rows[0].Outros).toBe(2 + 1)
  })
  it('série pedida em widget que não suporta (pizza) é ignorada', () => {
    const r = shapeAggRows(w({ type: 'pie', group_by: 'T.G', series_by: 'T.S' }), [{ bi_name: 'a', bi_series: 'x', bi_value: 4 }], 50)
    expect(r.series).toBeNull()
  })
})

describe('prevValueFromRows', () => {
  it('lê o valor ou devolve 0', () => {
    expect(prevValueFromRows([{ BI_VALUE: '3' }])).toBe(3)
    expect(prevValueFromRows([])).toBe(0)
    expect(prevValueFromRows([{ bi_value: null }])).toBe(0)
  })
})
