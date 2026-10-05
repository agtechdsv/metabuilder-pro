import { describe, it, expect } from 'vitest'
import { buildAggregateQuery, conditionSql, type BuildAggInput, type BiCondition } from '../queryBuilder'

const JOIN = ' LEFT JOIN "itens_pedido" ON "pedidos"."id" = "itens_pedido"."pedido_id"'
const base: BuildAggInput = {
  dialect: 'postgres', mainTable: 'pedidos', mainPk: 'id', joinSql: '', calc: 'SUM',
  field: { table: 'pedidos', column: 'valor_total' }, filters: [],
}
const build = (o: Partial<BuildAggInput>) => buildAggregateQuery({ ...base, ...o })
const sql = (o: Partial<BuildAggInput>) => {
  const r = build(o)
  if (!r.ok) throw new Error(r.reason)
  return r.sql
}
const cond = (o: Partial<BiCondition>): BiCondition => ({ col: { table: 'pedidos', column: 'status' }, op: 'eq', kind: 'text', value: 'x', ...o })

describe('granularidade semana e trimestre', () => {
  const g = { table: 'pedidos', column: 'data' }
  it('postgres', () => {
    expect(sql({ groupBy: g, granularity: 'week' })).toContain(`TO_CHAR(CAST("pedidos"."data" AS TIMESTAMP), 'IYYY') || '-S' || TO_CHAR(CAST("pedidos"."data" AS TIMESTAMP), 'IW')`)
    expect(sql({ groupBy: g, granularity: 'quarter' })).toContain(`'-T'`)
  })
  it('oracle', () => {
    expect(sql({ dialect: 'oracle', groupBy: g, granularity: 'quarter' })).toContain(`TO_CHAR("pedidos"."data", 'Q')`)
  })
})

describe('contagem distinta', () => {
  it('COUNT_DISTINCT de um campo', () => {
    expect(sql({ calc: 'COUNT_DISTINCT', field: { table: 'pedidos', column: 'cliente_id' } })).toContain('COUNT(DISTINCT "pedidos"."cliente_id")')
  })
  it('exige campo', () => {
    expect(build({ calc: 'COUNT_DISTINCT', field: null }).ok).toBe(false)
  })
})

describe('condições com operador', () => {
  it('texto', () => {
    expect(conditionSql('postgres', cond({ op: 'eq', value: "a'b" }))).toBe(`"pedidos"."status" = 'a''b'`)
    expect(conditionSql('postgres', cond({ op: 'starts', value: 'ab' }))).toBe(`CAST("pedidos"."status" AS TEXT) ILIKE 'ab%'`)
    expect(conditionSql('oracle', cond({ op: 'ends', value: 'ab' }))).toBe(`UPPER(TO_CHAR("pedidos"."status")) LIKE UPPER('%ab')`)
    expect(conditionSql('postgres', cond({ op: 'in', value: 'a, b' }))).toBe(`"pedidos"."status" IN ('a', 'b')`)
    expect(conditionSql('postgres', cond({ op: 'is_null' }))).toBe(`"pedidos"."status" IS NULL`)
  })
  it('número validado (sem injeção)', () => {
    expect(conditionSql('postgres', cond({ kind: 'number', op: 'gte', value: '10.5' }))).toBe(`"pedidos"."status" >= 10.5`)
    expect(() => conditionSql('postgres', cond({ kind: 'number', op: 'gt', value: '1; DROP' }))).toThrow()
  })
  it('data por dialeto e igualdade por dia', () => {
    expect(conditionSql('postgres', cond({ kind: 'date', op: 'gte', value: '2026-01-01' }))).toContain(`CAST('2026-01-01' AS TIMESTAMP)`)
    expect(conditionSql('oracle', cond({ kind: 'date', op: 'lt', value: '2026-01-01' }))).toContain(`TO_DATE('2026-01-01', 'YYYY-MM-DD')`)
    expect(conditionSql('oracle', cond({ kind: 'date', op: 'eq', value: '2026-01-01' }))).toContain('TRUNC(')
    expect(() => conditionSql('postgres', cond({ kind: 'date', op: 'gte', value: "2026-01-01' OR '1'='1" }))).toThrow()
  })
  it('between', () => {
    expect(conditionSql('postgres', cond({ kind: 'number', op: 'between', value: '1', value2: '5' }))).toBe(`"pedidos"."status" BETWEEN 1 AND 5`)
  })
  it('entram no WHERE do SQL; valor inválido vira ok:false', () => {
    expect(sql({ conditions: [cond({ op: 'ne', value: 'cancelado' })] })).toContain(`WHERE 1=1 AND "pedidos"."status" <> 'cancelado'`)
    expect(build({ conditions: [cond({ kind: 'number', op: 'gt', value: 'abc' })] }).ok).toBe(false)
  })
})

describe('série (segunda dimensão)', () => {
  const g = { table: 'pedidos', column: 'status' }
  const s = { table: 'pedidos', column: 'vendedor_id' }
  it('agrupa por dois campos e devolve bi_series', () => {
    const r = build({ groupBy: g, series: s })
    expect(r.ok && r.series).toBe(true)
    expect(sql({ groupBy: g, series: s })).toContain('"pedidos"."vendedor_id" AS "bi_series"')
    expect(sql({ groupBy: g, series: s })).toContain('GROUP BY "pedidos"."status", "pedidos"."vendedor_id"')
  })
  it('com JOIN e valor da principal, a série entra no SELECT DISTINCT', () => {
    const q = sql({ joinSql: JOIN, groupBy: { table: 'itens_pedido', column: 'produto_id' }, series: s })
    expect(q).toContain('"bi_s" AS "bi_series"')
    expect(q).toContain('GROUP BY "bi_g", "bi_s"')
  })
  it('sem agrupamento a série é ignorada', () => {
    const r = build({ series: s })
    expect(r.ok && r.series).toBeFalsy()
  })
})

describe('métrica derivada (÷)', () => {
  it('ticket médio sem agrupamento: duas agregações combinadas com NULLIF', () => {
    const q = sql({ divideBy: { calc: 'COUNT' } })
    expect(q).toContain('NULLIF(d."bi_value", 0)')
    expect(q).toContain('CROSS JOIN')
    expect(q).toContain('SUM(CAST("pedidos"."valor_total" AS NUMERIC))')
    expect(q).toContain('COUNT(*)')
  })
  it('agrupado: junta por grupo (nulos incluídos) e ordena', () => {
    const q = sql({ groupBy: { table: 'pedidos', column: 'status' }, divideBy: { calc: 'COUNT' }, limitTopN: 3 })
    expect(q).toContain('LEFT JOIN')
    expect(q).toContain('n."bi_name" IS NULL AND d."bi_name" IS NULL')
    expect(q).toMatch(/ORDER BY "bi_value" DESC LIMIT 3$/)
  })
  it('com JOIN, cada métrica mantém sua deduplicação', () => {
    const q = sql({ joinSql: JOIN, groupBy: { table: 'itens_pedido', column: 'produto_id' }, divideBy: { calc: 'COUNT' } })
    expect(q).toContain('SUM("bi_v")')
    expect(q).toContain('COUNT(DISTINCT "pedidos"."id")')
  })
  it('oracle usa FETCH NEXT e não faz CAST AS NUMERIC', () => {
    const q = sql({ dialect: 'oracle', groupBy: { table: 'pedidos', column: 'status' }, divideBy: { calc: 'COUNT' } })
    expect(q).toContain('FETCH NEXT')
    expect(q).not.toContain('AS NUMERIC')
  })
})
