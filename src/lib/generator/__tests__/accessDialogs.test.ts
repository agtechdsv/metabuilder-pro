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
const world = (nameCol: string | null) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome', 'varchar')] },
    { id: 'mu', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public', fields: [f('c', 'mu', 'id', 'integer', true), f('d', 'mu', 'email', 'varchar'), f('e', 'mu', 'nome', 'varchar'), f('g', 'mu', 'hash_senha', 'varchar')] },
  ],
  ui_views: [{ id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'list', model_id: 'mc', layout_config: {}, ui_components: [] }],
  relations: [],
  project_enumerations: [],
  project_auth_config: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', db_password_column: 'hash_senha', db_password_hash_type: 'bcrypt', ui_config: nameCol ? { db_display_name_column: nameCol } : {} },
})
const syntax = (src: string) => (ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext } }).diagnostics || []).length === 0

describe('telas de gestão de acesso: janelas do app no lugar dos prompt/confirm do navegador', () => {
  it('usuários e grupos usam o diálogo do app (Esc fecha, erro dentro da janela) e nenhuma janela nativa do navegador', async () => {
    const { files } = await buildProjectSource(world('nome'), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', accessAdmin: true } as any)
    const users = files.get('app/(protected)/acesso-usuarios/UsersClient.tsx')!
    const groups = files.get('app/(protected)/acesso-grupos/GroupsClient.tsx')!
    const dialog = files.get('components/AccessDialog.tsx')!
    for (const src of [users, groups]) {
      expect(src).not.toMatch(/window\.(prompt|confirm)|\balert\(/)
      expect(src).toContain("from '@/components/AccessDialog'")
      expect(src).not.toMatch(/\{\{\w+\}\}/)
      expect(syntax(src)).toBe(true)
    }
    expect(syntax(dialog)).toBe(true)
    expect(dialog).toContain("e.key === 'Escape'")
    // usuário: criar, editar, redefinir senha (com confirmação) e excluir
    for (const kind of ["kind: 'create'", "kind: 'edit'", "kind: 'password'", "kind: 'delete'"]) expect(users).toContain(kind)
    expect(users).toContain('updateUser(u.id')
    expect(users).toContain('Pencil')
    // grupo: criar, renomear e excluir
    for (const kind of ["kind: 'create'", "kind: 'rename'", "kind: 'delete'"]) expect(groups).toContain(kind)
    // a ação de editar usuário existe, confere o e-mail e só mexe no nome se a tabela tem coluna de nome
    const actions = files.get('app/actions/access-admin.ts')!
    expect(actions).toContain('export async function updateUser(')
    expect(actions).toContain('Informe o e-mail.')
    expect(files.get('app/(protected)/acesso-usuarios/page.tsx')).toContain('hasName={!!ACCESS_SETUP.nameCol}')
  })

  it('textos novos existem nos três idiomas e o diálogo sai no idioma de geração', async () => {
    const en = await buildProjectSource(world('nome'), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', accessAdmin: true, targetLanguage: 'en' } as any)
    const users = en.files.get('app/(protected)/acesso-usuarios/UsersClient.tsx')!
    expect(users).toContain('Edit User')
    expect(users).toContain('Reset Password')
    expect(users).toContain('The passwords do not match.')
    expect(en.files.get('app/(protected)/acesso-grupos/GroupsClient.tsx')).toContain('This action cannot be undone.')
  })
})
