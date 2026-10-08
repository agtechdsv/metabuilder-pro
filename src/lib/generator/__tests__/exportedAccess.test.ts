import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'
import { generateNativeProject } from '../emitter/single-project'
import { ACCESS_RUNTIME_FILES } from '../biRuntimeFiles.generated'
import { writeGeneratedAccess } from './generatedAccess'

// Fatia 4 da segurança: o app exportado aplica as permissões das tabelas e as regras por linha do usuário final, e as actions
// geradas não aceitam mais nomes de coluna, limite ou operador crus do navegador.
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const POLICY = { rules: [{ id: 'r1', column: 'vendedor_id', op: 'eq', source: 'user.attr', attr: 'vendedor_id', bypass: { source: 'user.attr', attr: 'perfil', values: ['admin'] } }] }

const raw = (over: { pedidos?: Record<string, any>; clientes?: Record<string, any> } = {}) => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  auth_config: { auth_type: 'database', table_name: 'usuarios', email_column: 'email', password_column: 'hash_senha' },
  models: [
    { id: 'm-ped', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'vendas', can_delete: false, row_policy: POLICY, ...over.pedidos },
    { id: 'm-cli', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'vendas', ...over.clientes },
    { id: 'm-usr', db_table_name: 'usuarios', display_name: 'Usuarios', db_schema_name: 'vendas' },
  ],
  fields: [
    f('f1', 'm-ped', 'id', 'integer', true), f('f2', 'm-ped', 'status', 'varchar'), f('f3', 'm-ped', 'vendedor_id', 'integer'), f('f4', 'm-ped', 'data_pedido', 'date'), f('f10', 'm-ped', 'criado_em', 'timestamp'), f('f11', 'm-ped', 'criado_por', 'uuid'), f('f12', 'm-ped', 'atualizado_em', 'timestamp'), f('f13', 'm-ped', 'atualizado_por', 'uuid'),
    f('f5', 'm-cli', 'id', 'integer', true), f('f6', 'm-cli', 'nome', 'varchar'),
    f('f7', 'm-usr', 'id', 'integer', true), f('f8', 'm-usr', 'email', 'varchar'), f('f9', 'm-usr', 'hash_senha', 'varchar'),
  ],
  relations: [],
  views: [{ id: 'v1', slug: 'pedidos', name: 'Pedidos', logic_type: 'list', model_id: 'm-ped', layout_config: {} }],
})

describe('geração: o que sai no app exportado', () => {
  it('Postgres: copia os módulos de acesso (o mesmo sqlPolicy.js do Agente) e a configuração das tabelas', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres'))
    for (const p of Object.keys(ACCESS_RUNTIME_FILES)) expect(files.has(p), p).toBe(true)
    expect(files.get('lib/rowPolicy/sqlPolicy.js')).toContain('function applyToSelect')
    const registry = files.get('app/actions/access-registry.ts')!
    expect(registry).toContain('"canDelete": false')
    expect(registry).toContain('"vendedor_id"')
    // a auditoria reconhecida pelo nome das colunas vai na configuração
    expect(registry).toContain('"createdBy": "criado_por"')
    expect(files.get('app/actions/access.ts')).toContain('secureSelect')
  })

  it('o login grava na sessão a coluna que a regra da tabela pede', () => {
    const login = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres')).get('app/api/login/route.ts')!
    expect(login).toContain('"vendedor_id"')
    expect(login).toContain('"perfil"')
    // e o id do usuário, que a auditoria grava em criado_por/atualizado_por
    expect(login).toContain('"id"')
  })

  it('as actions de Postgres e Oracle consultam as regras; as de MySQL e SQL Server nascem recusando o que está desligado', () => {
    const pg = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres')).get('app/actions/pedidos.ts')!
    expect(pg).toContain('secureSelect(')
    expect(pg).toContain("secureWrite({ action: 'delete'")
    expect(pg).toContain('safeColumn(field)')
    expect(pg).toContain('safeLimit(opts?.limit)')
    const ora = generateNodeProject(parseMetaBuilderJSON(raw(), 'oracle')).get('app/actions/pedidos.ts')!
    expect(ora).toContain('secureSelect(')
    expect(ora).toContain("secureWrite({ action: 'update'")
    // sem regra por linha (só a permissão de excluir desligada), MySQL e SQL Server exportam e recusam a exclusão
    const semRegra = raw({ pedidos: { row_policy: null } })
    const my = generateNodeProject(parseMetaBuilderJSON(semRegra, 'mysql')).get('app/actions/pedidos.ts')!
    expect(my).toMatch(/export async function deletePedidos\(id: string\) \{\n  throw new Error\("Esta tabela não permite excluir registros\."\)/)
    expect(my).toContain('safeColumn(field)')
    const ms = generateNodeProject(parseMetaBuilderJSON(semRegra, 'sqlserver')).get('app/actions/pedidos.ts')!
    expect(ms).toContain('Esta tabela não permite excluir registros.')
    expect(ms).toContain('safeLimit(opts?.limit)')
  })

  it('Supabase: a permissão de excluir desligada também vale (a action já nasce recusando)', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw({ pedidos: { row_policy: null } }), 'supabase'))
    expect(files.get('app/actions/pedidos.ts')).toContain('Esta tabela não permite excluir registros.')
  })

  it('regra por linha em banco ou backend que não a aplica: recusa exportar (falha fechada)', () => {
    for (const stack of ['mysql', 'sqlserver', 'supabase'] as const) {
      expect(() => generateNodeProject(parseMetaBuilderJSON(raw(), stack)), stack).toThrow(/Acesso por linha.*pedidos/)
    }
    // a tabela de login não pode ter regra por linha (o login a lê antes de existir sessão)
    const comRegraNoLogin = raw()
    ;(comRegraNoLogin.models[2] as any).row_policy = POLICY
    expect(() => generateNodeProject(parseMetaBuilderJSON(comRegraNoLogin, 'postgres'))).toThrow(/tabela de login/)
    const java = parseMetaBuilderJSON(raw(), 'postgres', { backendStack: 'java-spring' } as any)
    expect(() => generateNativeProject(java)).toThrow(/Java Spring/)
  })

  it('/api/ai-db: só tabelas do projeto, nunca a de login, operadores fixos e sem atualização/exclusão sem filtro', () => {
    const files = generateNodeProject(parseMetaBuilderJSON({ ...raw(), views: [{ id: 'v1', slug: 'ia', name: 'IA', logic_type: 'ai', model_id: 'm-ped', layout_config: { component_code: 'export default function X(){return null}' } }] }, 'postgres'))
    const route = files.get('app/api/ai-db/route.ts')!
    expect(route).toBeDefined()
    expect(route).toContain('["pedidos","clientes"]')
    expect(route).not.toContain('"usuarios"')
    expect(route).toContain('secureCustom')
    expect(route).toContain('Atualização sem filtro não é permitida')
  })
})

// Executa as actions GERADAS (com o banco trocado por um registrador de SQL) para provar o comportamento de ponta a ponta
describe('actions geradas (Postgres): comportamento', () => {
  const dir = join(__dirname, '.tmp-gen-exported-access')
  const sqls: string[] = []
  const g = globalThis as any
  let actions: any
  let aiDb: any

  beforeAll(async () => {
    const ast = parseMetaBuilderJSON({ ...raw(), views: [{ id: 'v1', slug: 'ia', name: 'IA', logic_type: 'ai', model_id: 'm-ped', layout_config: { component_code: 'export default function X(){return null}' } }] }, 'postgres')
    const files = generateNodeProject(ast)
    mkdirSync(dir, { recursive: true })
    writeGeneratedAccess(dir, files)
    writeFileSync(join(dir, 'session.ts'), 'export async function getSessionUser() { return (globalThis as any).__user ?? null }\n')
    writeFileSync(join(dir, 'db.ts'), "export async function query(sql: string, params?: any[]) {\n  (globalThis as any).__sqls.push(sql)\n  return { rows: (globalThis as any).__rows ?? [{ id: 1 }] }\n}\n")
    writeFileSync(join(dir, 'pedidos.ts'), files.get('app/actions/pedidos.ts')!)
    const route = files.get('app/api/ai-db/route.ts')!
    writeFileSync(join(dir, 'route.ts'), route.replace("'@/app/actions/db'", "'./db'").replace("'@/app/actions/access'", "'./access'"))
    g.__sqls = sqls
    actions = await import(/* @vite-ignore */ join(dir, 'pedidos.ts'))
    aiDb = await import(/* @vite-ignore */ join(dir, 'route.ts'))
  })
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); delete g.__user; delete g.__rows })

  const maria = { email: 'maria@x.com', attrs: { id: 'u-maria', vendedor_id: '7', perfil: 'vendedor' } }
  const admin = { email: 'chefe@x.com', attrs: { id: 'u-chefe', vendedor_id: '1', perfil: 'admin' } }
  const last = () => sqls[sqls.length - 1]

  it('leitura: a lista, o detalhe e a busca por campo trazem só as linhas do usuário; o admin vê tudo', async () => {
    g.__user = maria
    sqls.length = 0
    await actions.getPedidosList()
    await actions.getPedidosById('5')
    await actions.getPedidosByField('status', 'aberto')
    expect(sqls).toHaveLength(3)
    for (const sql of sqls) expect(sql).toContain(`(SELECT * FROM "pedidos" WHERE ("vendedor_id" = '7')) AS "pedidos"`)

    g.__user = admin
    sqls.length = 0
    await actions.getPedidosList()
    expect(last()).not.toContain('vendedor_id')
  })

  it('sem sessão, a tabela com regra fica negada (nenhuma linha), nunca "tudo"', async () => {
    g.__user = null
    sqls.length = 0
    await actions.getPedidosList()
    expect(last()).toContain('WHERE 1 = 0')
  })

  it('gravação: valor de outro vendedor é recusado; a coluna da regra é preenchida; excluir está desligado na tabela', async () => {
    g.__user = maria
    g.__rows = [{ c: 1 }]
    await expect(actions.createPedidos({ status: 'novo', vendedor_id: '9' })).rejects.toThrow(/fora do seu acesso/)
    sqls.length = 0
    await actions.createPedidos({ status: 'novo' })
    expect(last()).toContain('INSERT INTO "pedidos"')
    expect(last()).toContain('"vendedor_id"')
    await expect(actions.updatePedidos('1', { vendedor_id: '9' })).rejects.toThrow(/fora do seu acesso/)
    const del = await actions.deletePedidos('1')
    expect(del).toEqual({ success: false, error: 'Esta tabela não permite excluir registros.' })
    g.__rows = undefined
  })

  it('auditoria: o servidor grava quando e por quem; o que a tela mandar nessas colunas é descartado', async () => {
    g.__user = maria
    g.__rows = [{ c: 1 }]
    sqls.length = 0
    await actions.createPedidos({ status: 'novo', criado_por: 'forjado', atualizado_por: 'forjado' })
    const insert = sqls[sqls.length - 1]
    expect(insert).toContain('INSERT INTO "pedidos"')
    expect(insert).toContain('"criado_por"')
    expect(insert).toContain('"atualizado_em"')
    g.__rows = undefined
  })

  it('o navegador não consegue pôr coluna, limite nem campo crus no SQL', async () => {
    g.__user = admin
    sqls.length = 0
    await expect(actions.getPedidosByField('status" OR "1"="1', 'x')).rejects.toThrow(/Coluna inválida/)
    await expect(actions.getPedidosList({ dateField: 'data_pedido" OR 1=1 --', startDate: '2026-01-01' })).rejects.toThrow(/Coluna inválida/)
    await actions.getPedidosList({ limit: '1; DROP TABLE pedidos' as any })
    expect(last()).not.toContain('DROP')
    expect(last()).not.toContain('LIMIT')
    await actions.getPedidosList({ limit: 50 })
    expect(last()).toContain('LIMIT 50')
    // filtro dotado de nome inválido é ignorado, sem chegar ao SQL
    sqls.length = 0
    await actions.getPedidosList({ filters: { 'clientes.nome" OR "1"="1': 'x' } })
    expect(last()).not.toContain('OR "1"="1')
  })

  it('/api/ai-db: tabela de login e tabela fora do projeto recusadas; operador fora da lista recusado; sem filtro não atualiza nem exclui', async () => {
    g.__user = maria
    const post = (body: any) => aiDb.POST(new Request('http://x/api/ai-db', { method: 'POST', body: JSON.stringify(body) }))
    expect((await post({ table: 'usuarios', action: 'select' })).status).toBe(403)
    expect((await post({ table: 'pg_shadow', action: 'select' })).status).toBe(403)
    expect((await post({ table: 'pedidos', action: 'select', filters: [{ col: 'id', op: '= 1 OR 1=1 --', val: 1 }] })).status).toBe(400)
    expect((await post({ table: 'pedidos', action: 'update', mutationPayload: { status: 'x' } })).status).toBe(400)
    expect((await post({ table: 'pedidos', action: 'delete' })).status).toBe(400)
    // leitura válida sai filtrada pela regra
    sqls.length = 0
    const ok = await post({ table: 'pedidos', action: 'select', filters: [{ col: 'status', op: '=', val: 'aberto' }] })
    expect(ok.status).toBe(200)
    expect(last()).toContain(`("vendedor_id" = '7')`)
  })
})
