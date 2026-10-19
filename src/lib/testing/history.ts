import type { PlannedTest } from './plan'
import type { TestStatus } from './results'

/**
 * Histórico de execuções do Ambiente de Testes: um registro por rodada, guardado em arquivo no disco do usuário (src/utils/testHistory.ts).
 * Aqui só os tipos e a conta do comparativo, sem dependência de tela nem de disco (o teste unitário roda no Node).
 */
export type RowStatus = TestStatus | 'pending'

/** Um teste do plano com o resultado da rodada (o plano vem junto para o texto poder ser mostrado em qualquer idioma). */
export interface HistoryRow extends PlannedTest { status: RowStatus; ms?: number; error?: string; shot?: string; video?: string }
export interface HistoryGroup { slug: string; name: string; viewTitle: string; logicType: string; rows: HistoryRow[] }

export interface HistoryRun {
  version: 1
  /** AAAAMMDD-HHMMSS: também é o nome do arquivo */
  id: string
  projectId: string
  projectName: string
  startedAt: string
  finishedAt: string
  mode: string
  /** a rodada foi interrompida pelo usuário */
  stopped?: boolean
  groups: HistoryGroup[]
  /** cópia do relatório técnico do Playwright desta execução (caminho do index.html), quando foi guardada */
  techReport?: string
}

export const runId = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function runTotals(run: Pick<HistoryRun, 'groups'>) {
  const rows = run.groups.flatMap(g => g.rows)
  const passed = rows.filter(r => r.status === 'passed').length
  const failed = rows.filter(r => r.status === 'failed').length
  const executed = passed + failed
  return { total: rows.length, passed, failed, other: rows.length - executed, ms: rows.reduce((a, r) => a + (r.ms || 0), 0), rate: executed ? Math.round((passed / executed) * 100) : 0 }
}

export type Change = 'regression' | 'still_failing' | 'fixed' | 'new' | 'removed' | 'other' | 'same'
export const CHANGE_ORDER: Change[] = ['regression', 'still_failing', 'fixed', 'new', 'removed', 'other', 'same']

export interface CompareRow {
  group: string
  row: HistoryRow
  a?: HistoryRow
  b?: HistoryRow
  change: Change
  /** variação de tempo (B − A) em ms, quando os dois rodaram */
  deltaMs?: number
}

const keyOf = (group: string, row: PlannedTest) => `${group}||${row.title}`

/** Compara a execução A (a mais antiga) com a B (a mais nova), teste a teste. */
export function compareRuns(a: HistoryRun, b: HistoryRun): { rows: CompareRow[]; counts: Record<Change, number> } {
  const map = new Map<string, { group: string; a?: HistoryRow; b?: HistoryRow }>()
  for (const [side, run] of [['a', a], ['b', b]] as const) {
    for (const g of run.groups) {
      for (const r of g.rows) {
        const k = keyOf(g.name, r)
        const cur = map.get(k) ?? { group: g.name }
        cur[side] = r
        map.set(k, cur)
      }
    }
  }
  const rows: CompareRow[] = []
  for (const { group, a: ra, b: rb } of map.values()) {
    const change: Change = !ra ? 'new' : !rb ? 'removed'
      : ra.status === 'passed' && rb.status === 'failed' ? 'regression'
      : ra.status === 'failed' && rb.status === 'passed' ? 'fixed'
      : ra.status === 'failed' && rb.status === 'failed' ? 'still_failing'
      : ra.status === 'passed' && rb.status === 'passed' ? 'same' : 'other'
    rows.push({ group, row: (rb ?? ra)!, a: ra, b: rb, change, deltaMs: ra?.ms != null && rb?.ms != null ? rb.ms - ra.ms : undefined })
  }
  rows.sort((x, y) => CHANGE_ORDER.indexOf(x.change) - CHANGE_ORDER.indexOf(y.change) || x.group.localeCompare(y.group))
  const counts = Object.fromEntries(CHANGE_ORDER.map(c => [c, rows.filter(r => r.change === c).length])) as Record<Change, number>
  return { rows, counts }
}
