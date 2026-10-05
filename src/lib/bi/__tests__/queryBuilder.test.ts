import { describe, it, expect } from 'vitest'
import { buildAggregateQuery, filterConditionSql, type BuildAggInput } from '../queryBuilder'

const JOIN = ' LEFT JOIN "itens_pedido" ON "pedidos"."id" = "itens_pedido"."pedido_id"'
const base: BuildAggInput = {
  dialect: 'postgres', mainTable: 'pedidos', mainPk: 'id', joinSql: '', calc: 'SUM',
  field: { table: 'pedidos', column: 'valor_total' }, filters: [],
}
const sql = (o: Partial<BuildAggInput>) => {
  const r = buildAggregateQuery({ ...base, ...o })
  if (!r.ok) throw new Error(r.reason)
  return r.sql
}

describe('buildAggregateQuery', () => {
  it('KPI simples (sem grupo)', () => {
    expect(sql({})).toBe('SELECT SUM(CAST("pedidos"."valor_total" AS NUMERIC)) AS "bi_value" FROM "pedidos" WHERE 1=1')
  })

  it('COUNT sem campo: COUNT(*) sem JOIN e COUNT DISTINCT pk com JOIN', () => {
    expect(sql({ calc: 'COUNT', field: null })).toContain('COUNT(*)')
    expect(sql({ calc: 'COUNT', field: null, joinSql: JOIN })).toContain('COUNT(DISTINCT "pedidos"."id")')
  })

  it('agrupado, ordenado, com LIMIT (postgres) e FETCH NEXT (oracle)', () => {
    const g = { table: 'pedidos', column: 'status' }
    const pg = sql({ groupBy: g, limitTopN: 5 })
    expect(pg).toContain('GROUP BY "pedidos"."status" ORDER BY "bi_value" DESC LIMIT 5')
    const ora = sql({ dialect: 'oracle', groupBy: g, limitTopN: 5 })
    expect(ora).toContain('TO_NUMBER("pedidos"."valor_total")')
    expect(ora).toContain('OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY')
    expect(ora).not.toMatch(/ LIMIT /)
  })

  it('usa maxGroups quando não há Top N e respeita a ordenação', () => {
    const s = sql({ groupBy: { table: 'pedidos', column: 'status' }, maxGroups: 300, sortBy: 'label_asc' })
    expect(s).toContain('ORDER BY "bi_name" ASC LIMIT 300')
  })

  it('deduplica por PK quando o valor é da tabela principal e há JOIN (evita fan-out)', () => {
    const s = sql({ joinSql: JOIN, groupBy: { table: 'itens_pedido', column: 'produto_id' } })
    expect(s).toContain('SELECT DISTINCT "pedidos"."id" AS "bi_pk"')
    expect(s).toContain('SUM("bi_v")')
  })

  it('não deduplica quando o valor vem da tabela do JOIN', () => {
    const s = sql({ joinSql: JOIN, field: { table: 'itens_pedido', column: 'quantidade' } })
    expect(s).not.toContain('DISTINCT')
  })

  it('fórmula vira SQL com NULLIF na divisão', () => {
    const s = sql({ joinSql: JOIN, field: null, formula: 'itens_pedido.preco * itens_pedido.qtd / 2' })
    expect(s).toContain('NULLIF(2, 0)')
    expect(s).toContain('CAST("itens_pedido"."preco" AS NUMERIC)')
  })

  it('granularidade de data', () => {
    const g = { table: 'pedidos', column: 'data' }
    expect(sql({ groupBy: g, granularity: 'month' })).toContain(`TO_CHAR(CAST("pedidos"."data" AS TIMESTAMP), 'YYYY-MM')`)
    expect(sql({ dialect: 'oracle', groupBy: g, granularity: 'year' })).toContain(`TO_CHAR("pedidos"."data", 'YYYY')`)
  })

  it('filtros: escapa aspas simples e usa o operador do dialeto', () => {
    const f = [{ col: { table: 'pedidos', column: 'status' }, value: "o'brien" }]
    expect(sql({ filters: f })).toContain(`CAST("pedidos"."status" AS TEXT) ILIKE '%o''brien%'`)
    expect(sql({ dialect: 'oracle', filters: f })).toContain(`UPPER(TO_CHAR("pedidos"."status")) LIKE UPPER('%o''brien%')`)
  })

  it('rejeita identificadores inválidos (injeção)', () => {
    expect(buildAggregateQuery({ ...base, field: { table: 'pedidos', column: 'x"; DROP TABLE y;--' } }).ok).toBe(false)
    expect(buildAggregateQuery({ ...base, mainTable: 'a b' }).ok).toBe(false)
    expect(buildAggregateQuery({ ...base, groupBy: { table: 't', column: 'c" --' } }).ok).toBe(false)
  })

  it('rejeita operação desconhecida, SUM sem campo e fórmula inválida', () => {
    expect(buildAggregateQuery({ ...base, calc: 'MEDIAN' }).ok).toBe(false)
    expect(buildAggregateQuery({ ...base, field: null }).ok).toBe(false)
    expect(buildAggregateQuery({ ...base, field: null, formula: 'a; DROP' }).ok).toBe(false)
  })
})

describe('filterConditionSql', () => {
  it('dialeto desconhecido cai no formato postgres', () => {
    expect(filterConditionSql('other', { col: { table: 't', column: 'c' }, value: 'x' })).toContain('ILIKE')
  })
})
