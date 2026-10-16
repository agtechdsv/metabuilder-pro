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
const world = (withOrders: boolean) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome_empresa', 'varchar'), f('c', 'mc', 'cnpj_cpf', 'varchar')] },
    ...(withOrders ? [{ id: 'mp', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'public', fields: [f('p1', 'mp', 'id', 'integer', true), f('p2', 'mp', 'cliente_id', 'integer'), f('p3', 'mp', 'total', 'numeric')] }] : []),
  ],
  ui_views: [{ id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'pesquisa_cadastro', model_id: 'mc', layout_config: {}, ui_components: [] }],
  relations: [],
  project_enumerations: [],
  project_auth_config: null,
})
const syntax = (src: string) => (ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext } }).diagnostics || []).length === 0

describe('cadastro (new) do app exportado', () => {
  it('aplica a máscara ao digitar (CNPJ/CPF) e mostra as abas de relacionamento como na plataforma', async () => {
    const { files } = await buildProjectSource(world(true), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' } as any)
    // com abas, o cadastro é o mesmo formulário mestre/detalhe da edição (máscara e abas já vêm dele)
    const page = files.get('app/(protected)/clientes/new/page.tsx')!
    expect(syntax(page)).toBe(true)
    expect(page).toContain("from '../[id]/DetailTabsClient'")
    expect(page).toContain('isNew')
    expect(page).toContain('createAction={createClientes}')
    expect(page).not.toContain('getClientesById')
    expect(page).toContain('pedidosItems={pedidosList}')

    const client = files.get('app/(protected)/clientes/[id]/DetailTabsClient.tsx')!
    expect(syntax(client)).toBe(true)
    expect(client).toContain('createAction={createAction}')
    expect(client).toContain('parentPending={isNew}')
    expect(client).toContain('data-mask="00.000.000/0000-00"')
    expect(client).not.toContain('Salve o registro para liberar esta aba')

    // cadastro: cria o mestre, as abas gravam os itens preenchidos com o id novo e abre o registro criado
    const master = files.get('components/DetailMasterForm.tsx')!
    expect(syntax(master)).toBe(true)
    expect(master).toContain("new CustomEvent('save-all-relations', { detail: { parentId: String(newId), promises } })")
    expect(master).toContain('await Promise.allSettled(promises)')
    expect(master).toContain("router.push(backPath + '/' + newId")
    expect(master).toContain("mask === '00.000.000/0000-00'")

    // abas: com o mestre ainda não criado a modal só guarda na tela (id temporário), em detalhe e subdetalhe
    const section = files.get('components/DetailRelationSection.tsx')!
    expect(syntax(section)).toBe(true)
    expect(section).toContain('parentPending = false')
    expect(section).toContain('if (parentPending) {')
    expect(section).toContain('updatedChildRecords[sIdx] = { ...subItem, ...subData, id: subItem.id ||')
    expect(section).toContain("window.dispatchEvent(new CustomEvent('save-master-form'))")
  })

  it('sem relacionamentos não há abas, mas a máscara continua valendo', async () => {
    const { files } = await buildProjectSource(world(false), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' } as any)
    const page = files.get('app/(protected)/clientes/new/page.tsx')!
    expect(syntax(page)).toBe(true)
    expect(page).toContain('<MaskScope>')
    expect(page).toContain('data-mask="00.000.000/0000-00"')
    expect(page).not.toContain('DetailTabsClient')
    const scope = files.get('components/MaskScope.tsx')!
    expect(syntax(scope)).toBe(true)
    expect(scope).toContain("getAttribute?.('data-mask')")
  })
})
