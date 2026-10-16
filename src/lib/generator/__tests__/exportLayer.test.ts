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

const BUTTONS = (exportVisible: boolean) => [
  { id: 'search', visible: true }, { id: 'clear', visible: true }, { id: 'view', visible: true },
  { id: 'create', visible: true }, { id: 'edit', visible: true }, { id: 'delete', visible: true },
  { id: 'export', visible: exportVisible, custom_label: 'Exportar Dados' },
]
const world = (exportVisible: boolean, formats?: string[]) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome_empresa', 'varchar'), f('c', 'mc', 'cnpj_cpf', 'varchar')] },
  ],
  ui_views: [{
    id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'pesquisa_cadastro', model_id: 'mc',
    buttons_config: BUTTONS(exportVisible),
    layout_config: formats ? { export_formats: formats } : {},
    ui_components: ['a', 'b', 'c'].map((id, i) => ({ id: 'u' + i, field_id: id, is_visible: true, order_index: i, config: {} })),
  }],
  relations: [], project_enumerations: [], project_auth_config: null,
})
const gen = async (exportVisible = true, formats?: string[]) =>
  (await buildProjectSource(world(exportVisible, formats), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'none' } as any)).files

/** Executa um módulo TypeScript gerado, trocando os imports pelos módulos de mentira. */
function load(src: string, mods: Record<string, any>) {
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
  const m: any = { exports: {} }
  new Function('module', 'exports', 'require', js)(m, m.exports, (name: string) => {
    if (!(name in mods)) throw new Error('módulo não previsto: ' + name)
    return mods[name]
  })
  return m.exports
}

describe('exportação de dados do app gerado', () => {
  it('só existe onde o botão Exportar está ligado no Studio, com os formatos que o dev liberou', async () => {
    const on = await gen(true, ['xlsx', 'csv'])
    for (const p of ['lib/export-registry.ts', 'app/api/export/[slug]/route.ts', 'components/ExportMenu.tsx', 'app/(protected)/clientes/export-data.ts']) {
      expect(on.get(p), p).toBeTruthy()
      expect(syntax(on.get(p)!), p).toBe(true)
    }
    expect(on.get('lib/export-registry.ts')).toContain('formats: ["xlsx","csv"]')
    expect(JSON.parse(on.get('package.json')!).dependencies.exceljs).toBeTruthy()
    const list = on.get('app/(protected)/clientes/page.tsx')!
    expect(syntax(list)).toBe(true)
    expect(list).toContain('<ExportMenu slug="clientes" formats={["xlsx","csv"]} label="Exportar Dados" />')
    // o botão que não fazia nada saiu
    expect(list).not.toContain('<Download className="w-4 h-4 text-neutral-400" /> Exportar Dados')
    const edit = on.get('app/(protected)/clientes/[id]/DetailTabsClient.tsx')!
    expect(syntax(edit)).toBe(true)
    expect(edit).toContain('<ExportMenu slug="clientes"')
    expect(edit).toContain('recordId={id}')
    expect(edit).not.toContain('Automações')

    const off = await gen(false)
    expect(off.get('lib/export-registry.ts')).toBeUndefined()
    expect(off.get('app/api/export/[slug]/route.ts')).toBeUndefined()
    expect(JSON.parse(off.get('package.json')!).dependencies.exceljs).toBeUndefined()
    expect(off.get('app/(protected)/clientes/page.tsx')).not.toContain('ExportMenu')
    expect(off.get('app/(protected)/clientes/[id]/DetailTabsClient.tsx')).not.toContain('ExportMenu')
  })

  it('os dados exportados respeitam filtros, ordenação e registro (execução do código gerado)', async () => {
    const files = await gen(true)
    const data = load(files.get('app/(protected)/clientes/export-data.ts')!, {
      '@/app/actions/clientes': {
        getClientesList: async () => [
          { id: 1, nome_empresa: 'Beta', cnpj_cpf: '2' },
          { id: 2, nome_empresa: 'Alfa', cnpj_cpf: '1' },
          { id: 3, nome_empresa: 'Gama', cnpj_cpf: '3' },
        ],
      },
    })
    expect(data.EXPORT_COLUMNS.map((c: any) => c.key)).toEqual(['id', 'nome_empresa', 'cnpj_cpf'])
    const sorted = await data.getExportRows({ sort_by: 'nome_empresa', sort_order: 'asc' })
    expect(sorted.map((r: any) => r.nome_empresa)).toEqual(['Alfa', 'Beta', 'Gama'])
    const filtered = await data.getExportRows({ nome_empresa_filter: 'am' })
    expect(filtered.map((r: any) => r.nome_empresa)).toEqual(['Gama'])
    const one = await data.getExportRows({}, ['2'])
    expect(one.map((r: any) => r.nome_empresa)).toEqual(['Alfa'])
  })

  it('a rota entrega CSV e JSON, recusa formato não liberado e tela desconhecida', async () => {
    const files = await gen(true, ['csv', 'json'])
    const rows = [{ id: 1, nome_empresa: 'A;B', cnpj_cpf: '1' }]
    const registry = {
      EXPORT_REGISTRY: {
        clientes: { title: 'Clientes', formats: ['csv', 'json'], load: async () => ({ EXPORT_COLUMNS: [{ key: 'id', label: 'Id' }, { key: 'nome_empresa', label: 'Nome' }], getExportRows: async () => rows }) },
      },
    }
    class FakeResponse { constructor(public body: any, public init: any = {}) {} static json(b: any, init: any = {}) { return new FakeResponse(JSON.stringify(b), init) } }
    const route = load(files.get('app/api/export/[slug]/route.ts')!, { 'next/server': { NextResponse: FakeResponse }, '@/lib/export-registry': registry })
    const call = (slug: string, q: string) => route.GET({ url: 'http://x/api/export/' + slug + '?' + q }, { params: Promise.resolve({ slug }) })
    const csv: any = await call('clientes', 'format=csv')
    expect(csv.body).toBe('﻿Id;Nome\r\n1;"A;B"')
    expect(csv.init.headers['Content-Disposition']).toMatch(/attachment; filename="clientes-\d{4}-\d{2}-\d{2}\.csv"/)
    const json: any = await call('clientes', 'format=json')
    expect(JSON.parse(json.body)).toEqual(rows)
    expect((await call('clientes', 'format=xlsx') as any).init.status).toBe(400)
    expect((await call('nada', 'format=csv') as any).init.status).toBe(404)
  })

  it('com login, a rota exige sessão e o acesso à tela', async () => {
    const w = world(true)
    const withAuth = (await buildProjectSource(w, { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', authStrategy: 'legacy' } as any)).files
    const route = withAuth.get('app/api/export/[slug]/route.ts')!
    expect(route).toContain("import { getSessionUser } from '@/lib/session-server'")
    expect(route).toContain('status: 401')
    expect(route).toContain('user.acc?.no.includes(slug)')
    expect((await gen(true)).get('app/api/export/[slug]/route.ts')).not.toContain('getSessionUser')
  })
})
