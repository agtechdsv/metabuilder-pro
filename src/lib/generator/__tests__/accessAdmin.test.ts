import { describe, it, expect, vi } from 'vitest'
import ts from 'typescript'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'
import { generateJavaSpringProject } from '../emitter/java-spring-project'
import { accessLevelOf, writeRestrictedTables } from '../../viewAccess'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const raw = (accessUi: Record<string, any> = {}) => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  auth_config: { auth_type: 'database', table_name: 'usuarios', email_column: 'email', password_column: 'hash_senha', hash_format: 'bcrypt' },
  models: [
    { id: 'm-cli', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public' },
    { id: 'm-usr', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public' },
    { id: 'm-per', db_table_name: 'perfis', display_name: 'Perfis', db_schema_name: 'public' },
    { id: 'm-pu', db_table_name: 'perfis_usuarios', display_name: 'PerfisUsuarios', db_schema_name: 'public' },
  ],
  fields: [
    f('f1', 'm-cli', 'id', 'integer', true), f('f2', 'm-cli', 'nome', 'varchar'),
    f('f3', 'm-usr', 'id', 'integer', true), f('f4', 'm-usr', 'email', 'varchar'), f('f5', 'm-usr', 'hash_senha', 'varchar'), f('f6', 'm-usr', 'nome_completo', 'varchar'),
    f('f7', 'm-per', 'id', 'integer', true), f('f8', 'm-per', 'nome', 'varchar'),
    f('f9', 'm-pu', 'id', 'integer', true), f('f10', 'm-pu', 'usuario_id', 'integer'), f('f11', 'm-pu', 'perfil_id', 'integer'),
  ],
  relations: [],
  views: [
    { id: 'v-cli', slug: 'clientes', name: 'Clientes', logic_type: 'list', model_id: 'm-cli', layout_config: {} },
  ],
  access_admin: {
    enabled: true,
    ui: { sync_legacy_groups: true, db_groups_table: 'perfis', db_groups_name_column: 'nome', db_user_groups_type: 'n_to_n', db_user_roles_table: 'perfis_usuarios', db_user_roles_user_id_column: 'usuario_id', db_user_roles_role_id_column: 'perfil_id', db_display_name_column: 'nome_completo', ...accessUi },
    roles: [{ id: '1', name: 'Administrador' }, { id: '2', name: 'Funcionária' }],
    permissions: [
      { role_id: '2', view_id: 'v-cli', can_read: false, can_write: false },
      { role_id: '1', view_id: 'v-cli', can_read: true, can_write: false },
    ],
    userRoles: [],
  },
})

/** O código gerado precisa ser TypeScript válido (sintaxe). */
function syntaxErrors(files: Map<string, string>, paths: string[]): string[] {
  const out: string[] = []
  for (const p of paths) {
    const src = files.get(p)
    expect(src, p).toBeTruthy()
    const r = ts.transpileModule(src!, { fileName: p, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
    for (const d of r.diagnostics || []) out.push(`${p}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
  }
  return out
}

/** Executa um módulo CommonJS gerado, com os módulos que ele importa substituídos. */
function load(code: string, stubs: Record<string, any>): any {
  const module = { exports: {} as any }
  new Function('module', 'exports', 'require', code)(module, module.exports, (id: string) => {
    if (!(id in stubs)) throw new Error('módulo não previsto: ' + id)
    return stubs[id]
  })
  return module.exports
}

const ACCESS_FILES = [
  'lib/access-setup.ts', 'lib/access-control.ts', 'lib/access-guard.ts', 'app/actions/access-admin.ts',
  'app/(protected)/acesso-usuarios/page.tsx', 'app/(protected)/acesso-usuarios/UsersClient.tsx',
  'app/(protected)/acesso-grupos/page.tsx', 'app/(protected)/acesso-grupos/GroupsClient.tsx',
  'app/(protected)/acesso-permissoes/page.tsx', 'app/(protected)/acesso-permissoes/PermissionsClient.tsx',
  'app/api/login/route.ts', 'proxy.ts', 'app/(protected)/layout.tsx', 'app/components/AppSidebar.tsx',
]

describe('níveis de permissão de tela', () => {
  it('sem linha = escrita; can_read=false = nenhum; leitura quando só can_read; Automações é liberada/negada', () => {
    expect(accessLevelOf(null)).toBe('write')
    expect(accessLevelOf({ can_read: false })).toBe('none')
    expect(accessLevelOf({ can_read: true, can_write: false })).toBe('read')
    expect(accessLevelOf({ can_read: true, can_write: true })).toBe('write')
    expect(accessLevelOf(null, { defaultDeny: true })).toBe('none')
    expect(accessLevelOf({ can_read: true, can_write: false }, { defaultDeny: true })).toBe('write')
  })

  it('a tabela só fica sem gravação se o grupo não tem escrita em NENHUMA tela dela', () => {
    const views = [{ id: 'a', table: 'clientes' }, { id: 'b', table: 'clientes' }, { id: 'c', table: 'pedidos' }, { id: 'd', table: null }]
    const perms = [{ view_id: 'a', can_read: true, can_write: false }, { view_id: 'c', can_read: false, can_write: false }]
    // clientes: a é leitura mas b não tem linha (escrita) → continua gravável; pedidos: só tela negada → restrita
    expect(writeRestrictedTables(views, perms)).toEqual(['pedidos'])
  })
})

describe('gestão de acesso no app exportado', () => {
  it('sem a opção, nada de gestão de acesso é gerado (o app sai como antes)', () => {
    const r: any = raw()
    delete r.access_admin
    const files = generateNodeProject(parseMetaBuilderJSON(r, 'postgres'))
    expect(files.has('lib/access-control.ts')).toBe(false)
    expect(files.has('db/access-control.sql')).toBe(false)
    expect(files.get('app/api/login/route.ts')).not.toContain('loadAccess')
    expect(files.get('app/actions/clientes.ts')).not.toContain('assertWriteAllowed')
  })

  it('Node + PostgreSQL com grupos do banco legado (N:N): gera as 3 telas, o menu, a sessão com permissões e o bloqueio de gravação', () => {
    const ast = parseMetaBuilderJSON(raw(), 'postgres')
    const files = generateNodeProject(ast)
    expect(syntaxErrors(files, ACCESS_FILES)).toEqual([])

    // usa as tabelas do banco legado e só cria a de permissões
    const setup = files.get('lib/access-setup.ts')!
    expect(setup).toContain('"table": "perfis"')
    expect(setup).toContain('"table": "perfis_usuarios"')
    expect(setup).toContain('"synthetic": false')
    const sql = files.get('db/access-control.sql')!
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS mb_role_permissions')
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS mb_roles')
    // Funcionária (2) sem acesso a clientes; Administrador (1) em leitura; as telas de gestão só para o administrador
    expect(sql).toContain("SELECT '2', 'clientes', 'none' WHERE NOT EXISTS")
    expect(sql).toContain("SELECT '1', 'clientes', 'read' WHERE NOT EXISTS")
    expect(sql).toContain("SELECT '1', 'acesso-usuarios', 'write' WHERE NOT EXISTS")
    expect(sql).not.toContain("SELECT '2', 'acesso-usuarios'")

    // login grava as permissões na sessão assinada; proxy bloqueia a rota; menu filtra; ação de gravação confere
    expect(files.get('lib/session.ts')).toContain('acc?:')
    const login = files.get('app/api/login/route.ts')!
    expect(login).toContain('loadAccess(user)')
    expect(login).toContain('acc })')
    expect(login).toContain("'mb_acc'")
    expect(files.get('proxy.ts')).toContain('acc.no.includes(hit.slug)')
    expect(files.get('proxy.ts')).toContain('"path":"/clientes"')
    expect(files.get('app/components/AppSidebar.tsx')).toContain('mb_acc=')
    expect(files.get('app/actions/clientes.ts')).toContain('await assertWriteAllowed("clientes")')
    expect(files.get('app/actions/mbrolepermissions.ts')).toBeTruthy()
    // a pasta de gestão aparece no menu
    expect(files.get('app/(protected)/layout.tsx')).toContain('acesso-permissoes')
  })

  it('loadAccess (código gerado): grupo do usuário → telas bloqueadas, leitura e tabelas sem gravação', async () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres'))
    const compile = (p: string) => ts.transpileModule(files.get(p)!, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const perms: Record<string, any[]> = {
      '1': [{ role_id: '1', view_slug: 'clientes', access_level: 'read' }, { role_id: '1', view_slug: 'acesso-usuarios', access_level: 'write' }],
      '2': [{ role_id: '2', view_slug: 'clientes', access_level: 'none' }],
    }
    const stubs: Record<string, any> = {
      './access-setup': load(compile('lib/access-setup.ts'), {}),
      '@/app/actions/mbrolepermissions': { getMbRolePermissionsByField: async (_f: string, v: string) => perms[v] || [] },
      '@/app/actions/perfisusuarios': { getPerfisUsuariosByField: async (_f: string, v: number) => (v === 7 ? [{ usuario_id: 7, perfil_id: 1 }, { usuario_id: 7, perfil_id: 2 }] : v === 8 ? [{ usuario_id: 8, perfil_id: 2 }] : []) },
    }
    const ctl = load(compile('lib/access-control.ts'), stubs)
    // usuário 8: só Funcionária → clientes bloqueado, telas de gestão bloqueadas
    const u8 = await ctl.loadAccess({ id: 8 })
    expect(u8.no).toEqual(expect.arrayContaining(['clientes', 'acesso-usuarios', 'acesso-grupos', 'acesso-permissoes']))
    expect(u8.wt).toContain('clientes')
    // usuário 7: Administrador (leitura em clientes) + Funcionária (nenhum) → vale o maior nível: leitura; vê a gestão de usuários
    const u7 = await ctl.loadAccess({ id: 7 })
    expect(u7.ro).toEqual(['clientes'])
    expect(u7.no).not.toContain('acesso-usuarios')
    expect(u7.no).toEqual(expect.arrayContaining(['acesso-grupos', 'acesso-permissoes']))
    expect(u7.wt).toEqual(['clientes'])
    // sem grupo: nada
    expect((await ctl.loadAccess({ id: 99 })).no).toContain('clientes')
  })

  it('sem grupos do banco legado: cria também grupos e vínculo usuário-grupo', () => {
    const r: any = raw({ sync_legacy_groups: false })
    r.access_admin.userRoles = [{ external_user_id: '10', role_id: 'abc' }]
    r.access_admin.roles = [{ id: 'abc', name: 'Administradores' }]
    r.access_admin.permissions = []
    const files = generateNodeProject(parseMetaBuilderJSON(r, 'postgres'))
    expect(syntaxErrors(files, ACCESS_FILES)).toEqual([])
    const sql = files.get('db/access-control.sql')!
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS mb_roles')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS mb_user_roles')
    expect(sql).toContain("INSERT INTO mb_roles (id, name) SELECT 'abc', 'Administradores' WHERE NOT EXISTS")
    expect(sql).toContain("INSERT INTO mb_user_roles (user_id, role_id) SELECT '10', 'abc' WHERE NOT EXISTS")
  })

  it('1:N (coluna do grupo no usuário): o vínculo é a coluna, sem tabela intermediária', () => {
    const r: any = raw({ db_user_groups_type: '1_to_n', db_user_role_column: 'nome_completo' })
    const files = generateNodeProject(parseMetaBuilderJSON(r, 'postgres'))
    expect(syntaxErrors(files, ACCESS_FILES)).toEqual([])
    expect(files.get('lib/access-setup.ts')).toContain('"kind": "column"')
  })

  it('Oracle: tabelas auxiliares em maiúsculas e o script usa identidade do Oracle', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'oracle'))
    expect(syntaxErrors(files, ACCESS_FILES)).toEqual([])
    const sql = files.get('db/access-control.sql')!
    expect(sql).toContain('CREATE TABLE MB_ROLE_PERMISSIONS')
    expect(sql).toContain('GENERATED BY DEFAULT ON NULL AS IDENTITY')
    expect(files.get('lib/access-setup.ts')).toContain('"table": "MB_ROLE_PERMISSIONS"')
  })

  it.each(['mysql', 'sqlserver', 'supabase'] as const)('%s: gera sem erro de sintaxe', (db) => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), db))
    expect(syntaxErrors(files, ACCESS_FILES)).toEqual([])
    expect(files.get('db/access-control.sql')).toContain('mb_role_permissions')
  })

  it('Java Spring: o frontend recebe as telas e o guarda; o backend, as entidades das tabelas auxiliares; o SQL fica na raiz', () => {
    const files = generateJavaSpringProject(parseMetaBuilderJSON(raw({ sync_legacy_groups: false }), 'postgres', { backendStack: 'java-spring' } as any))
    const front = new Map([...files].filter(([p]) => p.startsWith('frontend/')).map(([p, c]) => [p.slice('frontend/'.length), c]))
    expect(syntaxErrors(front, ACCESS_FILES)).toEqual([])
    expect(files.has('db/access-control.sql')).toBe(true)
    expect(files.has('frontend/db/access-control.sql')).toBe(false)
    expect(files.get('frontend/app/actions/clientes.ts')).toContain('await assertWriteAllowed("clientes")')
    expect([...files.keys()].some(p => p.endsWith('/entities/MbRolePermissions.java'))).toBe(true)
    expect([...files.keys()].some(p => p.endsWith('/controllers/MbUserRolesController.java'))).toBe(true)
  })

  it('exige a tabela de usuários entre as tabelas do projeto', () => {
    const r: any = raw()
    r.auth_config.table_name = 'inexistente'
    expect(() => parseMetaBuilderJSON(r, 'postgres')).toThrow(/tabela de usuários/)
  })
})

describe('idiomas da gestão de acesso', () => {
  const generate = (lang: string) => generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres', { targetLanguage: lang } as any))

  it('os três idiomas têm as mesmas chaves e nenhum texto vazio', async () => {
    const { getAccessDictionary } = await import('../accessI18n')
    const pt = Object.keys(getAccessDictionary('pt'))
    for (const l of ['en', 'es']) {
      expect(Object.keys(getAccessDictionary(l))).toEqual(pt)
      for (const v of Object.values(getAccessDictionary(l))) expect(String(v).trim()).not.toBe('')
    }
  })

  it.each([['pt', 'Criar Usuário', 'Gestão de Acesso'], ['en', 'Create User', 'Access Management'], ['es', 'Crear Usuario', 'Gestión de Acceso']])('%s: telas, mensagens e menu no idioma, sem marcadores soltos', (lang, create, folder) => {
    const files = generate(lang)
    expect(files.get('app/(protected)/acesso-usuarios/UsersClient.tsx')).toContain(create)
    expect(files.get('app/(protected)/layout.tsx')).toContain(folder)
    for (const p of ACCESS_FILES) expect(files.get(p), p).not.toMatch(/\{\{\w+\}\}/)
    expect(syntaxErrors(files, ACCESS_FILES)).toEqual([])
  })
})

describe('criação das tabelas de acesso pelo dev', () => {
  it('Node: npm run db:setup + comandos em JSON; o script SQL é idempotente', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres', { dbConnectionString: 'postgresql://mb_agent:x@localhost:5432/crm' } as any))
    expect(JSON.parse(files.get('package.json')!).scripts['db:setup']).toBe('node scripts/setup-access.mjs')
    const plan = JSON.parse(files.get('db/access-control.json')!)
    expect(plan.tables).toContain('mb_role_permissions')
    expect(plan.statements[0]).toContain('CREATE TABLE IF NOT EXISTS mb_role_permissions')
    expect(plan.statements.every((s: string) => !s.trim().endsWith(';'))).toBe(true)
    const script = files.get('scripts/setup-access.mjs')!
    expect(script).toContain("const STACK = 'postgres'")
    // modo de conferência usado pela IDE antes de perguntar: não altera nada
    expect(script).toContain('--check')
    expect(script).toContain('MB_ACCESS_CHECK exists')
    expect(script).toContain('MB_ACCESS_CHECK missing')
    expect(syntaxErrors(new Map([['scripts/setup-access.mjs', script]]), ['scripts/setup-access.mjs'])).toEqual([])
    // quem rodar como administrador recebe a dica de liberar as tabelas para o usuário do app
    expect(files.get('db/access-control.sql')).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON mb_role_permissions TO "mb_agent"')
  })

  it('sem a gestão de acesso não há script de criação; no Java o SQL fica na raiz (sem runner Node)', () => {
    const r: any = raw(); delete r.access_admin
    const plain = generateNodeProject(parseMetaBuilderJSON(r, 'postgres'))
    expect(plain.has('scripts/setup-access.mjs')).toBe(false)
    expect(JSON.parse(plain.get('package.json')!).scripts['db:setup']).toBeUndefined()
    const java = generateJavaSpringProject(parseMetaBuilderJSON(raw(), 'postgres', { backendStack: 'java-spring' } as any))
    expect([...java.keys()].some(p => p.endsWith('setup-access.mjs'))).toBe(false)
    expect(java.has('db/access-control.sql')).toBe(true)
  })

  it('Oracle e SQL Server usam a sintaxe própria nas inserções idempotentes', () => {
    const ora = generateNodeProject(parseMetaBuilderJSON(raw(), 'oracle')).get('db/access-control.sql')!
    expect(ora).toContain('FROM DUAL WHERE NOT EXISTS')
    const mssql = generateNodeProject(parseMetaBuilderJSON(raw(), 'sqlserver')).get('db/access-control.sql')!
    expect(mssql).toContain("IF OBJECT_ID('mb_role_permissions', 'U') IS NULL")
    expect(mssql).not.toContain('FROM DUAL')
  })

  it('login sem as tabelas de acesso leva a uma mensagem que explica o que fazer (nos 3 idiomas)', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres', { targetLanguage: 'en' } as any))
    expect(files.get('app/api/login/route.ts')).toContain("'/login?error=setup'")
    expect(files.get('app/(auth)/login/page.tsx')).toContain('npm run db:setup')
    expect(files.get('app/(auth)/login/page.tsx')).toContain('The access tables do not exist')
  })
})

describe('tela só de leitura no app exportado', () => {
  it('o guarda confere também a tela de origem (referer) e as ações de gravação ficam marcadas para esconder', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres'))
    const guard = files.get('lib/access-guard.ts')!
    expect(guard).toContain("get('referer')")
    expect(guard).toContain('acc.ro.includes(screen)')
    expect(syntaxErrors(files, ['lib/access-guard.ts'])).toEqual([])
    expect([...files.values()].some(c => c.includes('data-mb-write="save"'))).toBe(true)
  })
})
