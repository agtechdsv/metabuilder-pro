/**
 * Construtor de SQL agregado dos widgets de BI.
 *
 * Em vez de buscar 1000 linhas cruas e agregar no navegador (resultado errado quando a tabela passa disso),
 * o SQL já faz o GROUP BY / SUM / COUNT no banco do cliente e devolve só as linhas do gráfico.
 *
 * Dialetos: PostgreSQL e Oracle (os que o Agente CLI executa hoje). Para qualquer outro, retorna ok:false
 * e quem chama usa o caminho antigo (linhas cruas).
 *
 * Multiplicação de linhas (fan-out): quando o valor vem só da tabela principal e há JOINs, o SQL deduplica por
 * chave primária (SELECT DISTINCT pk, grupo, valor) antes de agregar; senão um pedido com 3 itens seria somado 3 vezes.
 * COUNT sem campo conta registros distintos da tabela principal (COUNT DISTINCT pk), não linhas do JOIN.
 */
import { parseFormulaAst, type FormulaNode } from './safeFormula'

export type SqlDialect = 'postgres' | 'oracle'

export interface BiColRef { table: string; column: string }
export interface BiFilter { col: BiColRef; value: string }

export type BiConditionOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'starts' | 'ends' | 'in' | 'between' | 'is_null' | 'not_null'
export type BiColKind = 'text' | 'number' | 'date'
/** Filtro configurado no widget (com operador), diferente do filtro de tela que é sempre "contém". */
export interface BiCondition { col: BiColRef; op: BiConditionOp; kind: BiColKind; value?: string; value2?: string }
/** Métrica usada como denominador de uma métrica derivada (ex.: ticket médio = SUM(valor) ÷ COUNT de pedidos). */
export interface BiMetric { calc: string; formula?: string | null; field?: BiColRef | null }

export interface BuildAggInput {
  dialect: SqlDialect
  mainTable: string
  mainPk: string
  /** JOINs já resolvidos (ex.: ` LEFT JOIN "itens_pedido" ON ...`), ou '' */
  joinSql: string
  calc: string
  /** fórmula (texto) como "itens_pedido.preco_unitario * itens_pedido.quantidade" */
  formula?: string | null
  /** campo simples do valor */
  field?: BiColRef | null
  groupBy?: BiColRef | null
  granularity?: string
  sortBy?: string
  limitTopN?: number
  filters: BiFilter[]
  /** filtros do widget e do período global */
  conditions?: BiCondition[]
  /** segunda dimensão (série): uma coluna a mais no resultado (bi_series) */
  series?: BiColRef | null
  /** métrica derivada: o valor final é (métrica principal) ÷ (esta métrica) */
  divideBy?: BiMetric | null
  /**
   * Quando o agrupamento (ou a série) é uma chave estrangeira, mostra o nome do registro relacionado em vez do UUID:
   * agrupa pela chave do registro e exibe o rótulo (dois registros com o mesmo nome continuam separados).
   */
  groupLabel?: { label: BiColRef; key: BiColRef } | null
  seriesLabel?: { label: BiColRef; key: BiColRef } | null
  /** teto de grupos quando não há Top N */
  maxGroups?: number
}

export type BuildAggResult = { ok: true; sql: string; grouped: boolean; series?: boolean } | { ok: false; reason: string }

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const q = (id: string) => `"${id}"`
const lit = (v: string) => `'${String(v).replace(/'/g, "''").replace(/\u0000/g, '')}'`

class Unsupported extends Error {}

function ident(id: string): string {
  if (!IDENT.test(id)) throw new Unsupported(`identificador inválido: ${id}`)
  return id
}

function refSql(c: BiColRef): string {
  return `${q(ident(c.table))}.${q(ident(c.column))}`
}

function numSql(dialect: SqlDialect, expr: string): string {
  return dialect === 'oracle' ? `TO_NUMBER(${expr})` : `CAST(${expr} AS NUMERIC)`
}

function formulaToSql(node: FormulaNode, dialect: SqlDialect, mainTable: string, tables: Set<string>): string {
  switch (node.t) {
    case 'num': return String(node.v)
    case 'field': {
      const table = node.table || mainTable
      tables.add(table)
      return numSql(dialect, refSql({ table, column: node.name }))
    }
    case 'neg': return `(-${formulaToSql(node.a, dialect, mainTable, tables)})`
    case 'bin': {
      const a = formulaToSql(node.a, dialect, mainTable, tables)
      const b = formulaToSql(node.b, dialect, mainTable, tables)
      if (node.op === '/') return `(${a} / NULLIF(${b}, 0))`
      if (node.op === '%') return `MOD(${a}, NULLIF(${b}, 0))`
      return `(${a} ${node.op} ${b})`
    }
    case 'fn': {
      const args = node.args.map(a => formulaToSql(a, dialect, mainTable, tables))
      if (node.name === 'ABS' && args.length === 1) return `ABS(${args[0]})`
      if (node.name === 'ROUND') {
        const digits = node.args[1]
        if (args.length === 1) return `ROUND(${args[0]})`
        if (args.length === 2 && digits.t === 'num' && Number.isInteger(digits.v) && digits.v >= 0 && digits.v <= 10) return `ROUND(${args[0]}, ${digits.v})`
        throw new Unsupported('ROUND com casas dinâmicas')
      }
      if (node.name === 'MIN' || node.name === 'MAX') {
        if (args.length === 1) return args[0]
        return `${node.name === 'MIN' ? 'LEAST' : 'GREATEST'}(${args.join(', ')})`
      }
      throw new Unsupported(`função ${node.name}`)
    }
  }
}

const DATE_FORMATS: Record<string, string> = { day: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' }

function groupExpr(dialect: SqlDialect, g: BiColRef, granularity?: string): string {
  const ref = refSql(g)
  if (!granularity) return ref
  const ts = dialect === 'oracle' ? ref : `CAST(${ref} AS TIMESTAMP)`
  const fmt = DATE_FORMATS[granularity]
  if (fmt) return `TO_CHAR(${ts}, '${fmt}')`
  // semana e trimestre montados com || para não depender de literais entre aspas dentro do formato
  if (granularity === 'week') return `(TO_CHAR(${ts}, 'IYYY') || '-S' || TO_CHAR(${ts}, 'IW'))`
  if (granularity === 'quarter') return `(TO_CHAR(${ts}, 'YYYY') || '-T' || TO_CHAR(${ts}, 'Q'))`
  return ref
}

/** Condição de um filtro de tela (contém, sem diferenciar maiúsculas). */
export function filterConditionSql(dialect: SqlDialect | 'other', f: BiFilter): string {
  const ref = refSql(f.col)
  const like = `%${f.value}%`
  return dialect === 'oracle'
    ? `UPPER(TO_CHAR(${ref})) LIKE UPPER(${lit(like)})`
    : `CAST(${ref} AS TEXT) ILIKE ${lit(like)}`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const NUM_RE = /^-?\d+(\.\d+)?$/

function valueLiteral(dialect: SqlDialect, kind: BiColKind, raw: string | undefined): string {
  const v = String(raw ?? '').trim()
  if (kind === 'number') {
    if (!NUM_RE.test(v)) throw new Unsupported(`valor numérico inválido: ${v}`)
    return v
  }
  if (kind === 'date') {
    if (!DATE_RE.test(v)) throw new Unsupported(`data inválida: ${v}`)
    return dialect === 'oracle' ? `TO_DATE('${v}', 'YYYY-MM-DD')` : `CAST('${v}' AS TIMESTAMP)`
  }
  return lit(v)
}

/** Dia seguinte (YYYY-MM-DD), em UTC para não depender do fuso. Valor inválido deixa passar para a validação do literal. */
function nextDay(v: string | undefined): string {
  const s = String(v ?? '').trim()
  if (!DATE_RE.test(s)) return s
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

const CMP: Record<string, string> = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }

/** Condição com operador (filtro do widget ou período). Lança Unsupported se o valor não combina com o tipo da coluna. */
export function conditionSql(dialect: SqlDialect, c: BiCondition): string {
  const ref = refSql(c.col)
  const text = dialect === 'oracle' ? `UPPER(TO_CHAR(${ref}))` : `CAST(${ref} AS TEXT)`
  const ci = (v: string) => (dialect === 'oracle' ? `UPPER(${lit(v)})` : lit(v))
  const like = dialect === 'oracle' ? 'LIKE' : 'ILIKE'
  const val = (v: string | undefined) => valueLiteral(dialect, c.kind, v)
  switch (c.op) {
    case 'is_null': return `${ref} IS NULL`
    case 'not_null': return `${ref} IS NOT NULL`
    case 'contains': return `${text} ${like} ${ci(`%${c.value ?? ''}%`)}`
    case 'starts': return `${text} ${like} ${ci(`${c.value ?? ''}%`)}`
    case 'ends': return `${text} ${like} ${ci(`%${c.value ?? ''}`)}`
    case 'in': {
      const items = String(c.value ?? '').split(',').map(x => x.trim()).filter(Boolean)
      if (items.length === 0) throw new Unsupported('lista vazia')
      return `${ref} IN (${items.map(x => val(x)).join(', ')})`
    }
    case 'between':
      // data: o dia final entra inteiro (a coluna pode ter hora): >= início E < dia seguinte ao fim
      if (c.kind === 'date') return `(${ref} >= ${val(c.value)} AND ${ref} < ${val(nextDay(c.value2))})`
      return `${ref} BETWEEN ${val(c.value)} AND ${val(c.value2)}`
    case 'lte':
      if (c.kind === 'date') return `${ref} < ${val(nextDay(c.value))}`
      return `${ref} <= ${val(c.value)}`
    case 'gt':
      if (c.kind === 'date') return `${ref} >= ${val(nextDay(c.value))}`
      return `${ref} > ${val(c.value)}`
    case 'eq':
    case 'ne':
      if (c.kind === 'date') {
        const day = dialect === 'oracle' ? `TRUNC(${ref})` : `CAST(${ref} AS DATE)`
        return `${day} ${CMP[c.op]} ${val(c.value)}`
      }
      return `${ref} ${CMP[c.op]} ${val(c.value)}`
    case 'gte': case 'lt':
      return `${ref} ${CMP[c.op]} ${val(c.value)}`
  }
  throw new Unsupported(`operador ${c.op}`)
}

export function whereSql(dialect: SqlDialect, filters: BiFilter[], conditions: BiCondition[] = []): string {
  return ['1=1', ...filters.map(f => filterConditionSql(dialect, f)), ...conditions.map(c => conditionSql(dialect, c))].join(' AND ')
}

function limitSql(dialect: SqlDialect, n: number): string {
  const safe = Math.max(1, Math.trunc(n))
  return dialect === 'oracle' ? `OFFSET 0 ROWS FETCH NEXT ${safe} ROWS ONLY` : `LIMIT ${safe}`
}

const ORDER: Record<string, string> = {
  value_desc: '"bi_value" DESC',
  value_asc: '"bi_value" ASC',
  label_asc: '"bi_name" ASC',
  label_desc: '"bi_name" DESC',
}

const CALCS = ['COUNT', 'COUNT_DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX']

/** SELECT agregado de uma métrica (sem ORDER BY/LIMIT): colunas bi_name, [bi_series], bi_value. */
function metricSelect(input: BuildAggInput, m: BiMetric): { sql: string; grouped: boolean } {
  const { dialect, mainTable, joinSql } = input
  const calc = String(m.calc || 'COUNT').toUpperCase()
  if (!CALCS.includes(calc)) throw new Unsupported(`operação ${calc}`)

  const main = q(ident(mainTable))
  const pk = refSql({ table: mainTable, column: input.mainPk })
  const hasJoins = joinSql.trim().length > 0
  const from = `FROM ${main}${joinSql}`
  const where = whereSql(dialect, input.filters, input.conditions)

  // valor
  const valueTables = new Set<string>()
  let valueSql: string | null = null
  if (m.formula) {
    const ast = parseFormulaAst(m.formula)
    if (!ast) throw new Unsupported('fórmula inválida')
    valueSql = formulaToSql(ast, dialect, mainTable, valueTables)
  } else if (m.field) {
    valueTables.add(m.field.table)
    valueSql = numSql(dialect, refSql(m.field))
  }

  let aggExpr: string
  let dedupe = false
  if (calc === 'COUNT') {
    // sem campo (ou com campo da tabela principal) conta registros distintos da principal
    const fieldOnJoined = !m.formula && m.field && m.field.table !== mainTable
    aggExpr = fieldOnJoined ? `COUNT(${refSql(m.field!)})` : hasJoins ? `COUNT(DISTINCT ${pk})` : 'COUNT(*)'
  } else if (calc === 'COUNT_DISTINCT') {
    if (m.formula || !m.field) throw new Unsupported('contagem distinta exige um campo')
    aggExpr = `COUNT(DISTINCT ${refSql(m.field)})`
  } else {
    if (!valueSql) throw new Unsupported(`${calc} exige um campo ou fórmula`)
    dedupe = hasJoins && [...valueTables].every(t => t === mainTable)
    aggExpr = `${calc}(${dedupe ? '"bi_v"' : valueSql})`
  }

  // dimensões: expressão de exibição primeiro e, para chave estrangeira, a chave do registro depois
  const gExprs: string[] = !input.groupBy ? [] : input.groupLabel
    ? [refSql(input.groupLabel.label), refSql(input.groupLabel.key)]
    : [groupExpr(dialect, input.groupBy, input.granularity)]
  const sExprs: string[] = gExprs.length === 0 || !input.series ? [] : input.seriesLabel
    ? [refSql(input.seriesLabel.label), refSql(input.seriesLabel.key)]
    : [refSql(input.series)]

  if (gExprs.length === 0) {
    const sql = dedupe
      ? `SELECT ${aggExpr} AS "bi_value" FROM (SELECT DISTINCT ${pk} AS "bi_pk", ${valueSql} AS "bi_v" ${from} WHERE ${where}) bi_sub`
      : `SELECT ${aggExpr} AS "bi_value" ${from} WHERE ${where}`
    return { sql, grouped: false }
  }
  if (dedupe) {
    const gAl = ['bi_g', 'bi_gk']
    const sAl = ['bi_s', 'bi_sk']
    const inner = [
      `${pk} AS "bi_pk"`,
      ...gExprs.map((e, i) => `${e} AS "${gAl[i]}"`),
      ...sExprs.map((e, i) => `${e} AS "${sAl[i]}"`),
      `${valueSql} AS "bi_v"`,
    ].join(', ')
    const cols = sExprs.length ? `"bi_g" AS "bi_name", "bi_s" AS "bi_series"` : `"bi_g" AS "bi_name"`
    const keys = [...gAl.slice(0, gExprs.length), ...sAl.slice(0, sExprs.length)].map(a => `"${a}"`).join(', ')
    return { sql: `SELECT ${cols}, ${aggExpr} AS "bi_value" FROM (SELECT DISTINCT ${inner} ${from} WHERE ${where}) bi_sub GROUP BY ${keys}`, grouped: true }
  }
  const cols = sExprs.length ? `${gExprs[0]} AS "bi_name", ${sExprs[0]} AS "bi_series"` : `${gExprs[0]} AS "bi_name"`
  const keys = [...gExprs, ...sExprs].join(', ')
  return { sql: `SELECT ${cols}, ${aggExpr} AS "bi_value" ${from} WHERE ${where} GROUP BY ${keys}`, grouped: true }
}

export function buildAggregateQuery(input: BuildAggInput): BuildAggResult {
  try {
    const { dialect } = input
    const num = metricSelect(input, { calc: input.calc, formula: input.formula, field: input.field })
    const grouped = num.grouped
    const hasSeries = grouped && !!input.series
    const order = ORDER[input.sortBy || 'value_desc'] || ORDER.value_desc
    // com série, o corte Top N é feito no navegador (por total do grupo); aqui só o teto de linhas
    const cap = hasSeries ? Math.max(input.maxGroups ?? 2000, 2000) * 5 : (input.limitTopN && input.limitTopN > 0 ? input.limitTopN : (input.maxGroups ?? 2000))
    const lim = limitSql(dialect, cap)

    if (!input.divideBy) {
      if (!grouped) return { ok: true, sql: num.sql, grouped: false }
      return { ok: true, sql: `${num.sql} ORDER BY ${order} ${lim}`, grouped: true, series: hasSeries }
    }

    // métrica derivada: duas agregações (cada uma com sua própria deduplicação) combinadas por grupo
    const den = metricSelect(input, input.divideBy)
    const asNum = (e: string) => (dialect === 'oracle' ? e : `CAST(${e} AS NUMERIC)`)
    if (!grouped) {
      return { ok: true, grouped: false, sql: `SELECT ${asNum('n."bi_value"')} / NULLIF(d."bi_value", 0) AS "bi_value" FROM (${num.sql}) n CROSS JOIN (${den.sql}) d` }
    }
    const same = (col: string) => `(n."${col}" = d."${col}" OR (n."${col}" IS NULL AND d."${col}" IS NULL))`
    const on = hasSeries ? `${same('bi_name')} AND ${same('bi_series')}` : same('bi_name')
    const cols = hasSeries ? 'n."bi_name" AS "bi_name", n."bi_series" AS "bi_series"' : 'n."bi_name" AS "bi_name"'
    return {
      ok: true, grouped: true, series: hasSeries,
      sql: `SELECT ${cols}, ${asNum('n."bi_value"')} / NULLIF(d."bi_value", 0) AS "bi_value" FROM (${num.sql}) n LEFT JOIN (${den.sql}) d ON ${on} ORDER BY ${order} ${lim}`,
    }
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'não suportado' }
  }
}
