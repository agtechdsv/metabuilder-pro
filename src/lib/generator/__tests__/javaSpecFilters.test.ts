import { describe, it, expect } from 'vitest'
import { buildProjectSource } from '../projectSource'

/**
 * `GET /api/<tabela>?coluna=valor` precisa filtrar por QUALQUER coluna, não só pelos campos de filtro da tela.
 * Achado ao rodar os testes no app Java ejetado: funcionarios?departamento_id=... devolvia todos os funcionários (a Spec só tinha "nome"),
 * a aba "Funcionários" do departamento listava a tabela inteira e o Salvar da tela reatribuía funcionários de outros departamentos.
 */
const f = (id: string, col: string, type: string, pk = false) => ({ id, model_id: 'm1', db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })
function fakeSupabase(data: Record<string, any>) {
  return { from: (table: string) => { const rows = data[table]; const chain: any = {
    select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }) }; return chain } } as any
}
const world = () => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [{
    id: 'm1', db_table_name: 'funcionarios', display_name: 'Funcionarios', db_schema_name: 'public',
    fields: [f('a', 'id', 'uuid', true), f('b', 'nome', 'varchar'), f('c', 'departamento_id', 'uuid'), f('d', 'ativo', 'boolean'), f('e', 'salario', 'numeric')],
  }],
  // a tela só tem "nome" como filtro (layout_config.filter_fields)
  ui_views: [{
    id: 'v1', slug: 'funcs', name: 'Funcs', logic_type: 'pesquisa_cadastro', model_id: 'm1', layout_config: { filter_fields: ['b'] },
    ui_components: [{ id: 'u1', field_id: 'b', is_visible: true, order_index: 0, config: { zones: ['grid', 'form', 'filter'] } }, { id: 'u2', field_id: 'c', is_visible: true, order_index: 1, config: { zones: ['grid', 'form'] } }],
  }],
  relations: [], project_enumerations: [], project_auth_config: null,
})
const opts = { projectId: 'p1', backendStack: 'java-spring', javaGroupId: 'com.vendas', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' }

describe('backend Java: filtro por qualquer coluna na listagem', () => {
  it('a Spec filtra por igualdade nas colunas que não são filtro da tela (FK, boolean, número)', async () => {
    const { files } = await buildProjectSource(world(), opts as any)
    const spec = files.get('backend/src/main/java/com/vendas/specifications/FuncionariosSpec.java')!
    expect(spec).toBeTruthy()
    expect(spec).toContain('params.get("nome")') // o filtro da tela continua
    expect(spec).toContain('params.get("departamento_id")')
    expect(spec).toMatch(/cb\.equal\(root\.get\("departamentoId"\), java\.util\.UUID\.fromString\(/)
    expect(spec).toContain('params.get("ativo")')
    expect(spec).toContain('params.get("salario")')
  })
})
