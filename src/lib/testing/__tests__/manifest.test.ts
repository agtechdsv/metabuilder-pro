import { describe, it, expect } from 'vitest'
import { loadProjectAst } from '../../generator/projectSource'
import { buildTestManifest } from '../manifest'

/**
 * O manifesto de testes descreve cada caso de uso como o dev o configurou no Studio. Sai do mesmo AST da exportação (loadProjectAst), então se o
 * manifesto está certo, os testes gerados a partir dele conferem exatamente o que o app exportado deve ter.
 */
const f = (id: string, col: string, type: string, extra: Record<string, unknown> = {}) => ({ id, model_id: 'mc', db_column_name: col, display_name: col, data_type: type, ...extra })

function fakeSupabase(data: Record<string, any>) {
  return { from: (table: string) => { const rows = data[table]; const chain: any = {
    select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
    single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
    then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }) }; return chain } } as any
}

const comp = (id: string, field: string, i: number, config: Record<string, unknown> = {}) => ({ id, field_id: field, is_visible: true, order_index: i, config })

const world = () => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'postgres' },
  models: [{
    id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public',
    fields: [
      f('a', 'id', 'uuid', { is_primary_key: true, is_nullable: false }),
      f('b', 'nome_empresa', 'varchar', { is_nullable: false, default_value: null }),
      f('c', 'cnpj_cpf', 'varchar', { is_nullable: true }),
      f('d', 'status_lead', 'varchar', { is_nullable: false, default_value: "'Novo'" }),
    ],
  }],
  ui_views: [{
    id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'pesquisa_cadastro', model_id: 'mc', status: 'published',
    layout_config: { filter_fields: ['b', 'd'], export_formats: ['csv', 'xlsx'] },
    ui_components: [
      comp('u1', 'b', 0, { zones: ['filter', 'grid', 'form'] }),
      comp('u2', 'c', 1, { zones: ['grid', 'form'], mask: '00.000.000/0000-00' }),
      comp('u3', 'd', 2, { zones: ['filter', 'grid', 'form'], options: [{ value: 'Novo', label: 'Novo' }, { value: 'Fechado', label: 'Fechado' }] }),
    ],
  }],
  relations: [], project_enumerations: [], project_auth_config: null,
})

describe('manifesto de testes a partir do projeto', () => {
  it('descreve o caso de uso: tela, tabela, campos de cada zona, máscara, obrigatórios e opções', async () => {
    const { ast } = await loadProjectAst(world(), { projectId: 'p1', dbStack: 'postgres' })
    const m = buildTestManifest(ast, { now: new Date('2026-10-19T00:00:00Z') })
    expect(m.version).toBe(1)
    expect(m.project).toMatchObject({ id: 'p1', slug: 'vendas' })
    expect(m.dbStack).toBe('postgres')
    const v = m.views.find(x => x.slug === 'clientes')!
    expect(v).toMatchObject({ path: '/clientes', logicType: 'pesquisa_cadastro', table: 'clientes', primaryKey: 'id' })
    expect(v.filter.map(x => x.column)).toEqual(['nome_empresa', 'status_lead'])
    expect(v.grid.map(x => x.column)).toEqual(['nome_empresa', 'cnpj_cpf', 'status_lead'])
    const form = Object.fromEntries(v.form.map(x => [x.column, x]))
    expect(form.nome_empresa.required).toBe(true)           // NOT NULL sem padrão
    expect(form.cnpj_cpf.required).toBe(false)              // aceita nulo
    expect(form.status_lead.required).toBe(false)           // NOT NULL, mas com valor padrão
    expect(form.cnpj_cpf.mask).toBe('00.000.000/0000-00')
    expect(form.status_lead.options?.map(o => o.value)).toEqual(['Novo', 'Fechado'])
    expect(v.exportFormats).toEqual(['csv', 'xlsx'])
  })

  it('traz as permissões da tabela e a regra por linha do Studio', async () => {
    const mundo = world()
    const { ast } = await loadProjectAst(mundo, { projectId: 'p1', dbStack: 'postgres' })
    const modelo = ast.models.find(m => m.dbTable === 'clientes')!
    // padrão: tudo permitido e sem regra por linha
    const padrao = buildTestManifest(ast).views[0]
    expect(padrao.tablePerms).toEqual({ create: true, update: true, delete: true })
    expect(padrao.rowPolicy).toBeUndefined()
    modelo.canDelete = false
    modelo.rowPolicy = { rules: [{ id: 'r1', column: 'criado_por', op: 'eq', source: 'user.attr', attr: 'id', bypass: { source: 'user.group', values: ['Administrador'] } }] }
    const v = buildTestManifest(ast).views[0]
    expect(v.tablePerms).toEqual({ create: true, update: true, delete: false })
    expect(v.rowPolicy).toEqual([{ column: 'criado_por', op: 'eq', source: 'user.attr', attr: 'id', bypass: { source: 'user.group', values: ['Administrador'] } }])
  })

  it('pode ser pedido só para alguns casos de uso (pelo slug)', async () => {
    const { ast } = await loadProjectAst(world(), { projectId: 'p1', dbStack: 'postgres' })
    expect(buildTestManifest(ast, { viewSlugs: ['nao-existe'] }).views).toEqual([])
    expect(buildTestManifest(ast, { viewSlugs: ['clientes'] }).views).toHaveLength(1)
  })
  it('traz a configuração de login (tabela de usuários, colunas, hash e, com gestão de acesso, grupos e vínculo)', async () => {
    const { ast } = await loadProjectAst(world(), { projectId: 'p1', dbStack: 'postgres' })
    expect(buildTestManifest(ast).auth).toMatchObject({ type: 'none' })
    const comLogin = { ...ast, authConfig: { authType: 'database', tableName: 'usuarios', emailColumn: 'email', passwordColumn: 'hash_senha', hashFormat: 'BCRYPT' } }
    expect(buildTestManifest(comLogin as any).auth).toEqual({ type: 'database', usersTable: 'usuarios', emailColumn: 'email', passwordColumn: 'hash_senha', hash: 'bcrypt' })
    const comAcesso = { ...comLogin, accessAdmin: {
      usersModel: 'Usuarios', usersTable: 'usuarios', usersPk: 'id', emailCol: 'email', passCol: 'hash_senha', nameCol: 'nome_completo', hash: 'bcrypt',
      groups: { model: 'Perfis', table: 'perfis', pk: 'id', nameCol: 'nome', synthetic: false },
      link: { kind: 'table', model: 'PerfisUsuarios', table: 'perfis_usuarios', pk: 'id', userCol: 'usuario_id', roleCol: 'perfil_id', synthetic: false },
      perms: { model: 'P', table: 'mb_role_permissions', pk: 'id', roleCol: 'role_id', viewCol: 'view_slug', levelCol: 'access_level' }, views: [], seed: { roles: [], permissions: [], userRoles: [] },
    } }
    const a = buildTestManifest(comAcesso as any).auth!
    expect(a.access).toEqual({ groupsTable: 'perfis', groupsPk: 'id', groupsNameColumn: 'nome', link: { kind: 'table', table: 'perfis_usuarios', userColumn: 'usuario_id', roleColumn: 'perfil_id' }, permsTable: 'mb_role_permissions', permsRoleColumn: 'role_id', permsViewColumn: 'view_slug', permsLevelColumn: 'access_level' })
    expect(a.nameColumn).toBe('nome_completo')
  })
})
