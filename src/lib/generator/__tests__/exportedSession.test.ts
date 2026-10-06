import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'

// Projeto com login pelo banco e uma regra de acesso que pede a coluna "vendedor_id" do cadastro do usuário
const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const raw = (authType: string | null = 'database') => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  ...(authType === 'database'
    ? { auth_config: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', db_password_column: 'senha', db_password_hash_type: 'plain' } }
    : {}),
  models: [
    { id: 'm-ped', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'vendas' },
    { id: 'm-usr', db_table_name: 'usuarios', display_name: 'Usuários', db_schema_name: 'vendas' },
  ],
  fields: [
    f('f1', 'm-ped', 'id', 'integer', true), f('f2', 'm-ped', 'valor', 'numeric'), f('f3', 'm-ped', 'vendedor_id', 'integer'),
    f('f4', 'm-usr', 'id', 'integer', true), f('f5', 'm-usr', 'email', 'varchar'), f('f6', 'm-usr', 'senha', 'varchar'), f('f7', 'm-usr', 'vendedor_id', 'integer'),
  ],
  relations: [],
  views: [{
    id: 'v1', slug: 'dashboard', name: 'Dashboard', logic_type: 'analytics', model_id: 'm-ped',
    layout_config: {
      analytics_config: {
        widgets: [{ id: 'w1', type: 'kpi', title: 'Total', model_id: 'm-ped', field: 'pedidos.valor', calc: 'SUM' }],
        rls: [{ id: 'r1', field: 'pedidos.vendedor_id', op: 'eq', source: 'user.attr', attr: 'vendedor_id' }],
      },
    },
  }],
})

describe('app exportado: sessão assinada', () => {
  const dir = join(__dirname, '.tmp-gen-session')
  let files: Map<string, string>
  let lib: any

  beforeAll(async () => {
    files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'session.ts'), files.get('lib/session.ts')!)
    lib = await import(/* @vite-ignore */ join(dir, 'session.ts'))
  })
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); delete process.env.MB_SESSION_SECRET })

  it('gera a biblioteca de sessão, o segredo no .env e as bibliotecas de acesso e desempenho', () => {
    expect(files.has('lib/session.ts')).toBe(true)
    expect(files.has('lib/session-server.ts')).toBe(true)
    expect(files.has('lib/bi/access.ts')).toBe(true)
    expect(files.has('lib/bi/perf.ts')).toBe(true)
    expect(files.get('.env.local')).toMatch(/^MB_SESSION_SECRET="[0-9a-f]{64}"$/m)
  })

  it('cada exportação ganha um segredo diferente', () => {
    const other = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres')).get('.env.local')!
    expect(other.match(/MB_SESSION_SECRET="([0-9a-f]+)"/)![1]).not.toBe(files.get('.env.local')!.match(/MB_SESSION_SECRET="([0-9a-f]+)"/)![1])
  })

  it('o proxy verifica a assinatura (cookie montado à mão não passa) e não aceita mais só "existe cookie"', () => {
    const proxy = files.get('proxy.ts')!
    expect(proxy).toContain("import { verifySession } from '@/lib/session'")
    expect(proxy).toContain('export async function proxy')
    expect(proxy).toContain("await verifySession(request.cookies.get('mb_session')?.value)")
    expect(proxy).not.toMatch(/if \(!session\)/)
  })

  it('o login grava uma sessão assinada com as colunas que as regras de acesso pedem', () => {
    const login = files.get('app/api/login/route.ts')!
    expect(login).toContain("import { signSession } from '@/lib/session'")
    expect(login).toContain('await signSession({ email, name: userName, attrs: attrs })')
    expect(login).toContain('["vendedor_id"]')
    expect(login).toContain("response.cookies.set('mb_session', sessionToken")
    expect(login).not.toContain("Buffer.from(email).toString('base64')")
    expect(login).toContain('/login?error=config')
  })

  it('a ação de BI usa a sessão verificada (não dados do navegador)', () => {
    const bi = files.get('app/actions/bi.ts')!
    expect(bi).toContain("import { getSessionUser } from '@/lib/session-server'")
    expect(bi).toContain('await getSessionUser()')
  })

  it('assina e verifica; o conteúdo volta íntegro', async () => {
    process.env.MB_SESSION_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres'
    const token = await lib.signSession({ email: 'ana@x.com', name: 'Ana', attrs: { vendedor_id: '7' } })
    expect(token.split('.')).toHaveLength(2)
    const user = await lib.verifySession(token)
    expect(user).toMatchObject({ email: 'ana@x.com', name: 'Ana', attrs: { vendedor_id: '7' } })
    expect(user.exp).toBeGreaterThan(Date.now() / 1000)
  })

  it('recusa cookie forjado, adulterado, de outro segredo, vazio ou o formato antigo (e-mail em base64)', async () => {
    process.env.MB_SESSION_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres'
    const token = await lib.signSession({ email: 'ana@x.com', attrs: { vendedor_id: '7' } })
    const [body, sig] = token.split('.')

    // o formato antigo: qualquer um montava
    expect(await lib.verifySession(Buffer.from('chefe@x.com').toString('base64'))).toBeNull()
    // troca o conteúdo mantendo a assinatura
    const evil = Buffer.from(JSON.stringify({ email: 'chefe@x.com', attrs: { vendedor_id: '1' }, exp: 9999999999 })).toString('base64url')
    expect(await lib.verifySession(`${evil}.${sig}`)).toBeNull()
    // assinatura alterada
    expect(await lib.verifySession(`${body}.${sig.slice(0, -2)}AA`)).toBeNull()
    // partes a mais, vazio e lixo
    expect(await lib.verifySession(`${body}.${sig}.x`)).toBeNull()
    expect(await lib.verifySession('')).toBeNull()
    expect(await lib.verifySession(undefined)).toBeNull()
    expect(await lib.verifySession('a.b')).toBeNull()
    // assinado com outro segredo
    process.env.MB_SESSION_SECRET = 'outro-segredo-completamente-diferente-123'
    expect(await lib.verifySession(token)).toBeNull()
  })

  it('sessão expira', async () => {
    process.env.MB_SESSION_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres'
    const expired = await lib.signSession({ email: 'ana@x.com' }, -10)
    expect(await lib.verifySession(expired)).toBeNull()
  })

  it('sem o segredo configurado não assina (o login responde "config") e não aceita ninguém', async () => {
    process.env.MB_SESSION_SECRET = 'segredo-de-teste-com-mais-de-16-caracteres'
    const token = await lib.signSession({ email: 'ana@x.com' })
    delete process.env.MB_SESSION_SECRET
    await expect(lib.signSession({ email: 'ana@x.com' })).rejects.toThrow(/MB_SESSION_SECRET/)
    expect(await lib.verifySession(token)).toBeNull()
    process.env.MB_SESSION_SECRET = 'curto'
    await expect(lib.signSession({ email: 'a@x.com' })).rejects.toThrow()
  })
})

describe('exportação sem autenticação do banco', () => {
  it('o login simples (mock) também grava sessão assinada', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(null), 'postgres'))
    const login = files.get('app/api/login/route.ts')!
    expect(login).toContain('await signSession({ email, name: email.split(')
    expect(login).not.toContain("Buffer.from(email).toString('base64')")
  })
})
