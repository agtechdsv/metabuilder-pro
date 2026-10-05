import { describe, it, expect } from 'vitest'
import { pickLabelColumn, resolveFkLabel, type FkRelation } from '../fkLabel'
import { buildAggregateQuery, type BuildAggInput } from '../queryBuilder'

const f = (name: string, type: string, extra: any = {}) => ({ db_column_name: name, data_type: type, ...extra })
const models = [
  { db_table_name: 'pedidos', fields: [f('id', 'uuid', { is_primary_key: true }), f('cliente_id', 'uuid'), f('status', 'text')] },
  { db_table_name: 'clientes', fields: [f('id', 'uuid', { is_primary_key: true }), f('codigo', 'uuid'), f('nome_empresa', 'text', { order_index: 2 }), f('email', 'text', { order_index: 3 })] },
  { db_table_name: 'sem_texto', fields: [f('id', 'uuid', { is_primary_key: true }), f('qtd', 'integer')] },
]
const relations: FkRelation[] = [
  { from_table: 'pedidos', from_field: 'cliente_id', to_table: 'clientes', to_field: 'id' },
  { from_table: 'pedidos', from_field: 'sem_id', to_table: 'sem_texto', to_field: 'id' },
]

describe('pickLabelColumn', () => {
  it('primeiro texto visível que não é chave', () => expect(pickLabelColumn(models[1], relations)).toBe('nome_empresa'))
  it('ignora campo de texto que é chave estrangeira', () => {
    const rels: FkRelation[] = [{ from_table: 'clientes', from_field: 'nome_empresa', to_table: 'x', to_field: 'id' }]
    expect(pickLabelColumn(models[1], rels)).toBe('email')
  })
  it('sem campo de texto → null', () => expect(pickLabelColumn(models[2], relations)).toBeNull())
})

describe('resolveFkLabel', () => {
  it('chave estrangeira → registro relacionado e coluna descritiva', () => {
    expect(resolveFkLabel(models, relations, { table: 'pedidos', column: 'CLIENTE_ID' })).toEqual({
      label: { table: 'clientes', column: 'nome_empresa' }, key: { table: 'clientes', column: 'id' },
    })
  })
  it('coluna comum, FK sem texto ou desconhecida → null', () => {
    expect(resolveFkLabel(models, relations, { table: 'pedidos', column: 'status' })).toBeNull()
    expect(resolveFkLabel(models, relations, { table: 'pedidos', column: 'sem_id' })).toBeNull()
    expect(resolveFkLabel(models, relations, { table: 'x', column: 'y' })).toBeNull()
  })
})

describe('SQL com nome do registro relacionado', () => {
  const JOIN = ' LEFT JOIN "clientes" ON "pedidos"."cliente_id" = "clientes"."id"'
  const base: BuildAggInput = {
    dialect: 'postgres', mainTable: 'pedidos', mainPk: 'id', joinSql: JOIN, calc: 'COUNT', field: null, filters: [],
    groupBy: { table: 'pedidos', column: 'cliente_id' },
    groupLabel: { label: { table: 'clientes', column: 'nome_empresa' }, key: { table: 'clientes', column: 'id' } },
  }
  it('mostra o nome e agrupa também pela chave (nomes repetidos não se fundem)', () => {
    const r = buildAggregateQuery(base)
    expect(r.ok && r.sql).toContain('"clientes"."nome_empresa" AS "bi_name"')
    expect(r.ok && r.sql).toContain('GROUP BY "clientes"."nome_empresa", "clientes"."id"')
  })
  it('com valor da tabela principal e JOIN, a chave entra no SELECT DISTINCT', () => {
    const r = buildAggregateQuery({ ...base, calc: 'SUM', field: { table: 'pedidos', column: 'valor' } })
    expect(r.ok && r.sql).toContain('"clientes"."id" AS "bi_gk"')
    expect(r.ok && r.sql).toContain('GROUP BY "bi_g", "bi_gk"')
  })
  it('série também pode ser chave estrangeira', () => {
    const r = buildAggregateQuery({
      ...base, series: { table: 'pedidos', column: 'cliente_id' },
      seriesLabel: { label: { table: 'clientes', column: 'nome_empresa' }, key: { table: 'clientes', column: 'id' } },
    })
    expect(r.ok && r.sql).toContain('AS "bi_series"')
    expect(r.ok && r.sql).toMatch(/GROUP BY "clientes"."nome_empresa", "clientes"."id", "clientes"."nome_empresa", "clientes"."id"/)
  })
})
