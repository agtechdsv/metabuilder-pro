import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'

// Projeto mínimo com regras de acesso por linha, cache e tempo limite no painel
const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const raw = (analytics: Record<string, any>) => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  models: [
    { id: 'm-ped', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'vendas' },
    { id: 'm-cli', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'vendas' },
    { id: 'm-ilha', db_table_name: 'ilha', display_name: 'Ilha', db_schema_name: 'vendas' },
  ],
  fields: [
    f('f1', 'm-ped', 'id', 'integer', true), f('f2', 'm-ped', 'status', 'varchar'), f('f3', 'm-ped', 'valor', 'numeric'),
    f('f4', 'm-ped', 'data_pedido', 'date'), f('f5', 'm-ped', 'cliente_id', 'integer'), f('f8', 'm-ped', 'vendedor_id', 'integer'),
    f('f6', 'm-cli', 'id', 'integer', true), f('f7', 'm-cli', 'nome', 'varchar'),
    f('f9', 'm-ilha', 'id', 'integer', true), f('f10', 'm-ilha', 'dono', 'varchar'),
  ],
  relations: [{ id: 'r1', from_model_id: 'm-ped', to_model_id: 'm-cli', from_field_id: 'f5', to_field_id: 'f6', relation_type: 'many_to_one', source: 'cli' }],
  views: [{
    id: 'v1', slug: 'dashboard', name: 'Dashboard', logic_type: 'analytics', model_id: 'm-ped',
    layout_config: {
      analytics_config: {
        widgets: [
          { id: 'w-kpi', type: 'kpi', title: 'Faturamento', model_id: 'm-ped', field: 'pedidos.valor', calc: 'SUM' },
          { id: 'w-bar', type: 'bar', title: 'Por status', model_id: 'm-ped', field: '*', calc: 'COUNT', group_by: 'pedidos.status', drill_records: true },
          { id: 'w-cli', type: 'bar', title: 'Por cliente', model_id: 'm-cli', field: '*', calc: 'COUNT', group_by: 'clientes.nome' },
        ],
        ...analytics,
      },
    },
  }],
})

const VENDEDOR = { id: 'r1', field: 'pedidos.vendedor_id', op: 'eq', source: 'user.attr', attr: 'vendedor_id', bypass: { source: 'user.attr', attr: 'perfil', values: ['admin'] } }

/** Gera o app, troca o banco e a sessão por registradores e importa a ação de servidor gerada. */
async function load(dir: string, analytics: Record<string, any>, tweakRegistry?: (s: string) => string) {
  const files = generateNodeProject(parseMetaBuilderJSON(raw(analytics), 'postgres'))
  mkdirSync(dir, { recursive: true })
  const bi = files.get('app/actions/bi.ts')!.replace("'@/lib/session-server'", "'./session'")
  writeFileSync(join(dir, 'bi.ts'), bi)
  const registry = files.get('app/actions/bi-registry.ts')!
  writeFileSync(join(dir, 'bi-registry.ts'), tweakRegistry ? tweakRegistry(registry) : registry)
  writeFileSync(join(dir, 'session.ts'), 'export async function getSessionUser() { return (globalThis as any).__user ?? null }\n')
  writeFileSync(
    join(dir, 'db.ts'),
    "export async function query(sql: string) {\n  (globalThis as any).__sqls.push(sql)\n  if ((globalThis as any).__hang) return new Promise(() => {})\n  return { rows: [{ bi_name: 'x', bi_value: 1 }] }\n}\n",
  )
  return { files, mod: await import(/* @vite-ignore */ join(dir, 'bi.ts')) }
}

describe('ação gerada: acesso por linha (RLS), cache e tempo limite', () => {
  const root = join(__dirname, '.tmp-gen-access')
  const sqls: string[] = []
  let rls: any
  let cached: any
  let timed: any
  const g = globalThis as any
  const last = () => sqls[sqls.length - 1]

  beforeAll(async () => {
    g.__sqls = sqls
    rls = (await load(join(root, 'rls'), { rls: [VENDEDOR] })).mod
    cached = (await load(join(root, 'cache'), { cache_seconds: 60 })).mod
    // o tempo limite mínimo do cadastro é 5 s: no registro gerado reduz para 50 ms só no teste
    timed = (await load(join(root, 'timeout'), { timeout_seconds: 5 }, s => s.replace('"timeoutSeconds": 5', '"timeoutSeconds": 0.05'))).mod
  })
  afterAll(() => { rmSync(root, { recursive: true, force: true }); delete g.__user; delete g.__hang })

  it('sem regras o painel funciona como antes (mesmo sem usuário)', async () => {
    g.__user = null
    sqls.length = 0
    const r = await timed.getBiWidgetsData(['w-kpi'])
    expect(r['w-kpi'].error).toBeUndefined()
  })

  it('RLS: sem sessão nega e não consulta o banco', async () => {
    g.__user = null
    sqls.length = 0
    const r = await rls.getBiWidgetsData(['w-kpi'])
    expect(r['w-kpi'].error).toMatch(/Entre no sistema/)
    expect(sqls).toHaveLength(0)
  })

  it('RLS: a condição vem do usuário da sessão assinada, em todos os caminhos', async () => {
    g.__user = { email: 'ana@x.com', attrs: { vendedor_id: '7', perfil: 'vendedor' } }
    sqls.length = 0
    const r = await rls.getBiWidgetsData(['w-kpi', 'w-bar'])
    expect(r['w-kpi'].error).toBeUndefined()
    expect(r['w-bar'].error).toBeUndefined()
    expect(sqls.length).toBeGreaterThanOrEqual(2)
    for (const sql of sqls) expect(sql).toContain('"pedidos"."vendedor_id" = 7')

    // "ver registros" e o filtro do usuário não escapam da regra
    sqls.length = 0
    const rec = await rls.getBiRecords('w-bar', 'Aprovado')
    expect(rec.error).toBeUndefined()
    expect(last()).toContain('"pedidos"."vendedor_id" = 7')
    expect(last()).toContain(`"pedidos"."status" = 'Aprovado'`)
  })

  it('RLS: o navegador não consegue trocar o usuário (nada do pedido entra na regra)', async () => {
    g.__user = { email: 'ana@x.com', attrs: { vendedor_id: '7' } }
    sqls.length = 0
    await rls.getBiWidgetsData(['w-kpi'], { filters: { vendedor_id: '99' }, viewer: { attrs: { vendedor_id: '99' } }, interact: { cross: [{ sourceId: 'w-bar', name: 'x' }] } })
    expect(sqls.join('\n')).toContain('"pedidos"."vendedor_id" = 7')
    expect(sqls.join('\n')).not.toMatch(/vendedor_id" = 99/)
  })

  it('RLS: sem o dado que a regra exige, nega com a explicação', async () => {
    g.__user = { email: 'ana@x.com', attrs: { perfil: 'vendedor' } }
    sqls.length = 0
    const r = await rls.getBiWidgetsData(['w-kpi'])
    expect(r['w-kpi'].error).toContain('vendedor_id')
    expect(sqls).toHaveLength(0)
    expect((await rls.getBiRecords('w-bar', 'x')).error).toContain('vendedor_id')
  })

  it('RLS: o perfil de exceção vê tudo', async () => {
    g.__user = { email: 'chefe@x.com', attrs: { perfil: 'admin' } }
    sqls.length = 0
    const r = await rls.getBiWidgetsData(['w-kpi'])
    expect(r['w-kpi'].error).toBeUndefined()
    expect(last()).not.toContain('vendedor_id')
  })

  it('RLS: valor do usuário que não é número não vira SQL (falha fechada)', async () => {
    g.__user = { email: 'x@x.com', attrs: { vendedor_id: "7 OR 1=1" } }
    sqls.length = 0
    const r = await rls.getBiWidgetsData(['w-kpi'])
    expect(r['w-kpi'].error).toBeTruthy()
    expect(sqls).toHaveLength(0)
  })

  it('RLS: regra numa tabela sem relação com o indicador nega em vez de mostrar tudo', async () => {
    const m = (await load(join(root, 'rls-ilha'), { rls: [{ id: 'r2', field: 'ilha.dono', op: 'eq', source: 'user.email' }] })).mod
    g.__user = { email: 'ana@x.com', attrs: {} }
    sqls.length = 0
    const r = await m.getBiWidgetsData(['w-kpi'])
    expect(r['w-kpi'].error).toMatch(/regra de acesso/)
    expect(sqls).toHaveLength(0)
  })

  it('RLS: regra em tabela relacionada vira JOIN e o valor entra escapado', async () => {
    const m = (await load(join(root, 'rls-cli'), { rls: [{ id: 'r3', field: 'clientes.nome', op: 'eq', source: 'user.name' }] })).mod
    g.__user = { email: 'a@x.com', name: "O'Brien", attrs: {} }
    sqls.length = 0
    const r = await m.getBiWidgetsData(['w-kpi'])
    expect(r['w-kpi'].error).toBeUndefined()
    expect(last()).toContain('JOIN "clientes"')
    expect(last()).toContain(`'O''Brien'`)
  })

  it('cache: a segunda chamada igual não vai ao banco; "fresh" renova', async () => {
    g.__user = null
    sqls.length = 0
    const a = await cached.getBiWidgetsData(['w-kpi'])
    const n = sqls.length
    expect(n).toBeGreaterThan(0)
    const b = await cached.getBiWidgetsData(['w-kpi'])
    expect(sqls.length).toBe(n)
    expect(b['w-kpi'].updatedAt).toBe(a['w-kpi'].updatedAt)
    await cached.getBiWidgetsData(['w-kpi'], { fresh: true })
    expect(sqls.length).toBe(n * 2)
  })

  it('cache: usuários com regras diferentes não compartilham resultado', async () => {
    const m = (await load(join(root, 'cache-rls'), { cache_seconds: 60, rls: [VENDEDOR] })).mod
    sqls.length = 0
    g.__user = { email: 'a@x.com', attrs: { vendedor_id: '1' } }
    await m.getBiWidgetsData(['w-kpi'])
    const afterA = sqls.length
    g.__user = { email: 'b@x.com', attrs: { vendedor_id: '2' } }
    await m.getBiWidgetsData(['w-kpi'])
    expect(sqls.length).toBe(afterA * 2)
    expect(sqls.some(s => s.includes('vendedor_id" = 1'))).toBe(true)
    expect(sqls.some(s => s.includes('vendedor_id" = 2'))).toBe(true)
  })

  it('tempo limite: consulta que trava vira "tempo esgotado" e o painel pode tentar de novo', async () => {
    g.__user = null
    g.__hang = true
    const r = await timed.getBiWidgetsData(['w-kpi'], { period: null })
    g.__hang = false
    expect(r['w-kpi'].timedOut).toBe(true)
    expect(r['w-kpi'].error).toMatch(/Tempo esgotado/)
    expect((await timed.getBiRecords('w-bar', 'Aprovado').catch(() => ({ error: '' }))).error ?? '').not.toMatch(/undefined/)
    // de novo, sem travar: funciona (erro nunca fica guardado)
    const ok = await timed.getBiWidgetsData(['w-kpi'], { fresh: true })
    expect(ok['w-kpi'].error).toBeUndefined()
  })
})
