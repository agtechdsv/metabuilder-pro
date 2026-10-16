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

const world = () => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome_empresa', 'varchar'), f('c', 'mc', 'produto_id', 'integer')] },
    { id: 'mp', db_table_name: 'produtos', display_name: 'Produtos', db_schema_name: 'public', fields: [f('p1', 'mp', 'id', 'integer', true), f('p2', 'mp', 'nome', 'varchar')] },
  ],
  ui_views: [{
    id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'pesquisa_cadastro', model_id: 'mc', layout_config: {},
    ui_components: [
      { id: 'u0', field_id: 'b', is_visible: true, order_index: 0, config: {} },
      { id: 'u1', field_id: 'c', is_visible: true, order_index: 1, config: { component: { type: 'Autocomplete (Busca Dinâmica)', rel_table: 'produtos', rel_label: 'nome', rel_value: 'id', min_chars: 3, debounce_ms: 250, limit: 15, search_placeholder: 'Buscar produto' } } },
    ],
  }],
  relations: [], project_enumerations: [], project_auth_config: null,
})
const opts = { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' }

function load(src: string, mods: Record<string, any>) {
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  const m: any = { exports: {} }
  new Function('module', 'exports', 'require', js)(m, m.exports, (name: string) => {
    if (!(name in mods)) throw new Error('módulo não previsto: ' + name)
    return mods[name]
  })
  return m.exports
}

describe('campo Autocomplete (busca dinâmica) do Studio no app gerado', () => {
  it('o formulário usa a busca dinâmica com o que o dev configurou, e não uma lista suspensa', async () => {
    const { files } = await buildProjectSource(world(), opts as any)
    const client = files.get('app/(protected)/clientes/[id]/DetailTabsClient.tsx')!
    expect(syntax(client)).toBe(true)
    expect(client).toContain('<AutocompleteInput')
    expect(client).toContain('name="produto_id"')
    expect(client).toContain('table="produtos" labelCol="nome" valueCol="id" minChars={3} debounceMs={250} limit={15} placeholder="Buscar produto"')
    expect(client).not.toMatch(/<select[^>]*name="produto_id"/)
    // o cadastro simples também
    const comp = files.get('components/AutocompleteInput.tsx')!
    expect(syntax(comp)).toBe(true)
    expect(comp).toContain('searchOptions(table, labelCol, valueCol, q, limit)')
    expect(comp).toContain('Digite pelo menos {n} caracteres para buscar...')
    // abas de relacionamento (detalhe e subdetalhe, linha e modal) leem a mesma configuração
    const section = files.get('components/DetailRelationSection.tsx')!
    expect(syntax(section)).toBe(true)
    expect((section.match(/<AutocompleteInput/g) || []).length).toBe(4)
    expect(section).toContain('function getAutocompleteConfig(f: any)')
    expect(section).toContain("'autocomplete (busca dinâmica)'")
  })

  it('a busca roda no servidor e devolve só os resultados (execução do código gerado)', async () => {
    const { files } = await buildProjectSource(world(), opts as any)
    const calls: any[] = []
    const produtos = [{ id: 1, nome: 'Parafuso M8' }, { id: 2, nome: 'Porca M8' }, { id: 3, nome: 'Arruela' }]
    const act = load(files.get('app/actions/autocomplete.ts')!, {
      '@/app/actions/clientes': { getClientesList: async () => [], getClientesByField: async () => [] },
      '@/app/actions/produtos': {
        getProdutosList: async (o: any) => { calls.push(o); return produtos.filter(p => p.nome.toLowerCase().includes(String(o.filters?.nome_filter || '').toLowerCase())) },
        getProdutosByField: async (_f: string, v: any) => produtos.filter(p => String(p.id) === String(v)),
      },
    })
    const found = await act.searchOptions('produtos', 'nome', 'id', 'm8', 10)
    expect(found.map((o: any) => o.label)).toEqual(['Parafuso M8', 'Porca M8'])
    expect(found[0].value).toBe(1)
    // o filtro e o limite vão ao banco (não carrega a tabela inteira)
    expect(calls[0]).toEqual({ limit: 10, filters: { nome_filter: 'm8' } })
    // tabela que não existe, texto vazio e coluna com nome perigoso: nada
    expect(await act.searchOptions('usuarios', 'nome', 'id', 'x')).toEqual([])
    expect(await act.searchOptions('produtos', 'nome', 'id', '   ')).toEqual([])
    expect(await act.searchOptions('produtos', 'nome"; drop table x;--', 'id', 'x')).toEqual([])
    // texto do item já escolhido
    expect((await act.getOptionByValue('produtos', 'nome', 'id', 3)).label).toBe('Arruela')
    expect(await act.getOptionByValue('produtos', 'nome', 'id', '')).toBeNull()
  })

  it('no backend Java a busca usa a página da API; em bancos sem filtro de texto, lê no servidor e filtra', async () => {
    const java = (await buildProjectSource(world(), { ...opts, backendStack: 'java-spring', jwtEnabled: true } as any)).files
    expect(java.get('frontend/app/actions/autocomplete.ts')).toContain("source.list({ page: 1, limit: lim, filters: { [col]: q } })")
    const oracle = (await buildProjectSource(world(), { ...opts, dbStack: 'oracle', dbConnectionString: 'oracle://u:p@h:1521/S' } as any)).files
    expect(oracle.get('app/actions/autocomplete.ts')).toContain('source.list({ limit: 5000 })')
  })
})
