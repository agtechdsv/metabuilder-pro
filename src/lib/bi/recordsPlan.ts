/**
 * "Ver registros" (drill-down da Fase 4): as linhas da tabela do widget que compõem o número clicado.
 *
 * Usa as mesmas condições do widget (filtros, período, filtro cruzado e o caminho de drill já somados pelo chamador),
 * os mesmos JOINs mínimos e o mesmo vocabulário de SQL do planejador de agregação. Função pura: devolve o SQL.
 */
import { getPkColumn } from '../schemaResolver'
import { resolveRelations, resolveAllJoins, buildJoinSql, type JoinStep } from '../relationPathFinder'
import { findAlternativePaths, pathSignature } from '../relationPaths'
import { conditionSql, filterConditionSql, quoteFor, type SqlDialect, type BiCondition, type BiConditionOp, type BiColKind } from './queryBuilder'
import { biFieldKind } from './columnKind'
import { nextDay, type PeriodRange } from './period'
import type { BiWidget } from './widget'

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const FILTER_KEY = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/

export interface RecordsInput {
  /** widget efetivo: já com os filtros cruzados e o caminho de drill somados em `conditions` */
  widget: BiWidget
  models: any[] | Record<string, any>
  relations: any[]
  dialect: SqlDialect | null
  period?: PeriodRange | null
  screenFilters?: Record<string, string>
  projectSlug?: string
  /** máximo de linhas */
  limit: number
}

export interface RecordsPlan {
  kind: 'records' | 'error'
  tableName: string
  schemaName: string
  sql?: string
  limit: number
  message?: string
}

export function planRecordsQuery(input: RecordsInput): RecordsPlan {
  const { widget, dialect, limit } = input
  const allModels: any[] = Array.isArray(input.models) ? input.models : Object.values(input.models || {})
  const model = allModels.find(m => String(m.id) === String(widget.model_id))
  const mainTable: string | null =
    model?.db_table_name || (typeof widget.model_id === 'string' && widget.model_id !== 'undefined' && !widget.model_id.includes('-') ? widget.model_id : null)
  const schemaName: string = model?.db_schema_name || input.projectSlug || 'public'
  const fail = (message: string): RecordsPlan => ({ kind: 'error', tableName: mainTable || '', schemaName, limit, message })

  if (!mainTable || !IDENT.test(mainTable)) return fail('Tabela não encontrada')
  if (!dialect) return fail('Ver registros exige banco PostgreSQL, Oracle, MySQL ou SQL Server')

  const Q = quoteFor(dialect)
  const qCol = (t: string, c: string) => `${Q(t)}.${Q(c)}`
  const resolveRef = (s: string) => (s.includes('.') ? { table: s.split('.')[0], column: s.split('.')[1] } : { table: mainTable, column: s })

  const fieldsOf = (table: string): any[] => {
    const m = allModels.find(x => x.db_table_name === table)
    return (Array.isArray(m?.fields) ? m.fields : Object.values(m?.fields || {})) as any[]
  }
  const columnExists = (table: string, column: string) => fieldsOf(table).some(f => String(f.db_column_name).toLowerCase() === column.toLowerCase())
  const colKind = (table: string, column: string): BiColKind =>
    biFieldKind(fieldsOf(table).find(x => String(x.db_column_name).toLowerCase() === column.toLowerCase()))

  // Condições do widget + período
  const conditions: BiCondition[] = []
  for (const c of widget.conditions || []) {
    if (!c?.field || !c.op) continue
    const noValue = c.op === 'is_null' || c.op === 'not_null'
    if (!noValue && (c.value === undefined || c.value === '')) continue
    if (c.op === 'between' && (c.value2 === undefined || c.value2 === '')) continue
    const ref = resolveRef(String(c.field))
    if (!IDENT.test(ref.table) || !IDENT.test(ref.column)) return fail('Filtro com campo inválido')
    conditions.push({ col: ref, op: c.op as BiConditionOp, kind: colKind(ref.table, ref.column), value: c.value, value2: c.value2 })
  }
  if (widget.period_field && input.period) {
    const ref = resolveRef(widget.period_field)
    if (IDENT.test(ref.table) && IDENT.test(ref.column)) {
      conditions.push({ col: ref, op: 'gte', kind: 'date', value: input.period.from })
      conditions.push({ col: ref, op: 'lt', kind: 'date', value: nextDay(input.period.to) })
    }
  }

  // Filtros da tela ("contém"): só colunas que existem
  const filters: { col: { table: string; column: string }; value: string }[] = []
  for (const [key, val] of Object.entries(input.screenFilters || {})) {
    if (!val || !FILTER_KEY.test(key)) continue
    const table = key.includes('.') ? key.split('.')[0] : mainTable
    const column = key.includes('.') ? key.split('.')[1] : key
    if (columnExists(table, column)) filters.push({ col: { table, column }, value: String(val) })
  }

  // JOINs mínimos: só as tabelas citadas pelas condições e filtros
  const resolvedRelations = resolveRelations(input.relations || [], allModels)
  const preferred: Record<string, JoinStep[]> = {}
  for (const [tbl, sig] of Object.entries(widget.relation_paths || {})) {
    const hit = findAlternativePaths(resolvedRelations, mainTable, tbl).find(p => pathSignature(p) === sig)
    if (hit) preferred[tbl.toLowerCase()] = hit
  }
  const needed = [...new Set([...conditions.map(c => c.col.table), ...filters.map(f => f.col.table)].filter(t => t !== mainTable))]
  const steps = needed.length > 0 ? resolveAllJoins(resolvedRelations, mainTable, needed, preferred) : []
  const joined = new Set<string>([mainTable.toLowerCase()])
  steps.forEach(s => { joined.add(s.fromTable.toLowerCase()); joined.add(s.toTable.toLowerCase()) })
  const missing = needed.filter(t => !joined.has(t.toLowerCase()))
  if (missing.length > 0) return fail(`Sem relação entre ${mainTable} e ${missing.join(', ')}`)

  let where: string
  try {
    where = ['1=1', ...filters.map(f => filterConditionSql(dialect, f)), ...conditions.map(c => conditionSql(dialect, c))].join(' AND ')
  } catch (e: any) {
    return fail(e?.message || 'Filtro inválido')
  }

  const pk = getPkColumn(allModels, mainTable)
  const top = dialect === 'sqlserver' ? `TOP ${limit} ` : ''
  const order = pk && IDENT.test(pk) ? ` ORDER BY ${qCol(mainTable, pk)} DESC` : ''
  const tail = dialect === 'oracle' ? ` OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY` : dialect === 'sqlserver' ? '' : ` LIMIT ${limit}`

  // Com JOIN para outra tabela uma linha pode repetir: seleciona pelos ids das linhas que casam (sem duplicar)
  const sql = steps.length > 0 && pk && IDENT.test(pk)
    ? `SELECT ${top}* FROM ${Q(mainTable)} WHERE ${qCol(mainTable, pk)} IN (SELECT ${qCol(mainTable, pk)} FROM ${Q(mainTable)}${buildJoinSql(steps, undefined, Q)} WHERE ${where})${order}${tail}`
    : `SELECT ${top}* FROM ${Q(mainTable)}${steps.length > 0 ? buildJoinSql(steps, undefined, Q) : ''} WHERE ${where}${order}${tail}`

  return { kind: 'records', tableName: mainTable, schemaName, sql, limit }
}
