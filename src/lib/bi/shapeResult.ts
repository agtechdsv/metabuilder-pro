// Transforma as linhas do SQL agregado ({ bi_name, bi_value, bi_series? }) nos dados que o gráfico desenha.
// Função pura: usada pelo painel em execução (resultado vindo do túnel) e pelo app exportado (resultado da ação de servidor).

import type { BiWidget } from './widget'

export interface SeriesTable {
  rows: Array<Record<string, any>>
  keys: string[]
}

export interface ShapedResult {
  /** KPI/gauge: número; demais: lista { name, value } */
  data: number | Array<{ name: string; value: number }>
  /** gráfico segmentado: tabela com uma coluna por série */
  series: SeriesTable | null
  /** havia mais grupos do que o teto: o gráfico mostra só os maiores */
  truncated: boolean
}

const MAX_SERIES = 11

const read = (r: any, k: string) => r?.[k] ?? r?.[k.toUpperCase()] ?? r?.[k.toLowerCase()]
const toNumber = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const label = (v: any) => (v === null || v === undefined || v === '' ? 'N/A' : String(v))

function sortRows<T extends { name: string; value: number }>(rows: T[], mode: string | undefined): T[] {
  if (mode === 'value_asc') return rows.sort((a, b) => a.value - b.value)
  if (mode === 'label_asc') return rows.sort((a, b) => a.name.localeCompare(b.name))
  if (mode === 'label_desc') return rows.sort((a, b) => b.name.localeCompare(a.name))
  return rows.sort((a, b) => b.value - a.value)
}

/** Valor único do SQL de comparação com o período anterior (KPI). */
export function prevValueFromRows(rows: any[] | undefined): number {
  const v = Number(read(rows?.[0], 'bi_value'))
  return Number.isFinite(v) ? v : 0
}

export function shapeAggRows(widget: BiWidget, rows: any[] | undefined, maxGroups: number): ShapedResult {
  const list = rows || []

  if (!widget.group_by) {
    const value = toNumber(read(list[0], 'bi_value'))
    const data = widget.type === 'kpi' || widget.type === 'gauge' ? value : [{ name: 'Total', value }]
    return { data, series: null, truncated: false }
  }

  const hasSeries = !!widget.series_by && ['bar', 'line', 'area'].includes(widget.type) && list.some(r => read(r, 'bi_series') !== undefined)
  if (hasSeries) {
    const byName = new Map<string, Record<string, number>>()
    const seriesTotals = new Map<string, number>()
    for (const r of list) {
      const n = label(read(r, 'bi_name'))
      const sName = label(read(r, 'bi_series'))
      const v = toNumber(read(r, 'bi_value'))
      const cur = byName.get(n) || {}
      cur[sName] = (cur[sName] || 0) + v
      byName.set(n, cur)
      seriesTotals.set(sName, (seriesTotals.get(sName) || 0) + v)
    }
    // até 11 séries; o restante vira "Outros"
    const ordered = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0])
    const keep = ordered.slice(0, MAX_SERIES)
    const others = ordered.slice(MAX_SERIES)
    const keys = others.length ? [...keep, 'Outros'] : keep
    let table = [...byName.entries()].map(([name, vals]) => {
      const row: any = { name, value: 0 }
      for (const k of keep) { row[k] = vals[k] || 0 }
      if (others.length) row['Outros'] = others.reduce((a, k) => a + (vals[k] || 0), 0)
      row.value = keys.reduce((a, k) => a + (row[k] || 0), 0)
      return row
    })
    table = sortRows(table, widget.sort_by)
    if (widget.limit_top_n && widget.limit_top_n > 0) table = table.slice(0, widget.limit_top_n)
    return {
      data: table.map(r => ({ name: r.name, value: r.value })),
      series: { rows: table, keys },
      truncated: list.length >= maxGroups * 5,
    }
  }

  let finalData = list.map(r => ({ name: label(read(r, 'bi_name')), value: toNumber(read(r, 'bi_value')) }))
  finalData = sortRows(finalData, widget.sort_by)
  if (widget.limit_top_n && widget.limit_top_n > 0) finalData = finalData.slice(0, widget.limit_top_n)
  return { data: finalData, series: null, truncated: !widget.limit_top_n && list.length >= maxGroups }
}
