import { describe, it, expect, vi } from 'vitest'
import ts from 'typescript'
import { buildProjectSource } from '../projectSource'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })
function fakeSupabase(data: Record<string, any>) {
  return { from: (table: string) => { const rows = data[table]; const chain: any = {
    select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }) }; return chain } } as any
}
const syntax = (src: string) => (ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext } }).diagnostics || []).length === 0

const produtos = {
  id: 'a1', label: 'Produtos', icon: 'LayoutDashboard', trigger_type: 'usecase', usecase_slug: 'produtos',
  usecase_selected_fields: [{ source: 'id', target: 'cliente_id' }],
  // grid (linha) e topo do formulário mestre, como na tela de configuração do dev
  placements: [{ location: 'search', contexts: ['row'] }, { location: 'master', contexts: ['global_top'] }],
}
const pedidos = {
  id: 'a2', label: 'Pedidos', icon: 'Layers', trigger_type: 'usecase', usecase_slug: 'pedidos',
  placements: [{ location: 'search', contexts: ['row'] }],
}
const naTabela = {
  id: 'a3', label: 'Conferir', icon: 'Check', trigger_type: 'usecase', usecase_slug: 'produtos',
  placements: [{ location: 'detail:mp', contexts: ['global_top', 'row'] }],
}
const noCampo = {
  id: 'a4', label: 'Consultar CNPJ', icon: 'Search', trigger_type: 'usecase', usecase_slug: 'produtos', group_position: 'left',
  placements: [{ location: 'master', contexts: ['field_group'], group_fields: ['cnpj_cpf'] }],
}

const world = (actions: any[]) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome_empresa', 'varchar'), f('c', 'mc', 'cnpj_cpf', 'varchar')] },
    { id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public', fields: [f('p1', 'mp', 'id', 'integer', true), f('p2', 'mp', 'cliente_id', 'integer'), f('p3', 'mp', 'total', 'numeric')] },
  ],
  ui_views: [
    { id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'pesquisa_cadastro', model_id: 'mc', layout_config: { custom_actions: actions }, ui_components: [] },
    { id: 'v2', slug: 'produtos', name: 'Produtos', logic_type: 'pesquisa_cadastro', model_id: 'mp', layout_config: {}, ui_components: [] },
  ],
  relations: [],
  project_enumerations: [],
  project_auth_config: null,
})
const gen = async (actions: any[]) => (await buildProjectSource(world(actions), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' } as any)).files

describe('ações customizadas: aparecem onde o dev configurou', () => {
  it('topo do formulário mestre (edição e cadastro) só para as ações com master/global_top; a grid continua como estava', async () => {
    const files = await gen([produtos, pedidos])
    const edit = files.get('app/(protected)/clientes/[id]/DetailTabsClient.tsx')!
    const create = files.get('app/(protected)/clientes/new/page.tsx')!
    const list = files.get('app/(protected)/clientes/page.tsx')!
    for (const src of [edit, create]) {
      expect(syntax(src)).toBe(true)
      expect(src).toContain('"label":"Produtos"')
      expect(src).toContain('variant="header"')
      expect(src).toContain('CustomActionButton')
      // "Pedidos" é só da linha da grid
      expect(src).not.toContain('"label":"Pedidos"')
    }
    // o botão leva o registro aberto (origem dos parâmetros: id do cliente -> cliente_id); no cadastro ainda não há registro
    expect(edit).toContain('item={data}')
    expect(create).toContain('item={{}}')
    expect(edit).toContain('"usecaseSelectedFields":[{"source":"id","target":"cliente_id"}]')
    // grid: as duas ações
    expect(list).toContain('"label":"Produtos"')
    expect(list).toContain('"label":"Pedidos"')
  })

  it('ação agrupada a um campo aparece junto do campo, na edição e no cadastro', async () => {
    const files = await gen([noCampo])
    for (const path of ['app/(protected)/clientes/[id]/DetailTabsClient.tsx', 'app/(protected)/clientes/new/page.tsx']) {
      const src = files.get(path)!
      expect(syntax(src), path).toBe(true)
      const at = src.indexOf('"label":"Consultar CNPJ"')
      expect(at, path).toBeGreaterThan(0)
      // dentro do bloco do campo cnpj_cpf (depois do input e antes do próximo campo)
      expect(src.lastIndexOf('name="cnpj_cpf"', at)).toBeGreaterThan(0)
      expect(src).toContain('variant="icon"')
    }
  })

  it('ações da aba de relacionamento (topo e linha) vão para a aba certa', async () => {
    const files = await gen([naTabela])
    const edit = files.get('app/(protected)/clientes/[id]/DetailTabsClient.tsx')!
    expect(syntax(edit)).toBe(true)
    expect(edit).toMatch(/actionsTop=\{\[\{"id":"a3","label":"Conferir"/)
    expect(edit).toMatch(/actionsRow=\{\[\{"id":"a3","label":"Conferir"/)
    expect(edit).toContain('parentItem={data}')
    // não é do mestre
    expect(edit).not.toContain('variant="header"')
    const section = files.get('components/DetailRelationSection.tsx')!
    expect(syntax(section)).toBe(true)
    expect(section).toContain('actionsTop.map')
    expect(section).toContain('actionsRow.map')
  })

  it('sem ações customizadas nada muda no formulário', async () => {
    const files = await gen([])
    const edit = files.get('app/(protected)/clientes/[id]/DetailTabsClient.tsx')!
    expect(edit).not.toContain('variant="header"')
    expect(edit).not.toContain('actionsTop=')
    expect(syntax(edit)).toBe(true)
  })
})
