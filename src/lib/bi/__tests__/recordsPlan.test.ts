import { describe, it, expect } from 'vitest'
import { planRecordsQuery, type RecordsInput } from '../recordsPlan'

let n = 0
const f = (name: string, type: string, extra: any = {}) => ({ id: `${name}-${n}`, db_column_name: name, data_type: type, order_index: n++, ...extra })
const models = [
  { id: 'm_ped', db_table_name: 'pedidos', db_schema_name: 'crm', fields: [f('id', 'uuid', { is_primary_key: true }), f('cliente_id', 'uuid'), f('data_pedido', 'timestamp with time zone'), f('status', 'text')] },
  { id: 'm_it', db_table_name: 'itens_pedido', db_schema_name: 'crm', fields: [f('id', 'uuid', { is_primary_key: true }), f('pedido_id', 'uuid'), f('quantidade', 'integer')] },
  { id: 'm_cli', db_table_name: 'clientes', db_schema_name: 'crm', fields: [f('id', 'uuid', { is_primary_key: true }), f('nome_empresa', 'text')] },
  { id: 'm_x', db_table_name: 'ilha', db_schema_name: 'crm', fields: [f('id', 'uuid', { is_primary_key: true }), f('nome', 'text')] },
]
const fld = (m: string, col: string) => models.find(x => x.id === m)!.fields.find(x => x.db_column_name === col)!.id
const relations = [
  { id: 'r1', from_model_id: 'm_it', from_field_id: fld('m_it', 'pedido_id'), to_model_id: 'm_ped', to_field_id: fld('m_ped', 'id') },
  { id: 'r2', from_model_id: 'm_ped', from_field_id: fld('m_ped', 'cliente_id'), to_model_id: 'm_cli', to_field_id: fld('m_cli', 'id') },
]

const plan = (widget: any, extra: Partial<RecordsInput> = {}) =>
  planRecordsQuery({ widget: { id: 'w', model_id: 'm_ped', calc: 'COUNT', field: '*', ...widget }, models, relations, dialect: 'postgres', limit: 200, projectSlug: 'x', ...extra })

describe('planRecordsQuery', () => {
  it('sem condições: linhas da tabela do widget, mais recentes primeiro', () => {
    const p = plan({})
    expect(p.kind).toBe('records')
    expect(p.sql).toBe('SELECT * FROM "pedidos" WHERE 1=1 ORDER BY "pedidos"."id" DESC LIMIT 200')
    expect(p.schemaName).toBe('crm')
  })

  it('condição na própria tabela, sem JOIN', () => {
    const p = plan({ conditions: [{ field: 'pedidos.status', op: 'eq', value: 'Aprovado' }] })
    expect(p.sql).toContain(`"pedidos"."status" = 'Aprovado'`)
    expect(p.sql).not.toContain('JOIN')
  })

  it('período e dia do clique entram como datas', () => {
    const p = plan(
      { period_field: 'pedidos.data_pedido', conditions: [{ field: 'pedidos.data_pedido', op: 'between', value: '2026-03-01', value2: '2026-03-31' }] },
      { period: { from: '2026-01-01', to: '2026-06-30' } },
    )
    expect(p.sql).toContain("CAST('2026-03-01' AS TIMESTAMP)")
    expect(p.sql).toContain("CAST('2026-07-01' AS TIMESTAMP)")
  })

  it('condição em tabela relacionada usa os ids das linhas que casam (sem duplicar)', () => {
    const p = plan({ conditions: [{ field: 'itens_pedido.quantidade', op: 'gte', value: '5' }] })
    expect(p.kind).toBe('records')
    expect(p.sql).toContain('WHERE "pedidos"."id" IN (SELECT "pedidos"."id" FROM "pedidos"')
    expect(p.sql).toContain('"itens_pedido"')
    expect(p.sql).toContain('>= 5')
  })

  it('tabela sem relação com a do widget → erro claro', () => {
    const p = plan({ conditions: [{ field: 'ilha.nome', op: 'eq', value: 'a' }] })
    expect(p.kind).toBe('error')
    expect(p.message).toContain('Sem relação')
  })

  it('valor incompatível com o tipo da coluna → erro, não SQL', () => {
    const p = plan({ conditions: [{ field: 'itens_pedido.quantidade', op: 'eq', value: 'abc' }] })
    expect(p.kind).toBe('error')
  })

  it('cada banco limita do seu jeito', () => {
    expect(plan({}, { dialect: 'oracle' }).sql).toContain('OFFSET 0 ROWS FETCH NEXT 200 ROWS ONLY')
    expect(plan({}, { dialect: 'sqlserver' }).sql).toMatch(/^SELECT TOP 200 \*/)
    expect(plan({}, { dialect: 'mysql' }).sql).toContain('LIMIT 200')
    expect(plan({}, { dialect: 'mysql' }).sql).toContain('`pedidos`')
  })

  it('sem dialeto (banco sem SQL direto) → erro', () => {
    expect(plan({}, { dialect: null }).kind).toBe('error')
  })

  it('filtros da tela entram como "contém", só colunas que existem', () => {
    const p = plan({}, { screenFilters: { status: 'apr', coluna_inexistente: 'x', 'clientes.nome_empresa': 'acme' } })
    expect(p.sql).toContain('"pedidos"."status"')
    expect(p.sql).toContain('"clientes"."nome_empresa"')
    expect(p.sql).not.toContain('coluna_inexistente')
  })
})
