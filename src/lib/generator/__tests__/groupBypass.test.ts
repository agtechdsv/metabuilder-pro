import { describe, it, expect, vi } from 'vitest'
import ts from 'typescript'
import { buildProjectSource } from '../projectSource'
import { cleanRowPolicy, resolveAccess } from '../../rowPolicy/policy'
import { cleanRlsRules, rlsAccess, bypassMatches } from '../../bi/access'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

/**
 * Exceção "por grupo" das regras de acesso por linha: quem está num dos grupos da lista não sofre a regra.
 * Núcleo (regras), app Node exportado (login guarda os nomes dos grupos na sessão) e backend Java (grupos no JWT).
 */
const regra = { id: 'r1', column: 'criado_por', op: 'eq', source: 'user.attr', attr: 'id', bypass: { source: 'user.group', values: ['Administrador', 'Gerente'] } }
const cfg = (policy: unknown) => [{ table: 'clientes', canCreate: true, canUpdate: true, canDelete: true, policy, audit: null, closed: false }] as any

describe('exceção por grupo — núcleo', () => {
  it('aceita user.group na lista de exceção e descarta fonte inventada', () => {
    expect(cleanRowPolicy({ rules: [regra] })!.rules[0].bypass).toEqual({ source: 'user.group', values: ['Administrador', 'Gerente'] })
    expect(cleanRowPolicy({ rules: [{ ...regra, bypass: { source: 'user.inventada', values: ['x'] } }] })!.rules[0].bypass).toBeUndefined()
    // o grupo não serve como fonte da própria regra (só da exceção)
    expect(cleanRowPolicy({ rules: [{ ...regra, source: 'user.group' }] })).toBeNull()
  })

  it('quem está em um dos grupos da lista não sofre a regra; os demais continuam filtrados', () => {
    const policy = cleanRowPolicy({ rules: [regra] })
    const viewer = (groups: string[] | null) => ({ email: 'a@x.com', attrs: { id: 'u-1' }, ...(groups === null ? {} : { groups }) })
    const filtrado = (v: any) => resolveAccess(cfg(policy), v).policies.length
    expect(filtrado(viewer(['Administrador']))).toBe(0)           // exceção
    expect(filtrado(viewer(['gerente']))).toBe(0)                 // sem diferenciar maiúsculas
    expect(filtrado(viewer(['Funcionária', 'Gerente']))).toBe(0)  // vários grupos: basta um
    expect(filtrado(viewer(['Funcionária']))).toBe(1)             // outro grupo: filtrado
    expect(filtrado(viewer([]))).toBe(1)
    expect(filtrado(viewer(null))).toBe(1)                        // sem informação de grupo: falha fechada
  })

  it('o BI usa a mesma exceção por grupo', () => {
    const rules = cleanRlsRules([{ id: 'b1', field: 'pedidos.vendedor', op: 'eq', source: 'user.email', bypass: { source: 'user.group', values: ['Administrador'] } }])
    expect(rules[0].bypass).toEqual({ source: 'user.group', values: ['Administrador'] })
    expect(rlsAccess(rules, { email: 'a@x.com', groups: ['Administrador'] }).conditions).toEqual([])
    expect(rlsAccess(rules, { email: 'a@x.com', groups: ['Funcionária'] }).conditions).toHaveLength(1)
    expect(bypassMatches({ source: 'user.group', values: ['Administrador'] }, { groups: ['Funcionária'] })).toBe(false)
  })
})

// ───────────────────────── app Node: o login guarda os nomes dos grupos ─────────────────────────
const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })
function fakeSupabase(data: Record<string, any>) {
  return { from: (table: string) => { const rows = data[table]; const chain: any = {
    select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }) }; return chain } } as any
}
const world = (models: any[] = []) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public',
      row_policy: { rules: [regra] },
      fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome', 'varchar'), f('c', 'mc', 'criado_por', 'integer')] },
    { id: 'mu', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public', fields: [f('d', 'mu', 'id', 'integer', true), f('e', 'mu', 'email', 'varchar'), f('g', 'mu', 'hash_senha', 'varchar')] },
    ...models,
  ],
  ui_views: [{ id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'list', model_id: 'mc', layout_config: {}, ui_components: [] }],
  relations: [], project_enumerations: [],
  project_auth_config: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', db_password_column: 'hash_senha', db_password_hash_type: 'bcrypt', ui_config: {} },
})
const transpile = (src: string) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText
function load(src: string, mods: Record<string, any>) {
  const m: any = { exports: {} }
  new Function('module', 'exports', 'require', transpile(src))(m, m.exports, (name: string) => {
    if (!(name in mods)) throw new Error('módulo não previsto: ' + name)
    return mods[name]
  })
  return m.exports
}

describe('exceção por grupo — app Node exportado', () => {
  it('o login calcula os nomes dos grupos do usuário e a regra por linha os usa', async () => {
    const { files } = await buildProjectSource(world(), { projectId: 'p1', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', accessAdmin: true } as any)

    // quem está vendo (acesso por tabela) leva os grupos da sessão
    expect(files.get('app/actions/access.ts')).toContain('groups: u.acc?.gr ?? []')
    expect(files.get('lib/session.ts')).toContain('gr?: string[]')
    // e a regra exportada guarda a exceção por grupo
    expect(files.get('app/actions/access-registry.ts')).toContain('"user.group"')

    // executa o loadAccess gerado: usuário 1 está em dois grupos; os nomes voltam em `gr`
    const setupSrc = files.get('lib/access-setup.ts')!
    const S = load(setupSrc, {}).ACCESS_SETUP
    const key = (m: string) => '@/app/actions/' + m.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '')
    const pm = S.perms.model, gm = S.groups.model
    const grupos = [{ [S.groups.pk]: 10, [S.groups.nameCol]: 'Administrador' }, { [S.groups.pk]: 20, [S.groups.nameCol]: 'Funcionária' }, { [S.groups.pk]: 30, [S.groups.nameCol]: 'Outro' }]
    let vinculos: any[] = [{ [S.link.roleCol]: 10 }, { [S.link.roleCol]: 20 }] // grupos do usuário (muda no fim do teste)
    const mods: Record<string, any> = {
      './access-setup': { ACCESS_SETUP: S },
      [key(pm)]: { ['get' + pm + 'ByField']: async () => [] },
      [key(gm)]: { ['get' + gm + 'List']: async () => grupos },
    }
    if (S.link.kind === 'table') {
      mods[key(S.link.model)] = {
        ['get' + S.link.model + 'List']: async () => [],
        ['get' + S.link.model + 'ByField']: async () => vinculos,
        ['create' + S.link.model]: async () => ({}), ['delete' + S.link.model]: async () => ({}),
      }
    }
    const control = load(files.get('lib/access-control.ts')!, mods)
    const info = await control.loadAccess({ [S.usersPk]: 1, email: 'a@x.com' })
    expect(info.gr.sort()).toEqual(['Administrador', 'Funcionária'])
    // usuário sem grupo: lista vazia (a regra volta a valer)
    vinculos = []
    expect((await control.loadAccess({ [S.usersPk]: 2 })).gr).toEqual([])
  })
})

// ───────────────────────── backend Java: grupos no JWT ─────────────────────────
describe('exceção por grupo — backend Java', () => {
  it('o frontend assina os grupos no JWT e o backend confere a exceção por grupo', async () => {
    const { files } = await buildProjectSource(world(), { projectId: 'p1', backendStack: 'java-spring', javaGroupId: 'com.vendas', dbStack: 'postgres', dbConnectionString: 'postgresql://u:p@h:5432/d', jwtEnabled: true, accessAdmin: true } as any)
    expect(files.get('frontend/lib/api-client.ts')).toContain('groups: u.acc?.gr ?? []')
    const current = files.get('backend/src/main/java/com/vendas/access/CurrentUser.java')!
    expect(current).toContain('List<String> groups')
    expect(current).toContain('claims.get("groups")')
    const rules = files.get('backend/src/main/java/com/vendas/access/AccessRules.java')!
    expect(rules).toContain('"user.group".equals(rule.bypass().source())')
  })
})
