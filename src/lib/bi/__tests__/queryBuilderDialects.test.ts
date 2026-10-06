import { describe, it, expect } from 'vitest'
import { buildAggregateQuery, conditionSql, filterConditionSql, quoteFor, SQL_DIALECTS, type BuildAggInput, type BiCondition } from '../queryBuilder'

const base = (dialect: BuildAggInput['dialect'], extra: Partial<BuildAggInput> = {}): BuildAggInput => ({
  dialect, mainTable: 'pedidos', mainPk: 'id', joinSql: '', calc: 'SUM',
  field: { table: 'pedidos', column: 'valor_total' }, filters: [], ...extra,
})
const sql = (dialect: BuildAggInput['dialect'], extra: Partial<BuildAggInput> = {}) => {
  const r = buildAggregateQuery(base(dialect, extra))
  if (!r.ok) throw new Error(r.reason)
  return r.sql
}
const status = { table: 'pedidos', column: 'status' }
const data = { table: 'pedidos', column: 'data' }
const cond = (o: Partial<BiCondition>): BiCondition => ({ col: status, op: 'eq', kind: 'text', value: 'x', ...o })

describe('MySQL', () => {
  it('aspas com crase, DECIMAL e LIMIT', () => {
    expect(sql('mysql')).toBe('SELECT SUM(CAST(`pedidos`.`valor_total` AS DECIMAL(38,10))) AS `bi_value` FROM `pedidos` WHERE 1=1')
    expect(sql('mysql', { groupBy: status, limitTopN: 5 })).toContain('GROUP BY `pedidos`.`status` ORDER BY `bi_value` DESC LIMIT 5')
  })
  it('granularidades de data', () => {
    expect(sql('mysql', { groupBy: data, granularity: 'month' })).toContain("DATE_FORMAT(`pedidos`.`data`, '%Y-%m')")
    expect(sql('mysql', { groupBy: data, granularity: 'day' })).toContain("'%Y-%m-%d'")
    expect(sql('mysql', { groupBy: data, granularity: 'year' })).toContain("'%Y'")
    expect(sql('mysql', { groupBy: data, granularity: 'week' })).toContain('YEARWEEK(`pedidos`.`data`, 3)')
    expect(sql('mysql', { groupBy: data, granularity: 'quarter' })).toContain("CONCAT(YEAR(`pedidos`.`data`), '-T', QUARTER(`pedidos`.`data`))")
  })
  it('texto sem diferenciar maiúsculas e barra invertida escapada (evita quebrar o literal)', () => {
    expect(filterConditionSql('mysql', { col: status, value: 'ab' })).toBe("LOWER(CAST(`pedidos`.`status` AS CHAR)) LIKE LOWER('%ab%')")
    expect(conditionSql('mysql', cond({ op: 'eq', value: 'a\\' }))).toBe("`pedidos`.`status` = 'a\\\\'")
    expect(conditionSql('mysql', cond({ op: 'eq', value: "o'b" }))).toBe("`pedidos`.`status` = 'o''b'")
  })
  it('datas e igualdade por dia', () => {
    expect(conditionSql('mysql', cond({ kind: 'date', op: 'gte', value: '2026-01-01' }))).toContain("CAST('2026-01-01' AS DATETIME)")
    expect(conditionSql('mysql', cond({ kind: 'date', op: 'eq', value: '2026-01-01' }))).toContain('CAST(`pedidos`.`status` AS DATE)')
    expect(conditionSql('mysql', cond({ kind: 'date', op: 'lte', value: '2026-03-31' }))).toContain("'2026-04-01'")
  })
  it('fórmula com módulo e MIN/MAX de vários valores', () => {
    const q = sql('mysql', { field: null, formula: 'MAX(a, b) % 3' })
    expect(q).toContain('GREATEST(')
    expect(q).toContain('MOD(')
  })
})

describe('SQL Server', () => {
  it('colchetes, DECIMAL e FETCH NEXT (precisa de ORDER BY)', () => {
    expect(sql('sqlserver')).toBe('SELECT SUM(CAST([pedidos].[valor_total] AS DECIMAL(38,10))) AS [bi_value] FROM [pedidos] WHERE 1=1')
    const q = sql('sqlserver', { groupBy: status, limitTopN: 5 })
    expect(q).toContain('ORDER BY [bi_value] DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY')
    expect(q).not.toMatch(/ LIMIT /)
  })
  it('granularidades de data', () => {
    expect(sql('sqlserver', { groupBy: data, granularity: 'month' })).toContain('CONVERT(VARCHAR(7), [pedidos].[data], 23)')
    expect(sql('sqlserver', { groupBy: data, granularity: 'day' })).toContain('CONVERT(VARCHAR(10), [pedidos].[data], 23)')
    expect(sql('sqlserver', { groupBy: data, granularity: 'year' })).toContain('CAST(YEAR([pedidos].[data]) AS VARCHAR(4))')
    expect(sql('sqlserver', { groupBy: data, granularity: 'week' })).toContain('DATEPART(ISO_WEEK, [pedidos].[data])')
    expect(sql('sqlserver', { groupBy: data, granularity: 'quarter' })).toContain('DATEPART(QUARTER, [pedidos].[data])')
  })
  it('texto com N prefixado, UPPER e valores sem injeção', () => {
    expect(filterConditionSql('sqlserver', { col: status, value: 'ab' })).toBe("UPPER(CAST([pedidos].[status] AS NVARCHAR(4000))) LIKE UPPER(N'%ab%')")
    expect(conditionSql('sqlserver', cond({ op: 'eq', value: "o'b" }))).toBe("[pedidos].[status] = N'o''b'")
  })
  it('datas em DATETIME2 e igualdade por dia', () => {
    expect(conditionSql('sqlserver', cond({ kind: 'date', op: 'gte', value: '2026-01-01' }))).toContain("CAST('2026-01-01' AS DATETIME2)")
    expect(conditionSql('sqlserver', cond({ kind: 'date', op: 'between', value: '2026-01-01', value2: '2026-03-31' }))).toContain("'2026-04-01'")
  })
  it('sem LEAST/GREATEST (versões antigas): usa CASE; módulo com %; ROUND com 2 argumentos', () => {
    const q = sql('sqlserver', { field: null, formula: 'MIN(a, b) % 3 + ROUND(a)' })
    expect(q).toContain('CASE WHEN')
    expect(q).not.toContain('LEAST')
    expect(q).toContain('% NULLIF(3, 0)')
    expect(q).toContain(', 0)')
  })
  it('métrica derivada: converte para decimal antes de dividir (evita divisão inteira)', () => {
    const q = sql('sqlserver', { calc: 'COUNT', field: null, divideBy: { calc: 'COUNT' } })
    expect(q).toContain('CAST(n.[bi_value] AS DECIMAL(38,10)) / NULLIF(d.[bi_value], 0)')
  })
  it('agrupado com dedupe por JOIN usa os mesmos aliases entre colchetes', () => {
    const join = ' LEFT JOIN [itens] ON [pedidos].[id] = [itens].[pedido_id]'
    const q = sql('sqlserver', { joinSql: join, groupBy: { table: 'itens', column: 'produto_id' } })
    expect(q).toContain('SELECT DISTINCT [pedidos].[id] AS [bi_pk]')
    expect(q).toContain('GROUP BY [bi_g]')
  })
})

describe('todos os dialetos', () => {
  it.each(SQL_DIALECTS)('%s recusa identificador inválido (injeção)', (d) => {
    expect(buildAggregateQuery(base(d, { field: { table: 'pedidos', column: 'x"; DROP TABLE y;--' } })).ok).toBe(false)
    expect(buildAggregateQuery(base(d, { mainTable: 'a b' })).ok).toBe(false)
    expect(buildAggregateQuery(base(d, { groupBy: { table: 't', column: 'c]; --' } })).ok).toBe(false)
  })
  it.each(SQL_DIALECTS)('%s recusa valor numérico e data inválidos', (d) => {
    expect(() => conditionSql(d, cond({ kind: 'number', op: 'gt', value: '1; DROP' }))).toThrow()
    expect(() => conditionSql(d, cond({ kind: 'date', op: 'gte', value: "2026-01-01' OR '1'='1" }))).toThrow()
  })
  it.each(SQL_DIALECTS)('%s: COUNT_DISTINCT, série e nome do registro relacionado montam SQL', (d) => {
    expect(buildAggregateQuery(base(d, { calc: 'COUNT_DISTINCT', field: { table: 'pedidos', column: 'cliente_id' } })).ok).toBe(true)
    expect(buildAggregateQuery(base(d, { groupBy: status, series: data })).ok).toBe(true)
    expect(buildAggregateQuery(base(d, {
      calc: 'COUNT', field: null, groupBy: { table: 'pedidos', column: 'cliente_id' },
      groupLabel: { label: { table: 'clientes', column: 'nome' }, key: { table: 'clientes', column: 'id' } },
    })).ok).toBe(true)
  })
  it('quoteFor entrega o delimitador de cada banco', () => {
    expect(SQL_DIALECTS.map(d => quoteFor(d)('t'))).toEqual(['"t"', '"t"', '`t`', '[t]'])
  })
})
