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
  /** teto de grupos quando não há Top N */
  maxGroups?: number
}

export type BuildAggResult = { ok: true; sql: string; grouped: boolean } | { ok: false; reason: string }

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
  const fmt = granularity ? DATE_FORMATS[granularity] : undefined
  if (!fmt) return ref
  return dialect === 'oracle' ? `TO_CHAR(${ref}, '${fmt}')` : `TO_CHAR(CAST(${ref} AS TIMESTAMP), '${fmt}')`
}

/** Condição de um filtro de tela (contém, sem diferenciar maiúsculas). */
export function filterConditionSql(dialect: SqlDialect | 'other', f: BiFilter): string {
  const ref = refSql(f.col)
  const like = `%${f.value}%`
  return dialect === 'oracle'
    ? `UPPER(TO_CHAR(${ref})) LIKE UPPER(${lit(like)})`
    : `CAST(${ref} AS TEXT) ILIKE ${lit(like)}`
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

export function buildAggregateQuery(input: BuildAggInput): BuildAggResult {
  try {
    const { dialect, mainTable, joinSql } = input
    const calc = String(input.calc || 'COUNT').toUpperCase()
    if (!['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(calc)) return { ok: false, reason: `operação ${calc}` }

    const main = q(ident(mainTable))
    const pk = refSql({ table: mainTable, column: input.mainPk })
    const hasJoins = joinSql.trim().length > 0
    const from = `FROM ${main}${joinSql}`
    const where = ['1=1', ...input.filters.map(f => filterConditionSql(dialect, f))].join(' AND ')

    // valor
    const valueTables = new Set<string>()
    let valueSql: string | null = null
    if (input.formula) {
      const ast = parseFormulaAst(input.formula)
      if (!ast) return { ok: false, reason: 'fórmula inválida' }
      valueSql = formulaToSql(ast, dialect, mainTable, valueTables)
    } else if (input.field) {
      valueTables.add(input.field.table)
      valueSql = numSql(dialect, refSql(input.field))
    }

    // COUNT: sem campo (ou com campo da tabela principal) conta registros distintos da principal
    let aggExpr: string
    let dedupe = false
    if (calc === 'COUNT') {
      const fieldOnJoined = !input.formula && input.field && input.field.table !== mainTable
      aggExpr = fieldOnJoined ? `COUNT(${refSql(input.field!)})` : hasJoins ? `COUNT(DISTINCT ${pk})` : 'COUNT(*)'
    } else {
      if (!valueSql) return { ok: false, reason: `${calc} exige um campo ou fórmula` }
      dedupe = hasJoins && [...valueTables].every(t => t === mainTable)
      aggExpr = `${calc}(${dedupe ? '"bi_v"' : valueSql})`
    }

    if (!input.groupBy) {
      const sql = dedupe
        ? `SELECT ${aggExpr} AS "bi_value" FROM (SELECT DISTINCT ${pk} AS "bi_pk", ${valueSql} AS "bi_v" ${from} WHERE ${where}) bi_sub`
        : `SELECT ${aggExpr} AS "bi_value" ${from} WHERE ${where}`
      return { ok: true, sql, grouped: false }
    }

    const g = groupExpr(dialect, input.groupBy, input.granularity)
    const order = ORDER[input.sortBy || 'value_desc'] || ORDER.value_desc
    const limit = limitSql(dialect, input.limitTopN && input.limitTopN > 0 ? input.limitTopN : (input.maxGroups ?? 2000))
    const sql = dedupe
      ? `SELECT "bi_g" AS "bi_name", ${aggExpr} AS "bi_value" FROM (SELECT DISTINCT ${pk} AS "bi_pk", ${g} AS "bi_g", ${valueSql} AS "bi_v" ${from} WHERE ${where}) bi_sub GROUP BY "bi_g" ORDER BY ${order} ${limit}`
      : `SELECT ${g} AS "bi_name", ${aggExpr} AS "bi_value" ${from} WHERE ${where} GROUP BY ${g} ORDER BY ${order} ${limit}`
    return { ok: true, sql, grouped: true }
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'não suportado' }
  }
}
