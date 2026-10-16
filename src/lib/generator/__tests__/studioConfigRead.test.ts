import { describe, it, expect, vi } from 'vitest'
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
const world = () => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome_empresa', 'varchar')] },
  ],
  ui_views: [{
    id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'pesquisa_cadastro', model_id: 'mc',
    layout_config: { items_per_page: 25 },
    buttons_config: [{ id: 'add', visible: true }, { id: 'export', visible: true }],
    ui_components: [{ id: 'u0', field_id: 'b', is_visible: true, order_index: 0, config: {} }],
  }],
  relations: [], project_enumerations: [], project_auth_config: null,
})
const opts = { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' }

describe('o exportador lê a configuração do Studio da tela', () => {
  it('tamanho de página padrão, ordem dos botões do topo e seleção de linhas', async () => {
    const { files } = await buildProjectSource(world(), opts as any)
    const page = files.get('app/(protected)/clientes/page.tsx')!
    expect(page).toContain("params?.limit || '25'")
    expect(page.indexOf('<ExportMenu')).toBeGreaterThan(0)
    expect(page.indexOf('<ExportMenu')).toBeLessThan(page.indexOf('/new'))
    expect(page).toContain('<SelectAllBox />')
    expect(page).toContain('<RowSelectBox value=')
    expect(files.get('components/RowSelect.tsx')).toContain('data-mb-row-select')
    expect(files.get('components/ExportMenu.tsx')).toContain("input[data-mb-row-select]:checked")
  })
})
