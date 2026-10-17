import { it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { buildProjectSource } from '../projectSource'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

/**
 * Gerador do app usado pelos testes de ponta a ponta (pasta e2e/). Só roda quando E2E_GEN_DIR está definido
 * (e2e/scripts/generate.mjs faz isso); nos testes normais é ignorado.
 * O "projeto" abaixo corresponde às tabelas de e2e/db/postgres.sql:
 *   clientes (mestre: texto, máscara, data, booleano, número, texto longo, opções fixas, auto-relação)
 *     > pedidos (detalhe: número, data/hora, opções fixas) > itens (subdetalhe, com autocomplete de produto)
 *     > contatos (segundo detalhe do mesmo mestre)
 *   produtos (cadastro simples)
 */
const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })
function fakeSupabase(data: Record<string, any>) {
  return { from: (table: string) => { const rows = data[table]; const chain: any = {
    select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }) }; return chain } } as any
}
const comp = (id: string, field: string, i: number, config: any = {}) => ({ id, field_id: field, is_visible: true, order_index: i, config })
const btn = [
  { id: 'add', label: 'Novo Registro', visible: true }, { id: 'export', label: 'Exportar', visible: true },
  { id: 'view', label: 'Visualizar', visible: true }, { id: 'edit', label: 'Editar', visible: true }, { id: 'delete', label: 'Excluir', visible: true },
]
const STATUS = { component: { type: 'select', fixed_options: 'Ativo, Inativo, Bloqueado' } }
const STATUS_PEDIDO = { component: { type: 'select', fixed_options: 'Aberto, Fechado' } }

const world = () => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres', download_retention_hours: 24 },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [
      f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome_empresa', 'varchar'), f('c', 'mc', 'cnpj', 'varchar'),
      f('d', 'mc', 'data_cadastro', 'date'), f('e', 'mc', 'ativo', 'boolean'), f('g', 'mc', 'limite_credito', 'numeric'),
      f('h', 'mc', 'observacoes', 'text'), f('j', 'mc', 'status', 'varchar'), f('k', 'mc', 'cliente_pai_id', 'integer')] },
    { id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public', fields: [
      f('p1', 'mp', 'id', 'integer', true), f('p2', 'mp', 'cliente_id', 'integer'), f('p3', 'mp', 'total', 'numeric'),
      f('p4', 'mp', 'data_pedido', 'timestamp'), f('p5', 'mp', 'status', 'varchar')] },
    { id: 'mi', db_table_name: 'itens', display_name: 'Itens', db_schema_name: 'public', fields: [
      f('i1', 'mi', 'id', 'integer', true), f('i2', 'mi', 'pedido_id', 'integer'), f('i3', 'mi', 'produto_id', 'integer'), f('i4', 'mi', 'qtd', 'integer')] },
    { id: 'mt', db_table_name: 'contatos', display_name: 'Contatos', db_schema_name: 'public', fields: [
      f('t1', 'mt', 'id', 'integer', true), f('t2', 'mt', 'cliente_id', 'integer'), f('t3', 'mt', 'nome', 'varchar'), f('t4', 'mt', 'email', 'varchar')] },
    { id: 'mr', db_table_name: 'produtos', display_name: 'Produtos', db_schema_name: 'public', fields: [f('r1', 'mr', 'id', 'integer', true), f('r2', 'mr', 'nome', 'varchar')] },
  ],
  ui_views: [
    { id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'pesquisa_cadastro', model_id: 'mc',
      layout_config: {
        items_per_page: 25, details_tab_titles: { mp: 'Meus Pedidos', mt: 'Contatos' }, export_formats: ['xlsx', 'csv', 'json'],
        // campos do mestre, do detalhe (pedidos e contatos) e do subdetalhe (itens), na ordem do formulário
        form_fields: ['b', 'c', 'd', 'e', 'g', 'h', 'j', 'k', 'p3', 'p4', 'p5', 't3', 't4', 'i3', 'i4'],
      },
      buttons_config: btn,
      ui_components: [
        comp('u0', 'b', 0), comp('u1', 'c', 1, { component: { gridSpan: 12 } }),
        comp('u2', 'd', 2, { component: { gridSpan: 6 } }), comp('u3', 'e', 3, { component: { gridSpan: 6 } }),
        comp('u4', 'g', 4, { component: { gridSpan: 6 } }), comp('u5', 'j', 5, { component: { ...STATUS.component, gridSpan: 6 } }),
        comp('u6', 'h', 6, { component: { type: 'textarea', gridSpan: 12 } }),
        comp('u7', 'k', 7, { component: { type: 'select', rel_table: 'clientes', rel_label: 'nome_empresa', rel_value: 'id', gridSpan: 12 } }),
        comp('d1', 'p3', 20), comp('d2', 'p4', 21), comp('d3', 'p5', 22, STATUS_PEDIDO),
        comp('c1', 't3', 30), comp('c2', 't4', 31),
        comp('s1', 'i3', 40, { component: { type: 'Autocomplete (Busca Dinâmica)', rel_table: 'produtos', rel_label: 'nome', rel_value: 'id', min_chars: 2, debounce_ms: 250, limit: 15 } }),
        comp('s2', 'i4', 41),
      ] },
    { id: 'v2', slug: 'produtos', name: 'Produtos', logic_type: 'pesquisa_cadastro', model_id: 'mr', layout_config: {}, buttons_config: btn, ui_components: [comp('x0', 'r2', 0)] },
    { id: 'v3', slug: 'itens', name: 'Itens', logic_type: 'pesquisa_cadastro', model_id: 'mi', layout_config: {}, buttons_config: btn.filter(b => b.id !== 'export'), ui_components: [
      comp('y0', 'i4', 0),
      comp('y1', 'i3', 1, { component: { type: 'Autocomplete (Busca Dinâmica)', rel_table: 'produtos', rel_label: 'nome', rel_value: 'id', min_chars: 2, debounce_ms: 250, limit: 15 } })] },
  ],
  relations: [
    { id: 'r1', from_model_id: 'mp', to_model_id: 'mc', from_field_id: 'p2', to_field_id: 'a' },
    { id: 'r2', from_model_id: 'mt', to_model_id: 'mc', from_field_id: 't2', to_field_id: 'a' },
    { id: 'r3', from_model_id: 'mi', to_model_id: 'mp', from_field_id: 'i2', to_field_id: 'p1' },
    { id: 'r4', from_model_id: 'mi', to_model_id: 'mr', from_field_id: 'i3', to_field_id: 'r1' },
    { id: 'r5', from_model_id: 'mc', to_model_id: 'mc', from_field_id: 'k', to_field_id: 'a' },
  ],
  project_enumerations: [], project_auth_config: null,
})

it.skipIf(!process.env.E2E_GEN_DIR)('gera o app de teste de ponta a ponta', async () => {
  const extra = JSON.parse(process.env.E2E_GEN_OPTS || '{}')
  const { files } = await buildProjectSource(world(), {
    projectId: 'p1', dbStack: 'postgres', authStrategy: 'none',
    dbConnectionString: process.env.E2E_PG_URL || 'postgresql://crm:crm@localhost:5432/mb_e2e', ...extra,
  } as any)
  const out = process.env.E2E_GEN_DIR!
  // regrava só o código (mantém node_modules para não reinstalar a cada geração)
  for (const d of ['app', 'components', 'lib', 'frontend/app', 'frontend/components', 'frontend/lib']) fs.rmSync(path.join(out, d), { recursive: true, force: true })
  for (const [p, c] of files) { const fp = path.join(out, p); fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, c) }
})
