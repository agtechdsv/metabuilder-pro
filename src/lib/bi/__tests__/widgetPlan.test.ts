import { describe, it, expect } from 'vitest'
import { planWidgetQuery, type PlanInput } from '../widgetPlan'
import { findAlternativePaths, pathSignature } from '../../relationPaths'
import { resolveRelations } from '../../relationPathFinder'

// Modelo parecido com o Vendas: pedidos → itens_pedido → produtos → categorias; pedidos → clientes / funcionarios
let n = 0
const f = (model: string, name: string, type: string, extra: any = {}) => ({ id: `${model}.${name}`, db_column_name: name, data_type: type, order_index: n++, ...extra })
const models = [
  { id: 'm_ped', db_table_name: 'pedidos', db_schema_name: 'crm', fields: [f('ped', 'id', 'uuid', { is_primary_key: true }), f('ped', 'cliente_id', 'uuid'), f('ped', 'funcionario_id', 'uuid'), f('ped', 'data_pedido', 'timestamp with time zone'), f('ped', 'status', 'text')] },
  { id: 'm_it', db_table_name: 'itens_pedido', db_schema_name: 'crm', fields: [f('it', 'id', 'uuid', { is_primary_key: true }), f('it', 'pedido_id', 'uuid'), f('it', 'produto_id', 'uuid'), f('it', 'quantidade', 'integer'), f('it', 'preco_unitario', 'numeric')] },
  { id: 'm_prod', db_table_name: 'produtos', db_schema_name: 'crm', fields: [f('prod', 'id', 'uuid', { is_primary_key: true }), f('prod', 'categoria_id', 'uuid'), f('prod', 'nome', 'text')] },
  { id: 'm_cat', db_table_name: 'categorias', db_schema_name: 'crm', fields: [f('cat', 'id', 'uuid', { is_primary_key: true }), f('cat', 'nome', 'text')] },
  { id: 'm_cli', db_table_name: 'clientes', db_schema_name: 'crm', fields: [f('cli', 'id', 'uuid', { is_primary_key: true }), f('cli', 'nome_empresa', 'text')] },
  { id: 'm_fun', db_table_name: 'funcionarios', db_schema_name: 'crm', fields: [f('fun', 'id', 'uuid', { is_primary_key: true }), f('fun', 'nome', 'text'), f('fun', 'depto_id', 'uuid')] },
  { id: 'm_tar', db_table_name: 'tarefas', db_schema_name: 'crm', fields: [f('tar', 'id', 'uuid', { is_primary_key: true }), f('tar', 'responsavel_id', 'uuid'), f('tar', 'status', 'text')] },
]
const fid = (model: string, col: string) => `${model}.${col}`
const rel = (id: string, fm: string, ff: string, tm: string, tf: string) => ({ id, from_model_id: fm, from_field_id: fid(fm.replace('m_', ''), ff), to_model_id: tm, to_field_id: fid(tm.replace('m_', ''), tf) })
const relations = [
  rel('r1', 'm_it', 'pedido_id', 'm_ped', 'id'),
  rel('r2', 'm_it', 'produto_id', 'm_prod', 'id'),
  rel('r3', 'm_prod', 'categoria_id', 'm_cat', 'id'),
  rel('r4', 'm_ped', 'cliente_id', 'm_cli', 'id'),
  rel('r5', 'm_ped', 'funcionario_id', 'm_fun', 'id'),
  rel('r6', 'm_tar', 'responsavel_id', 'm_fun', 'id'),
]

const FORMULA = 'itens_pedido.preco_unitario * itens_pedido.quantidade'
const plan = (widget: any, extra: Partial<PlanInput> = {}) =>
  planWidgetQuery({ widget: { id: 'w', model_id: 'm_ped', calc: 'COUNT', field: '', width: 'third', ...widget }, models, relations, dialect: 'postgres', rawRowLimit: 1000, maxGroups: 2000, projectSlug: 'x', ...extra })

describe('planWidgetQuery — validações', () => {
  it('tabela inexistente', () => {
    const p = plan({ model_id: 'zzz-uuid' })
    expect(p.kind).toBe('error')
    expect(p.message).toBe('Tabela não encontrada')
  })
  it('campo sem o nome da tabela é recusado e a mensagem lista os campos', () => {
    const p = plan({ group_by: 'status', field: 'valor', calc: 'SUM', series_by: 'x', conditions: [{ field: 'status', op: 'eq', value: 'a' }] })
    expect(p.kind).toBe('error')
    expect(p.message).toContain('Agrupar por ("status")')
    expect(p.message).toContain('Campo do valor ("valor")')
    expect(p.message).toContain('Segmentar por')
    expect(p.message).toContain('Filtro 1')
  })
  it('fórmula com campo sem tabela é recusada', () => {
    expect(plan({ use_formula: true, field: 'preco * quantidade', calc: 'SUM' }).message).toContain('Fórmula')
  })
})

describe('planWidgetQuery — SQL agregado', () => {
  it('KPI de faturamento junta só itens_pedido (JOINs mínimos)', () => {
    const p = plan({ calc: 'SUM', use_formula: true, field: FORMULA })
    expect(p.kind).toBe('agg')
    expect(p.sql).toContain('LEFT JOIN "itens_pedido" ON "pedidos"."id" = "itens_pedido"."pedido_id"')
    expect(p.sql).not.toContain('clientes')
    expect(p.sql).not.toContain('funcionarios')
    expect(p.schemaName).toBe('crm')
    expect(p.limit).toBe(2100)
  })
  it('pizza por status da tabela principal não faz JOIN nenhum', () => {
    const p = plan({ type: 'pie', group_by: 'pedidos.status' })
    expect(p.kind).toBe('agg')
    expect(p.sql).not.toContain('JOIN')
    expect(p.sql).toContain('GROUP BY "pedidos"."status"')
  })
  it('agrupar por chave estrangeira mostra o nome do registro relacionado', () => {
    const p = plan({ group_by: 'pedidos.cliente_id' })
    expect(p.sql).toContain('"clientes"."nome_empresa" AS "bi_name"')
    expect(p.sql).toContain('LEFT JOIN "clientes"')
  })
  it('Top 5 vendedores agrupa por funcionário e limita', () => {
    const p = plan({ calc: 'SUM', use_formula: true, field: FORMULA, group_by: 'funcionarios.nome', limit_top_n: 5 })
    expect(p.sql).toContain('LEFT JOIN "funcionarios"')
    expect(p.sql).toContain('LEFT JOIN "itens_pedido"')
    expect(p.sql).toContain('LIMIT 5')
  })
  it('caminho com várias tabelas (categoria) liga produtos e categorias', () => {
    const p = plan({ group_by: 'categorias.nome' })
    expect(p.sql).toContain('"categorias"')
    expect(p.sql).toContain('"produtos"')
    expect(p.sql).toContain('"itens_pedido"')
  })
  it('filtro do widget com operador entra no WHERE e a tabela dele entra nos JOINs', () => {
    const p = plan({ calc: 'SUM', use_formula: true, field: FORMULA, conditions: [{ field: 'clientes.nome_empresa', op: 'contains', value: 'Banco' }] })
    expect(p.sql).toContain('LEFT JOIN "clientes"')
    expect(p.sql).toContain("ILIKE '%Banco%'")
  })
  it('condição incompleta (sem valor) é ignorada', () => {
    const p = plan({ conditions: [{ field: 'pedidos.status', op: 'eq', value: '' }] })
    expect(p.sql).not.toContain('"status" =')
  })
})

describe('planWidgetQuery — período e comparação', () => {
  const period = { from: '2026-03-01', to: '2026-03-31' }
  it('período vira condição de data com fim inclusivo', () => {
    const p = plan({ period_field: 'pedidos.data_pedido' }, { period })
    expect(p.sql).toContain(">= CAST('2026-03-01' AS TIMESTAMP)")
    expect(p.sql).toContain("< CAST('2026-04-01' AS TIMESTAMP)")
    expect(p.compare).toBe(false)
  })
  it('KPI com comparação traz também o SQL do período anterior (mês anterior inteiro)', () => {
    const p = plan({ type: 'kpi', period_field: 'pedidos.data_pedido', compare_previous: true }, { period })
    expect(p.compare).toBe(true)
    expect(p.prev?.sql).toContain("CAST('2026-02-01' AS TIMESTAMP)")
    expect(p.prev?.sql).toContain("CAST('2026-03-01' AS TIMESTAMP)")
  })
  it('sem período não há comparação; com agrupamento também não', () => {
    expect(plan({ type: 'kpi', period_field: 'pedidos.data_pedido', compare_previous: true }).compare).toBe(false)
    expect(plan({ type: 'kpi', group_by: 'pedidos.status', period_field: 'pedidos.data_pedido', compare_previous: true }, { period }).compare).toBe(false)
  })
})

describe('planWidgetQuery — filtros da tela', () => {
  it('filtro numa tabela já ligada ao widget entra; coluna inexistente e chave inválida são ignoradas', () => {
    const p = plan({ group_by: 'pedidos.status' }, { screenFilters: { 'pedidos.status': 'Apr', 'pedidos.nao_existe': 'x', 'pedidos.status; DROP': 'x' } })
    expect(p.sql).toContain("ILIKE '%Apr%'")
    expect(p.sql).not.toContain('nao_existe')
    expect(p.sql).not.toContain('DROP')
  })
  it('filtro de tabela que o widget já alcança traz o JOIN dela', () => {
    const p = plan({ calc: 'SUM', use_formula: true, field: FORMULA }, { screenFilters: { 'clientes.nome_empresa': 'Banco' } })
    expect(p.sql).toContain('LEFT JOIN "clientes"')
    expect(p.sql).toContain("ILIKE '%Banco%'")
  })
})

describe('planWidgetQuery — reserva (linhas cruas) e falhas', () => {
  it('banco sem SQL agregado cai nas linhas cruas com JOINs mínimos e limite', () => {
    const p = plan({ calc: 'SUM', field: 'itens_pedido.quantidade' }, { dialect: null })
    expect(p.kind).toBe('raw')
    expect(p.sql).toContain('FROM "pedidos" LEFT JOIN "itens_pedido"')
    expect(p.sql).toContain('LIMIT 1000')
    expect(p.limit).toBe(1000)
  })
  it('depois de o SQL agregado falhar (legacy), usa as linhas cruas', () => {
    const p = plan({ type: 'pie', group_by: 'pedidos.status' }, { legacy: true, failureReason: 'coluna x' })
    expect(p.kind).toBe('raw')
  })
  it('recurso que só o SQL agregado entrega e não há como: erro explicando', () => {
    const noDialect = plan({ calc: 'COUNT_DISTINCT', field: 'pedidos.cliente_id' }, { dialect: null })
    expect(noDialect.kind).toBe('error')
    expect(noDialect.message).toContain('exige banco')
    const failed = plan({ calc: 'COUNT_DISTINCT', field: 'pedidos.cliente_id' }, { legacy: true, failureReason: 'ORA-00904' })
    expect(failed.message).toContain('consulta falhou no banco: ORA-00904')
  })
  it('tabela sem relação com a principal: erro de relacionamento', () => {
    const p = plan({ group_by: 'tarefas.status' })
    // tarefas liga em funcionarios, que liga em pedidos: há caminho; remove a relação para testar o erro
    const q = planWidgetQuery({ widget: { id: 'w', model_id: 'm_ped', calc: 'COUNT', group_by: 'tarefas.status' } as any, models, relations: relations.filter(r => r.id !== 'r6' && r.id !== 'r5'), dialect: 'postgres', rawRowLimit: 1000, maxGroups: 2000 })
    expect(p.kind).toBe('agg')
    expect(q.kind === 'raw' || q.kind === 'error').toBe(true)
  })
})

describe('planWidgetQuery — caminho de relação escolhido e dialetos', () => {
  it('usa o caminho que o desenvolvedor escolheu', () => {
    const rels = resolveRelations(relations, models)
    const paths = findAlternativePaths(rels, 'pedidos', 'tarefas')
    expect(paths.length).toBeGreaterThanOrEqual(1)
    const p = plan({ group_by: 'tarefas.status', relation_paths: { tarefas: pathSignature(paths[0]) } })
    expect(p.kind).toBe('agg')
    expect(p.sql).toContain('"tarefas"')
  })
  it('MySQL usa crase, SQL Server usa colchetes e TOP na reserva', () => {
    const my = plan({ calc: 'SUM', use_formula: true, field: FORMULA }, { dialect: 'mysql' })
    expect(my.sql).toContain('LEFT JOIN `itens_pedido` ON `pedidos`.`id` = `itens_pedido`.`pedido_id`')
    const ss = plan({ calc: 'SUM', use_formula: true, field: FORMULA, group_by: 'funcionarios.nome' }, { dialect: 'sqlserver' })
    expect(ss.sql).toContain('LEFT JOIN [funcionarios] ON')
    expect(ss.sql).toContain('FETCH NEXT')
    const raw = plan({ calc: 'SUM', field: 'itens_pedido.quantidade' }, { dialect: 'sqlserver', legacy: true })
    expect(raw.kind).toBe('raw')
    expect(raw.sql).toMatch(/^SELECT TOP 1000 /)
    expect(raw.sql).not.toContain('OFFSET')
  })
  it('Oracle: reserva com OFFSET/FETCH', () => {
    const raw = plan({ calc: 'SUM', field: 'itens_pedido.quantidade' }, { dialect: 'oracle', legacy: true })
    expect(raw.sql).toContain('OFFSET 0 ROWS FETCH NEXT 1000 ROWS ONLY')
  })
})
