import { describe, it, expect, vi } from 'vitest'
import { parseWorkspaceJSON } from '../parser'
import { generateWorkspaceProject } from '../emitter/workspace-project'
import { connectionsMap } from '../workspaceData'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const project = (id: string, slug: string, name: string, dbType: string, extra: Record<string, any> = {}) => ({
  id, slug, name, description: `Sistema ${name}`, db_type: dbType,
  project: { id, name, slug },
  auth_config: { auth_type: 'database', table_name: 'usuarios', email_column: 'email', password_column: 'hash_senha' },
  models: [
    { id: id + 'c', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'public' },
    { id: id + 'u', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'public' },
  ],
  fields: [f(id + '1', id + 'c', 'id', 'integer', true), f(id + '2', id + 'c', 'nome', 'varchar'), f(id + '3', id + 'u', 'id', 'integer', true), f(id + '4', id + 'u', 'email', 'varchar'), f(id + '5', id + 'u', 'hash_senha', 'varchar')],
  relations: [],
  views: [{ id: id + 'v', slug: 'clientes', name: 'Clientes', logic_type: 'list', model_id: id + 'c', layout_config: {} }],
  ...extra,
})

const access = { enabled: true, ui: {}, roles: [{ id: 'g1', name: 'Administrador' }], permissions: [], userRoles: [] }

const build = (opts: any = {}, dbStack: any = 'auto') =>
  generateWorkspaceProject(parseWorkspaceJSON({ name: 'Kika Projetos', slug: 'kika-projetos' }, [
    project('a', 'vendas-ora', 'Vendas ORA', 'oracle'),
    project('b', 'vendas-pg', 'Vendas PG', 'postgres', { access_admin: access }),
  ], dbStack, opts))

const pkg = (files: Map<string, string>, path: string) => JSON.parse(files.get(path)!)

describe('exportação de workspace: portal + um app independente por projeto', () => {
  it('portal público com um card por projeto, apontando para a porta de cada app', () => {
    const files = build()
    const page = files.get('portal/app/page.tsx')!
    expect(page).toContain('Vendas ORA')
    expect(page).toContain('Vendas PG')
    expect(page).toContain('NEXT_PUBLIC_PROJECT_URL_VENDAS_ORA')
    expect(page).toContain("'http://localhost:3001'")
    expect(page).toContain("'http://localhost:3002'")
    // o portal não tem login nem proxy: abre sem pedir credenciais
    expect([...files.keys()].some(p => p.startsWith('portal/') && /login|proxy/.test(p))).toBe(false)
    expect(files.get('portal/.env.local')).toContain('NEXT_PUBLIC_PROJECT_URL_VENDAS_PG="http://localhost:3002"')
    expect(pkg(files, 'portal/package.json').scripts.dev).toContain('-p 3000')
  })

  it('cada projeto é um app completo, com login, sessão e banco próprios', () => {
    const files = build()
    for (const slug of ['vendas-ora', 'vendas-pg']) {
      for (const p of ['app/(auth)/login/page.tsx', 'app/api/login/route.ts', 'proxy.ts', 'lib/session.ts', '.env.local', 'package.json']) {
        expect(files.has(`apps/${slug}/${p}`), `${slug}/${p}`).toBe(true)
      }
    }
    // banco de cada projeto (modo "auto"): Oracle num, PostgreSQL no outro
    expect(files.get('apps/vendas-ora/.env.local')).toContain('DB_CONNECTION_STRING')
    expect(files.get('apps/vendas-pg/.env.local')).toContain('DATABASE_URL')
    expect(pkg(files, 'apps/vendas-ora/package.json').dependencies.oracledb).toBeTruthy()
    expect(pkg(files, 'apps/vendas-pg/package.json').dependencies.pg).toBeTruthy()
    // portas diferentes e segredos de sessão próprios
    expect(pkg(files, 'apps/vendas-ora/package.json').scripts.dev).toBe('next dev -p 3001')
    expect(pkg(files, 'apps/vendas-pg/package.json').scripts.dev).toBe('next dev -p 3002')
    const secret = (s: string) => files.get(`apps/${s}/.env.local`)!.match(/MB_SESSION_SECRET="([0-9a-f]+)"/)![1]
    expect(secret('vendas-ora')).not.toBe(secret('vendas-pg'))
    // nada de login ou proxy na raiz do workspace
    expect(files.has('proxy.ts')).toBe(false)
    expect(files.has('app/api/login/route.ts')).toBe(false)
  })

  it('a conexão de cada projeto (metabuilder.config.json) vai no .env do app dele', () => {
    const files = build({
      connections: connectionsMap([
        { projectId: 'a', type: 'oracle', connectionString: 'oracle://crm:admin@192.168.0.201:1521/FREEPDB1' },
        { projectId: 'b', type: 'postgresql', connectionString: 'postgresql://mb_agent:mb_agent@localhost:5432/crm' },
      ]),
    })
    expect(files.get('apps/vendas-ora/.env.local')).toContain('192.168.0.201')
    expect(files.get('apps/vendas-pg/.env.local')).toContain('postgresql://mb_agent:mb_agent@localhost:5432/crm')
  })

  it('gestão de acesso só no projeto que recebeu os dados', () => {
    const files = build()
    expect(files.has('apps/vendas-pg/lib/access-control.ts')).toBe(true)
    expect(files.has('apps/vendas-pg/db/access-control.sql')).toBe(true)
    expect(files.has('apps/vendas-ora/lib/access-control.ts')).toBe(false)
  })

  it('Java Spring: cada projeto vira frontend + backend, com portas próprias e CORS do frontend certo', () => {
    const files = build({ backendStack: 'java-spring', javaPort: 8080 })
    expect(files.has('apps/vendas-ora/backend/pom.xml')).toBe(true)
    expect(files.has('apps/vendas-pg/frontend/package.json')).toBe(true)
    expect(files.get('apps/vendas-ora/frontend/.env.local')).toContain('NEXT_PUBLIC_API_URL=http://localhost:8080')
    expect(files.get('apps/vendas-pg/frontend/.env.local')).toContain('NEXT_PUBLIC_API_URL=http://localhost:8081')
    expect(files.get('apps/vendas-pg/backend/src/main/resources/application.properties')).toContain('http://localhost:3002')
    expect(pkg(files, 'apps/vendas-pg/frontend/package.json').scripts.dev).toBe('next dev -p 3002')
    expect(pkg(files, 'package.json').scripts['dev:vendas-pg']).toContain('apps/vendas-pg/frontend')
  })

  it('escolha única de banco continua valendo para todos os projetos', () => {
    const files = build({}, 'mysql')
    expect(pkg(files, 'apps/vendas-ora/package.json').dependencies.mysql2).toBeTruthy()
    expect(pkg(files, 'apps/vendas-pg/package.json').dependencies.mysql2).toBeTruthy()
  })

  it('idioma do portal segue o idioma de geração', () => {
    expect(build({ targetLanguage: 'en' }).get('portal/app/page.tsx')).toContain('Application Portal')
    expect(build({ targetLanguage: 'es' }).get('portal/app/page.tsx')).toContain('Portal de Aplicaciones')
  })

  it('README e scripts da raiz explicam como rodar', () => {
    const files = build()
    expect(files.get('README.md')).toContain('npm run install:all')
    const scripts = pkg(files, 'package.json').scripts
    expect(scripts['install:all']).toContain('--prefix apps/vendas-ora')
    expect(scripts['dev:portal']).toBeTruthy()
  })
})
