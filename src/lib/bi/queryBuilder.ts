/**
 * Construtor de SQL agregado dos widgets de BI.
 *
 * Em vez de buscar 1000 linhas cruas e agregar no navegador (resultado errado quando a tabela passa disso),
 * o SQL já faz o GROUP BY / SUM / COUNT no banco do cliente e devolve só as linhas do gráfico.
 *
 * Dialetos: PostgreSQL, Oracle, MySQL e SQL Server. No app em execução (túnel), o Agente CLI só executa PostgreSQL e
 * Oracle; MySQL e SQL Server servem ao app exportado, que conversa direto com o banco. Quando o construtor não
 * consegue montar o SQL (ok:false), quem chama usa o caminho antigo (linhas cruas).
 *
 * Multiplicação de linhas (fan-out): quando o valor vem só da tabela principal e há JOINs, o SQL deduplica por
 * chave primária (SELECT DISTINCT pk, grupo, valor) antes de agregar; senão um pedido com 3 itens seria somado 3 vezes.
 * COUNT sem campo conta registros distintos da tabela principal (COUNT DISTINCT pk), não linhas do JOIN.
 */
import { parseFormulaAst, type FormulaNode } from './safeFormula'

export type SqlDialect = 'postgres' | 'oracle' | 'mysql' | 'sqlserver'
export const SQL_DIALECTS: SqlDialect[] = ['postgres', 'oracle', 'mysql', 'sqlserver']

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

class Unsupported extends Error {}

function ident(id: string): string {
  if (!IDENT.test(id)) throw new Unsupported(`identificador inválido: ${id}`)
  return id
}

/**
 * Tudo o que muda de um banco para outro: aspas, conversão numérica, comparação de texto sem diferenciar
 * maiúsculas, datas, agrupamento por período e limite de linhas.
 */
interface Profile {
  quote(id: string): string
  /** literal de texto (MySQL escapa a barra invertida; SQL Server usa N'...' para unicode) */
  lit(v: string): string
  num(expr: string): string
  /** `expr LIKE padrão`, sem diferenciar maiúsculas */
  like(expr: string, pattern: string): string
  dateLit(v: string): string
  dayOf(expr: string): string
  groupDate(ref: string, granularity: string): string | null
  limit(n: number): string
  mod(a: string, b: string): string
  /** arredonda para inteiro (o SQL Server exige o segundo argumento) */
  round0(expr: string): string
  /** LEAST (min) ou GREATEST (max) de vários valores */
  extreme(kind: 'MIN' | 'MAX', args: string[]): string
  /** converte para número antes de dividir (divisão inteira em alguns bancos) */
  divNum(expr: string): string
}

const baseLit = (v: string) => `'${String(v).replace(/'/g, "''").replace(/\u0000/g, '')}'`
const dq = (id: string) => `"${id}"`

const PROFILES: Record<SqlDialect, Profile> = {
  postgres: {
    quote: dq,
    lit: baseLit,
    num: e => `CAST(${e} AS NUMERIC)`,
    like: (e, p) => `CAST(${e} AS TEXT) ILIKE ${baseLit(p)}`,
    dateLit: v => `CAST('${v}' AS TIMESTAMP)`,
    dayOf: e => `CAST(${e} AS DATE)`,
    groupDate: (ref, g) => {
      const ts = `CAST(${ref} AS TIMESTAMP)`
      const fmt = { day: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' }[g]
      if (fmt) return `TO_CHAR(${ts}, '${fmt}')`
      // semana e trimestre montados com || para não depender de literais entre aspas dentro do formato
      if (g === 'week') return `(TO_CHAR(${ts}, 'IYYY') || '-S' || TO_CHAR(${ts}, 'IW'))`
      if (g === 'quarter') return `(TO_CHAR(${ts}, 'YYYY') || '-T' || TO_CHAR(${ts}, 'Q'))`
      return null
    },
    limit: n => `LIMIT ${n}`,
    mod: (a, b) => `MOD(${a}, NULLIF(${b}, 0))`,
    round0: e => `ROUND(${e})`,
    extreme: (k, a) => `${k === 'MIN' ? 'LEAST' : 'GREATEST'}(${a.join(', ')})`,
    divNum: e => `CAST(${e} AS NUMERIC)`,
  },
  oracle: {
    quote: dq,
    lit: baseLit,
    num: e => `TO_NUMBER(${e})`,
    like: (e, p) => `UPPER(TO_CHAR(${e})) LIKE UPPER(${baseLit(p)})`,
    dateLit: v => `TO_DATE('${v}', 'YYYY-MM-DD')`,
    dayOf: e => `TRUNC(${e})`,
    groupDate: (ref, g) => {
      const fmt = { day: 'YYYY-MM-DD', month: 'YYYY-MM', year: 'YYYY' }[g]
      if (fmt) return `TO_CHAR(${ref}, '${fmt}')`
      if (g === 'week') return `(TO_CHAR(${ref}, 'IYYY') || '-S' || TO_CHAR(${ref}, 'IW'))`
      if (g === 'quarter') return `(TO_CHAR(${ref}, 'YYYY') || '-T' || TO_CHAR(${ref}, 'Q'))`
      return null
    },
    limit: n => `OFFSET 0 ROWS FETCH NEXT ${n} ROWS ONLY`,
    mod: (a, b) => `MOD(${a}, NULLIF(${b}, 0))`,
    round0: e => `ROUND(${e})`,
    extreme: (k, a) => `${k === 'MIN' ? 'LEAST' : 'GREATEST'}(${a.join(', ')})`,
    divNum: e => e,
  },
  mysql: {
    quote: id => `\`${id}\``,
    // no MySQL a barra invertida escapa o caractere seguinte: sem dobrá-la, um valor terminado em \ quebraria o literal
    lit: v => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\u0000/g, '')}'`,
    num: e => `CAST(${e} AS DECIMAL(38,10))`,
    like: (e, p) => `LOWER(CAST(${e} AS CHAR)) LIKE LOWER(${PROFILES.mysql.lit(p)})`,
    dateLit: v => `CAST('${v}' AS DATETIME)`,
    dayOf: e => `CAST(${e} AS DATE)`,
    groupDate: (ref, g) => {
      const fmt = { day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' }[g]
      if (fmt) return `DATE_FORMAT(${ref}, '${fmt}')`
      if (g === 'week') return `CONCAT(LEFT(YEARWEEK(${ref}, 3), 4), '-S', SUBSTRING(YEARWEEK(${ref}, 3), 5, 2))`
      if (g === 'quarter') return `CONCAT(YEAR(${ref}), '-T', QUARTER(${ref}))`
      return null
    },
    limit: n => `LIMIT ${n}`,
    mod: (a, b) => `MOD(${a}, NULLIF(${b}, 0))`,
    round0: e => `ROUND(${e})`,
    extreme: (k, a) => `${k === 'MIN' ? 'LEAST' : 'GREATEST'}(${a.join(', ')})`,
    divNum: e => `CAST(${e} AS DECIMAL(38,10))`,
  },
  sqlserver: {
    quote: id => `[${id}]`,
    lit: v => `N'${String(v).replace(/'/g, "''").replace(/\u0000/g, '')}'`,
    num: e => `CAST(${e} AS DECIMAL(38,10))`,
    like: (e, p) => `UPPER(CAST(${e} AS NVARCHAR(4000))) LIKE UPPER(${PROFILES.sqlserver.lit(p)})`,
    dateLit: v => `CAST('${v}' AS DATETIME2)`,
    dayOf: e => `CAST(${e} AS DATE)`,
    groupDate: (ref, g) => {
      if (g === 'day') return `CONVERT(VARCHAR(10), ${ref}, 23)`
      if (g === 'month') return `CONVERT(VARCHAR(7), ${ref}, 23)`
      if (g === 'year') return `CAST(YEAR(${ref}) AS VARCHAR(4))`
      // ano ISO da semana: o ano da quinta-feira daquela semana
      if (g === 'week') return `CONCAT(YEAR(DATEADD(DAY, 26 - DATEPART(ISO_WEEK, ${ref}), ${ref})), '-S', RIGHT(CONCAT('0', DATEPART(ISO_WEEK, ${ref})), 2))`
      if (g === 'quarter') return `CONCAT(YEAR(${ref}), '-T', DATEPART(QUARTER, ${ref}))`
      return null
    },
    // exige ORDER BY (o construtor sempre ordena quando há agrupamento)
    limit: n => `OFFSET 0 ROWS FETCH NEXT ${n} ROWS ONLY`,
    mod: (a, b) => `(${a} % NULLIF(${b}, 0))`,
    round0: e => `ROUND(${e}, 0)`,
    // LEAST/GREATEST só existem a partir do SQL Server 2022: CASE funciona em qualquer versão
    extreme: (k, a) => a.reduce((acc, x) => `(CASE WHEN ${acc} ${k === 'MIN' ? '<' : '>'} ${x} THEN ${acc} ELSE ${x} END)`),
    divNum: e => `CAST(${e} AS DECIMAL(38,10))`,
  },
}

/** Função que coloca um identificador entre aspas no dialeto (usada também para montar os JOINs). */
/**
 * Oracle guarda os nomes em MAIÚSCULAS e, entre aspas, diferencia a caixa. O Agente CLI converte os identificadores
 * entre aspas antes de executar; o app exportado (sem CLI) faz o mesmo com esta função. Não mexe em texto dentro de
 * literais ('...'), onde "palavra" é só um valor.
 */
export function oracleUpperIdentifiers(sql: string): string {
  return sql.replace(/('(?:[^']|'')*')|"([A-Za-z0-9_]+)"/g, (m, literal, ident) => (literal ? literal : `"${String(ident).toUpperCase()}"`))
}

export function quoteFor(dialect: SqlDialect): (id: string) => string {
  return PROFILES[dialect].quote
}

function refSql(P: Profile, c: BiColRef): string {
  return `${P.quote(ident(c.table))}.${P.quote(ident(c.column))}`
}

function formulaToSql(node: FormulaNode, P: Profile, mainTable: string, tables: Set<string>): string {
  switch (node.t) {
    case 'num': return String(node.v)
    case 'field': {
      const table = node.table || mainTable
      tables.add(table)
      return P.num(refSql(P, { table, column: node.name }))
    }
    case 'neg': return `(-${formulaToSql(node.a, P, mainTable, tables)})`
    case 'bin': {
      const a = formulaToSql(node.a, P, mainTable, tables)
      const b = formulaToSql(node.b, P, mainTable, tables)
      if (node.op === '/') return `(${a} / NULLIF(${b}, 0))`
      if (node.op === '%') return P.mod(a, b)
      return `(${a} ${node.op} ${b})`
    }
    case 'fn': {
      const args = node.args.map(a => formulaToSql(a, P, mainTable, tables))
      if (node.name === 'ABS' && args.length === 1) return `ABS(${args[0]})`
      if (node.name === 'ROUND') {
        const digits = node.args[1]
        if (args.length === 1) return P.round0(args[0])
        if (args.length === 2 && digits.t === 'num' && Number.isInteger(digits.v) && digits.v >= 0 && digits.v <= 10) return `ROUND(${args[0]}, ${digits.v})`
        throw new Unsupported('ROUND com casas dinâmicas')
      }
      if (node.name === 'MIN' || node.name === 'MAX') {
        if (args.length === 1) return args[0]
        return P.extreme(node.name, args)
      }
      throw new Unsupported(`função ${node.name}`)
    }
  }
}

function groupExpr(P: Profile, g: BiColRef, granularity?: string): string {
  const ref = refSql(P, g)
  if (!granularity) return ref
  return P.groupDate(ref, granularity) ?? ref
}

/** Condição de um filtro de tela (contém, sem diferenciar maiúsculas). */
export function filterConditionSql(dialect: SqlDialect | 'other', f: BiFilter): string {
  const P = PROFILES[dialect === 'other' ? 'postgres' : dialect]
  return P.like(refSql(P, f.col), `%${f.value}%`)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const NUM_RE = /^-?\d+(\.\d+)?$/

function valueLiteral(P: Profile, kind: BiColKind, raw: string | undefined): string {
  const v = String(raw ?? '').trim()
  if (kind === 'number') {
    if (!NUM_RE.test(v)) throw new Unsupported(`valor numérico inválido: ${v}`)
    return v
  }
  if (kind === 'date') {
    if (!DATE_RE.test(v)) throw new Unsupported(`data inválida: ${v}`)
    return P.dateLit(v)
  }
  return P.lit(v)
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
  const P = PROFILES[dialect]
  const ref = refSql(P, c.col)
  const val = (v: string | undefined) => valueLiteral(P, c.kind, v)
  switch (c.op) {
    case 'is_null': return `${ref} IS NULL`
    case 'not_null': return `${ref} IS NOT NULL`
    case 'contains': return P.like(ref, `%${c.value ?? ''}%`)
    case 'starts': return P.like(ref, `${c.value ?? ''}%`)
    case 'ends': return P.like(ref, `%${c.value ?? ''}`)
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
      if (c.kind === 'date') return `${P.dayOf(ref)} ${CMP[c.op]} ${val(c.value)}`
      return `${ref} ${CMP[c.op]} ${val(c.value)}`
    case 'gte': case 'lt':
      return `${ref} ${CMP[c.op]} ${val(c.value)}`
  }
  throw new Unsupported(`operador ${c.op}`)
}

export function whereSql(dialect: SqlDialect, filters: BiFilter[], conditions: BiCondition[] = []): string {
  return ['1=1', ...filters.map(f => filterConditionSql(dialect, f)), ...conditions.map(c => conditionSql(dialect, c))].join(' AND ')
}

const CALCS = ['COUNT', 'COUNT_DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX']

/** SELECT agregado de uma métrica (sem ORDER BY/LIMIT): colunas bi_name, [bi_series], bi_value. */
function metricSelect(input: BuildAggInput, m: BiMetric): { sql: string; grouped: boolean } {
  const { dialect, mainTable, joinSql } = input
  const P = PROFILES[dialect]
  const Q = P.quote
  const calc = String(m.calc || 'COUNT').toUpperCase()
  if (!CALCS.includes(calc)) throw new Unsupported(`operação ${calc}`)

  const main = Q(ident(mainTable))
  const pk = refSql(P, { table: mainTable, column: input.mainPk })
  const hasJoins = joinSql.trim().length > 0
  const from = `FROM ${main}${joinSql}`
  const where = whereSql(dialect, input.filters, input.conditions)

  // valor
  const valueTables = new Set<string>()
  let valueSql: string | null = null
  if (m.formula) {
    const ast = parseFormulaAst(m.formula)
    if (!ast) throw new Unsupported('fórmula inválida')
    valueSql = formulaToSql(ast, P, mainTable, valueTables)
  } else if (m.field) {
    valueTables.add(m.field.table)
    valueSql = P.num(refSql(P, m.field))
  }

  let aggExpr: string
  let dedupe = false
  if (calc === 'COUNT') {
    // sem campo (ou com campo da tabela principal) conta registros distintos da principal
    const fieldOnJoined = !m.formula && m.field && m.field.table !== mainTable
    aggExpr = fieldOnJoined ? `COUNT(${refSql(P, m.field!)})` : hasJoins ? `COUNT(DISTINCT ${pk})` : 'COUNT(*)'
  } else if (calc === 'COUNT_DISTINCT') {
    if (m.formula || !m.field) throw new Unsupported('contagem distinta exige um campo')
    aggExpr = `COUNT(DISTINCT ${refSql(P, m.field)})`
  } else {
    if (!valueSql) throw new Unsupported(`${calc} exige um campo ou fórmula`)
    dedupe = hasJoins && [...valueTables].every(t => t === mainTable)
    aggExpr = `${calc}(${dedupe ? Q('bi_v') : valueSql})`
  }

  // dimensões: expressão de exibição primeiro e, para chave estrangeira, a chave do registro depois
  const gExprs: string[] = !input.groupBy ? [] : input.groupLabel
    ? [refSql(P, input.groupLabel.label), refSql(P, input.groupLabel.key)]
    : [groupExpr(P, input.groupBy, input.granularity)]
  const sExprs: string[] = gExprs.length === 0 || !input.series ? [] : input.seriesLabel
    ? [refSql(P, input.seriesLabel.label), refSql(P, input.seriesLabel.key)]
    : [refSql(P, input.series)]

  if (gExprs.length === 0) {
    const sql = dedupe
      ? `SELECT ${aggExpr} AS ${Q('bi_value')} FROM (SELECT DISTINCT ${pk} AS ${Q('bi_pk')}, ${valueSql} AS ${Q('bi_v')} ${from} WHERE ${where}) bi_sub`
      : `SELECT ${aggExpr} AS ${Q('bi_value')} ${from} WHERE ${where}`
    return { sql, grouped: false }
  }
  if (dedupe) {
    const gAl = ['bi_g', 'bi_gk']
    const sAl = ['bi_s', 'bi_sk']
    const inner = [
      `${pk} AS ${Q('bi_pk')}`,
      ...gExprs.map((e, i) => `${e} AS ${Q(gAl[i])}`),
      ...sExprs.map((e, i) => `${e} AS ${Q(sAl[i])}`),
      `${valueSql} AS ${Q('bi_v')}`,
    ].join(', ')
    const cols = sExprs.length ? `${Q('bi_g')} AS ${Q('bi_name')}, ${Q('bi_s')} AS ${Q('bi_series')}` : `${Q('bi_g')} AS ${Q('bi_name')}`
    const keys = [...gAl.slice(0, gExprs.length), ...sAl.slice(0, sExprs.length)].map(a => Q(a)).join(', ')
    return { sql: `SELECT ${cols}, ${aggExpr} AS ${Q('bi_value')} FROM (SELECT DISTINCT ${inner} ${from} WHERE ${where}) bi_sub GROUP BY ${keys}`, grouped: true }
  }
  const cols = sExprs.length ? `${gExprs[0]} AS ${Q('bi_name')}, ${sExprs[0]} AS ${Q('bi_series')}` : `${gExprs[0]} AS ${Q('bi_name')}`
  const keys = [...gExprs, ...sExprs].join(', ')
  return { sql: `SELECT ${cols}, ${aggExpr} AS ${Q('bi_value')} ${from} WHERE ${where} GROUP BY ${keys}`, grouped: true }
}

export function buildAggregateQuery(input: BuildAggInput): BuildAggResult {
  try {
    const { dialect } = input
    const P = PROFILES[dialect]
    if (!P) return { ok: false, reason: `dialeto ${dialect}` }
    const Q = P.quote
    const num = metricSelect(input, { calc: input.calc, formula: input.formula, field: input.field })
    const grouped = num.grouped
    const hasSeries = grouped && !!input.series
    const orders: Record<string, string> = {
      value_desc: `${Q('bi_value')} DESC`,
      value_asc: `${Q('bi_value')} ASC`,
      label_asc: `${Q('bi_name')} ASC`,
      label_desc: `${Q('bi_name')} DESC`,
    }
    const order = orders[input.sortBy || 'value_desc'] || orders.value_desc
    // com série, o corte Top N é feito no navegador (por total do grupo); aqui só o teto de linhas
    const cap = hasSeries ? Math.max(input.maxGroups ?? 2000, 2000) * 5 : (input.limitTopN && input.limitTopN > 0 ? input.limitTopN : (input.maxGroups ?? 2000))
    const lim = P.limit(Math.max(1, Math.trunc(cap)))

    if (!input.divideBy) {
      if (!grouped) return { ok: true, sql: num.sql, grouped: false }
      return { ok: true, sql: `${num.sql} ORDER BY ${order} ${lim}`, grouped: true, series: hasSeries }
    }

    // métrica derivada: duas agregações (cada uma com sua própria deduplicação) combinadas por grupo
    const den = metricSelect(input, input.divideBy)
    const bv = `${Q('bi_value')}`
    if (!grouped) {
      return { ok: true, grouped: false, sql: `SELECT ${P.divNum(`n.${bv}`)} / NULLIF(d.${bv}, 0) AS ${bv} FROM (${num.sql}) n CROSS JOIN (${den.sql}) d` }
    }
    const same = (col: string) => `(n.${Q(col)} = d.${Q(col)} OR (n.${Q(col)} IS NULL AND d.${Q(col)} IS NULL))`
    const on = hasSeries ? `${same('bi_name')} AND ${same('bi_series')}` : same('bi_name')
    const cols = hasSeries ? `n.${Q('bi_name')} AS ${Q('bi_name')}, n.${Q('bi_series')} AS ${Q('bi_series')}` : `n.${Q('bi_name')} AS ${Q('bi_name')}`
    return {
      ok: true, grouped: true, series: hasSeries,
      sql: `SELECT ${cols}, ${P.divNum(`n.${bv}`)} / NULLIF(d.${bv}, 0) AS ${bv} FROM (${num.sql}) n LEFT JOIN (${den.sql}) d ON ${on} ORDER BY ${order} ${lim}`,
    }
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'não suportado' }
  }
}
