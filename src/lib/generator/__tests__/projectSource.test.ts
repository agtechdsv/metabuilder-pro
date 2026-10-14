import { describe, it, expect, vi } from 'vitest'
import ts from 'typescript'
import { buildProjectSource, ProjectSourceError, normalizeDbStack } from '../projectSource'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

// Supabase de mentira: cada tabela devolve as linhas dadas; encadeia select/eq/in/order e termina em single/maybeSingle/await
function fakeSupabase(data: Record<string, any>) {
  return {
    from: (table: string) => {
      const rows = data[table]
      const chain: any = {
        select: () => chain, eq: () => chain, in: () => chain, order: () => chain,
        single: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
        maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null, error: null }),
        then: (res: any) => res({ data: Array.isArray(rows) ? rows : rows ? [rows] : [], error: null }),
      }
      return chain
    },
  } as any
}

const world = (over: Record<string, any> = {}) => fakeSupabase({
  projects: { id: 'p1', slug: 'vendas', name: 'Vendas', db_type: 'oracle' },
  models: [
    { id: 'mc', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public', fields: [f('a', 'mc', 'id', 'integer', true), f('b', 'mc', 'nome', 'varchar')] },
    { id: 'mu', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public', fields: [f('c', 'mu', 'id', 'integer', true), f('d', 'mu', 'email', 'varchar'), f('e', 'mu', 'hash_senha', 'varchar'), f('g', 'mu', 'senha_md5', 'varchar')] },
  ],
  ui_views: [{ id: 'v1', slug: 'clientes', name: 'Clientes', logic_type: 'list', model_id: 'mc', layout_config: {}, ui_components: [] }],
  relations: [],
  project_enumerations: [],
  project_auth_config: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', db_password_column: 'hash_senha', db_password_hash_type: 'bcrypt', ui_config: {} },
  ...over,
})

const syntax = (src: string) => (ts.transpileModule(src, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext } }).diagnostics || []).length === 0

describe('motor único de geração do projeto', () => {
  it('sem banco escolhido, vale o do projeto (Oracle) e o login do projeto', async () => {
    const { files } = await buildProjectSource(world(), { projectId: 'p1' })
    expect(JSON.parse(files.get('package.json')!).dependencies.oracledb).toBeTruthy()
    expect(files.get('app/api/login/route.ts')).toContain('bcryptjs')
  })

  it('banco escolhido na tela vence o do projeto; nomes da IDE são normalizados', async () => {
    expect(normalizeDbStack('postgresql')).toBe('postgres')
    expect(normalizeDbStack('mssql')).toBe('sqlserver')
    const { files } = await buildProjectSource(world(), { projectId: 'p1', dbStack: 'mysql', dbConnectionString: 'mysql://u:p@h:3306/d' })
    expect(JSON.parse(files.get('package.json')!).dependencies.mysql2).toBeTruthy()
    expect(files.get('.env.local')).toContain('mysql://u:p@h:3306/d')
  })

  it('"Sem autenticação": o app não exige login (proxy deixa tudo passar)', async () => {
    const { files } = await buildProjectSource(world(), { projectId: 'p1', authStrategy: 'none' })
    const proxy = files.get('proxy.ts')!
    expect(proxy).toContain('nenhuma tela exige login')
    expect(proxy).not.toContain('verifySession')
    expect(syntax(proxy)).toBe(true)
  })

  it('LDAP / AD: login pelo servidor de diretório, com a biblioteca, as variáveis e o escape do filtro', async () => {
    const { files } = await buildProjectSource(world(), { projectId: 'p1', authStrategy: 'ldap' })
    expect(JSON.parse(files.get('package.json')!).dependencies.ldapts).toBeTruthy()
    expect(files.get('.env.local')).toContain('LDAP_URL=')
    const lib = files.get('lib/ldap.ts')!
    expect(lib).toContain("import { Client } from 'ldapts'")
    expect(lib).toContain("escapeFilter")
    expect(lib).toContain("'\\\\5c'")
    expect(syntax(lib)).toBe(true)
    const login = files.get('app/api/login/route.ts')!
    expect(login).toContain('authenticateLdap')
    expect(login).not.toContain('bcrypt')
    expect(syntax(login)).toBe(true)
  })

  it('login via banco com o mapeamento escolhido na tela (tabela, colunas e hash)', async () => {
    const { files } = await buildProjectSource(world(), {
      projectId: 'p1', authStrategy: 'legacy',
      authConfig: { legacy: { usersTable: 'usuarios', emailColumn: 'email', passwordColumn: 'senha_md5', passwordHash: 'MD5' } },
    })
    const login = files.get('app/api/login/route.ts')!
    expect(login).toContain("senha_md5")
    expect(login).toContain("createHash('md5')")
  })

  it('opções de Java chegam ao gerador: JWT, migrations, testes, Docker; Swagger e README podem ser desligados', async () => {
    const all = await buildProjectSource(world(), {
      projectId: 'p1', backendStack: 'java-spring', javaGroupId: 'com.vendas', javaPort: 8085,
      jwtEnabled: true, generateMigrations: true, generateServiceTests: true, generateDockerfile: true, generateDockerCompose: true, generateEnvExample: true,
    })
    const names = [...all.files.keys()]
    expect(names.some(p => p.includes('JwtFilter.java'))).toBe(true)
    expect(names.some(p => p.includes('db/migration'))).toBe(true)
    expect(names.some(p => p.endsWith('Dockerfile'))).toBe(true)
    expect(names).toContain('docker-compose.yml')
    expect(names.some(p => p.endsWith('OpenApiConfig.java'))).toBe(true)
    expect(names).toContain('backend/README.md')

    const lean = await buildProjectSource(world(), { projectId: 'p1', backendStack: 'java-spring', generateOpenApi: false, generateReadme: false })
    const lean2 = [...lean.files.keys()]
    expect(lean2.some(p => p.endsWith('OpenApiConfig.java'))).toBe(false)
    expect(lean2).not.toContain('backend/README.md')
    expect(lean.files.get('backend/pom.xml')).not.toContain('springdoc')
    expect(lean.files.get('backend/src/main/resources/application.properties')).not.toContain('springdoc')
    expect(names.some(p => p.includes('JwtFilter.java'))).toBe(true)
    expect([...lean.files.keys()].some(p => p.includes('JwtFilter.java'))).toBe(false)
  })

  it('projeto inexistente e gestão de acesso sem login por banco viram erros claros', async () => {
    await expect(buildProjectSource(fakeSupabase({ projects: null }), { projectId: 'x' })).rejects.toThrow(ProjectSourceError)
    await expect(buildProjectSource(world(), { projectId: 'p1', authStrategy: 'none', accessAdmin: true })).rejects.toThrow(/Banco de Dados Legado/)
  })
})
