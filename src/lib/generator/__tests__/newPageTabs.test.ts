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
    const page = files.get('app/(protected)/clientes/new/page.tsx')!
    expect(syntax(page)).toBe(true)
    expect(page).toContain("import { MaskScope } from '@/components/MaskScope'")
    expect(page).toContain("import { NewRecordTabs } from '@/components/NewRecordTabs'")
    expect(page).toContain('<NewRecordTabs mainLabel=')
    expect(page).toContain('"Pedidos"')
    expect(page).toContain('data-mask="00.000.000/0000-00"')
    expect(page).toContain('</MaskScope>')

    const scope = files.get('components/MaskScope.tsx')!
    expect(syntax(scope)).toBe(true)
    expect(scope).toContain("getAttribute?.('data-mask')")
    expect(scope).toContain("mask === '00.000.000/0000-00'")
    // a função de máscara é a mesma do formulário de edição
    expect(files.get('components/DetailMasterForm.tsx')).toContain("mask === '00.000.000/0000-00'")
    const tabs = files.get('components/NewRecordTabs.tsx')!
    expect(syntax(tabs)).toBe(true)
    expect(tabs).toContain('hidden')
  })

  it('sem relacionamentos não há abas, mas a máscara continua valendo', async () => {
    const { files } = await buildProjectSource(world(false), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' } as any)
    const page = files.get('app/(protected)/clientes/new/page.tsx')!
    expect(syntax(page)).toBe(true)
    expect(page).toContain('<MaskScope>')
    expect(page).not.toContain('NewRecordTabs')
  })
})
