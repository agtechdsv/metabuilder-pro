import { describe, it, expect } from 'vitest'
import { compareRuns, runId, runTotals, type HistoryRow, type HistoryRun } from '../history'
import { planTitle } from '../plan'

const row = (title: string, status: HistoryRow['status'], ms = 1000): HistoryRow => ({ kind: 'lista', title, status, ms })
const run = (id: string, rows: HistoryRow[]): HistoryRun => ({
  version: 1, id, projectId: 'p', projectName: 'Vendas', startedAt: '2026-10-19T10:00:00Z', finishedAt: '2026-10-19T10:01:00Z', mode: 'background',
  groups: [{ slug: 'clientes', name: 'Clientes (clientes)', viewTitle: 'Clientes', logicType: 'pesquisa_cadastro', rows }],
})

describe('histórico de execuções', () => {
  it('id da execução vira o nome do arquivo (data e hora locais)', () => {
    expect(runId(new Date(2026, 9, 19, 4, 5, 6))).toBe('20261019-040506')
  })

  it('totais: taxa só conta o que rodou; o resto fica em "outros"', () => {
    const t = runTotals(run('a', [row('1', 'passed'), row('2', 'passed'), row('3', 'failed'), row('4', 'pending')]))
    expect(t).toMatchObject({ total: 4, passed: 2, failed: 1, other: 1, rate: 67 })
  })

  it('comparativo: regressão, corrigido, ainda falha, novo, removido e igual', () => {
    const a = run('a', [row('r', 'passed'), row('c', 'failed'), row('f', 'failed'), row('s', 'passed'), row('x', 'passed', 500)])
    const b = run('b', [row('r', 'failed'), row('c', 'passed'), row('f', 'failed'), row('s', 'passed', 1500), row('n', 'passed')])
    const { rows, counts } = compareRuns(a, b)
    const of = (t: string) => rows.find(r => r.row.title === t)!
    expect(of('r').change).toBe('regression')
    expect(of('c').change).toBe('fixed')
    expect(of('f').change).toBe('still_failing')
    expect(of('s').change).toBe('same')
    expect(of('s').deltaMs).toBe(500)
    expect(of('n').change).toBe('new')
    expect(of('x').change).toBe('removed')
    expect(counts).toMatchObject({ regression: 1, fixed: 1, still_failing: 1, same: 1, new: 1, removed: 1 })
    // regressões primeiro
    expect(rows[0].change).toBe('regression')
  })

  it('texto do teste em outro idioma; o título em português continua sendo a chave', () => {
    const p = { kind: 'grid_ordenacao' as const, title: 'grid: ordenar por "Nome" nos dois sentidos', label: 'Nome' }
    expect(planTitle(p, 'pt')).toBe(p.title)
    expect(planTitle(p, 'en')).toBe('grid: sort by "Nome" in both directions')
    expect(planTitle(p, 'es')).toBe('grid: ordenar por "Nome" en ambos sentidos')
    expect(planTitle({ kind: 'exportacao', title: 'x', format: 'xlsx' }, 'en')).toBe('Excel export: valid .xlsx file')
  })
})
