import { describe, it, expect, vi } from 'vitest'
import ts from 'typescript'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

/**
 * Trocar o grupo de um usuário (ou excluí-lo) na gestão de acesso do app exportado NÃO pode apagar o vínculo dos outros usuários.
 * Bug achado pelos testes de ponta a ponta no banco real: a tabela de ligação (perfis_usuarios) tem chave composta e a exclusão era
 * feita só pela coluna "perfil_id" (DELETE ... WHERE perfil_id = ?), levando junto todos os usuários daquele grupo.
 */
const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const raw = (stack: 'postgres' | 'oracle' | 'mysql' | 'sqlserver') => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  auth_config: { auth_type: 'database', table_name: 'usuarios', email_column: 'email', password_column: 'hash_senha', hash_format: 'bcrypt' },
  models: [
    { id: 'm-usr', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public' },
    { id: 'm-per', db_table_name: 'perfis', display_name: 'Perfis', db_schema_name: 'public' },
    { id: 'm-pu', db_table_name: 'perfis_usuarios', display_name: 'PerfisUsuarios', db_schema_name: 'public' },
  ],
  fields: [
    f('f3', 'm-usr', 'id', 'uuid', true), f('f4', 'm-usr', 'email', 'text'), f('f5', 'm-usr', 'hash_senha', 'text'),
    f('f7', 'm-per', 'id', 'uuid', true), f('f8', 'm-per', 'nome', 'text'),
    // chave composta: nenhuma das duas colunas sozinha identifica a linha
    f('f10', 'm-pu', 'usuario_id', 'uuid', true), f('f11', 'm-pu', 'perfil_id', 'uuid', true),
  ],
  relations: [], views: [],
  access_admin: {
    enabled: true,
    ui: { sync_legacy_groups: true, db_groups_table: 'perfis', db_groups_name_column: 'nome', db_user_groups_type: 'n_to_n', db_user_roles_table: 'perfis_usuarios', db_user_roles_user_id_column: 'usuario_id', db_user_roles_role_id_column: 'perfil_id' },
    roles: [{ id: 'g1', name: 'Administrador' }], permissions: [], userRoles: [],
  },
  _stack: stack,
})

const run = (src: string, stubs: Record<string, any>) => {
  const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const m: any = { exports: {} }
  new Function('module', 'exports', 'require', code)(m, m.exports, (id: string) => {
    if (!(id in stubs)) throw new Error('módulo não previsto: ' + id)
    return stubs[id]
  })
  return m.exports
}

describe('gestão de acesso: trocar o grupo não apaga o vínculo dos outros usuários', () => {
  it('a troca de grupo apaga só o par usuário + grupo (nunca pela coluna do grupo sozinha)', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw('postgres'), 'postgres'))
    const actions = files.get('app/actions/access-admin.ts')!
    expect(actions).toContain('linkDeleteWhere({ [L.userCol]: userId, [L.roleCol]: str(pick(r, L.roleCol)) })')
    // sem o código próprio por linha, a exclusão pelo código do grupo é recusada
    expect(actions).toContain('L.pk !== L.userCol && L.pk !== L.roleCol')
  })

  it('Postgres: DELETE com as duas colunas e os valores como parâmetros', async () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw('postgres'), 'postgres'))
    const src = files.get('app/actions/perfisusuarios.ts')!
    expect(src).toContain('deletePerfisUsuariosWhere')
    const calls: Array<{ sql: string; params: unknown[] }> = []
    const mod = run(src, {
      './db': { query: async (sql: string, params: unknown[]) => { calls.push({ sql, params }); return { rows: [] } } },
      'next/cache': { revalidatePath: () => {} },
      '@/lib/access-guard': { assertWriteAllowed: async () => {}, assertCan: async () => {} },
      './access': { secureSelect: async (s: string) => s, secureWrite: async () => ({}), secureCustom: async (s: string) => s, assertCan: async () => {} },
    })
    const res = await mod.deletePerfisUsuariosWhere({ usuario_id: 'u-1', perfil_id: 'g-1' })
    expect(res).toEqual({ success: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].sql).toMatch(/DELETE FROM .*perfis_usuarios.* WHERE "usuario_id" = \$1 AND "perfil_id" = \$2$/)
    expect(calls[0].params).toEqual(['u-1', 'g-1'])
    // coluna que não existe na tabela ou filtro vazio: recusa, sem tocar no banco
    expect((await mod.deletePerfisUsuariosWhere({ 'perfil_id; drop table x': 1 })).success).toBe(false)
    expect((await mod.deletePerfisUsuariosWhere({})).success).toBe(false)
    expect(calls).toHaveLength(1)
  })

  it('Oracle: o UPDATE grava o que o controle de acesso devolve (com atualizado_por/em), não a lista de colunas de antes', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw('oracle'), 'oracle'))
    const src = files.get('app/actions/usuarios.ts')!
    expect(src).toContain("const clean = (await secureWrite({ action: 'update'")
    // as colunas do SET vêm do resultado do secureWrite (onde a auditoria foi aplicada)
    const apartirDoUpdate = src.slice(src.indexOf('export async function updateUsuarios'))
    expect(apartirDoUpdate.indexOf("const clean = (await secureWrite({ action: 'update'")).toBeLessThan(apartirDoUpdate.indexOf('const keys = Object.keys(clean)'))
  })

  it('as outras pilhas (Oracle, MySQL, SQL Server) também têm a exclusão por filtro', () => {
    for (const stack of ['oracle', 'mysql', 'sqlserver'] as const) {
      const files = generateNodeProject(parseMetaBuilderJSON(raw(stack), stack))
      const src = files.get('app/actions/perfisusuarios.ts')!
      expect(src, stack).toContain('deletePerfisUsuariosWhere')
      const syntax = ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext } }).diagnostics || []
      expect(syntax, stack).toHaveLength(0)
    }
  })
})
