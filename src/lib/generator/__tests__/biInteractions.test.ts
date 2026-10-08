import { writeGeneratedAccess } from './generatedAccess'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'

// Projeto mínimo: pedidos (com cliente) e um dashboard com gráficos interativos
const f = (id: string, model: string, col: string, type: string, pk = false) =>
  ({ id, model_id: model, db_column_name: col, display_name: col, data_type: type, is_primary_key: pk })

const raw = () => ({
  project: { id: 'p1', name: 'Vendas', slug: 'vendas' },
  models: [
    { id: 'm-ped', db_table_name: 'pedidos', display_name: 'Pedidos', db_schema_name: 'vendas' },
    { id: 'm-cli', db_table_name: 'clientes', display_name: 'Clientes', db_schema_name: 'vendas' },
  ],
  fields: [
    f('f1', 'm-ped', 'id', 'integer', true), f('f2', 'm-ped', 'status', 'varchar'), f('f3', 'm-ped', 'valor', 'numeric'),
    f('f4', 'm-ped', 'data_pedido', 'date'), f('f5', 'm-ped', 'cliente_id', 'integer'),
    f('f6', 'm-cli', 'id', 'integer', true), f('f7', 'm-cli', 'nome', 'varchar'),
  ],
  relations: [{ id: 'r1', from_model_id: 'm-ped', to_model_id: 'm-cli', from_field_id: 'f5', to_field_id: 'f6', relation_type: 'many_to_one', source: 'cli' }],
  views: [{
    id: 'v1', slug: 'dashboard', name: 'Dashboard', logic_type: 'analytics', model_id: 'm-ped',
    layout_config: {
      analytics_config: {
        widgets: [
          { id: 'w-kpi', type: 'kpi', title: 'Faturamento', model_id: 'm-ped', field: 'pedidos.valor', calc: 'SUM', cross_target: true },
          { id: 'w-bar', type: 'bar', title: 'Por status', model_id: 'm-ped', field: '*', calc: 'COUNT', group_by: 'pedidos.status', cross_source: true, drill_records: true },
          { id: 'w-mes', type: 'bar', title: 'Por mês', model_id: 'm-ped', field: '*', calc: 'COUNT', group_by: 'pedidos.data_pedido', date_granularity: 'month', drill_detail: true, cross_source: true, drill_records: true },
        ],
      },
    },
  }],
})

// Executa a ação de servidor GERADA (com o banco trocado por um registrador de SQL) para provar a lógica de ponta a ponta
describe('ação de servidor gerada: filtro cruzado, drill e registros', () => {
  const dir = join(__dirname, '.tmp-gen')
  let mod: any
  const sqls: string[] = []

  beforeAll(async () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres'))
    mkdirSync(dir, { recursive: true })
    // a sessão assinada (lib/session-server) é trocada por um usuário falso: este teste não usa regras de acesso
    writeFileSync(join(dir, 'bi.ts'), files.get('app/actions/bi.ts')!.replace("'@/lib/session-server'", "'./session'"))
    writeFileSync(join(dir, 'session.ts'), 'export async function getSessionUser() { return null }\n')
    writeFileSync(join(dir, 'bi-registry.ts'), files.get('app/actions/bi-registry.ts')!)
    writeGeneratedAccess(dir, files)
    writeFileSync(
      join(dir, 'db.ts'),
      "export async function query(sql: string) { (globalThis as any).__sqls.push(sql); return { rows: (globalThis as any).__rows ?? [{ bi_name: 'x', bi_value: 1 }] } }\n",
    )
    ;(globalThis as any).__sqls = sqls
    mod = await import(/* @vite-ignore */ join(dir, 'bi.ts'))
  })
  afterAll(() => { rmSync(dir, { recursive: true, force: true }) })

  const lastSql = () => sqls[sqls.length - 1]

  it('sem interações a consulta é a de sempre', async () => {
    sqls.length = 0
    const r = await mod.getBiWidgetsData(['w-kpi'])
    expect(r['w-kpi'].error).toBeUndefined()
    expect(lastSql()).not.toContain('Aprovado')
  })

  it('o clique no gráfico de origem filtra os widgets que respondem', async () => {
    sqls.length = 0
    await mod.getBiWidgetsData(['w-kpi'], { interact: { cross: [{ sourceId: 'w-bar', name: 'Aprovado' }] } })
    expect(sqls.join('\n')).toContain(`"pedidos"."status" = 'Aprovado'`)
  })

  it('o valor clicado entra escapado no SQL (sem injeção)', async () => {
    sqls.length = 0
    await mod.getBiWidgetsData(['w-kpi'], { interact: { cross: [{ sourceId: 'w-bar', name: "x' OR '1'='1" }] } })
    expect(sqls.join('\n')).toContain(`'x'' OR ''1''=''1'`)
  })

  it('origem que não habilitou o filtro cruzado é ignorada, e widget que não responde não é filtrado', async () => {
    sqls.length = 0
    await mod.getBiWidgetsData(['w-kpi'], { interact: { cross: [{ sourceId: 'w-kpi', name: 'Aprovado' }] } })
    expect(sqls.join('\n')).not.toContain('Aprovado')
    sqls.length = 0
    await mod.getBiWidgetsData(['w-bar'], { interact: { cross: [{ sourceId: 'w-mes', name: '2026-03' }] } })
    expect(sqls.join('\n')).not.toContain('2026-03')
  })

  it('origem inexistente ou lixo no pedido não quebra nada', async () => {
    const r = await mod.getBiWidgetsData(['w-kpi'], { interact: { cross: [{ sourceId: 'nao-existe', name: 'x' }, null, { sourceId: 5 }], drill: { 'w-kpi': ['a', 7] } } })
    expect(r['w-kpi'].error).toBeUndefined()
  })

  it('detalhar mês → dia: refaz o caminho pelo nome clicado e informa se ainda há nível', async () => {
    sqls.length = 0
    const first = await mod.getBiWidgetsData(['w-mes'])
    expect(first['w-mes'].canDrill).toBe(true)
    sqls.length = 0
    const r = await mod.getBiWidgetsData(['w-mes'], { interact: { drill: { 'w-mes': ['2026-03'] } } })
    const sql = lastSql()
    expect(sql).toContain("'YYYY-MM-DD'")
    expect(sql).toContain("CAST('2026-03-01' AS TIMESTAMP)")
    expect(sql).toContain("CAST('2026-04-01' AS TIMESTAMP)")
    expect(r['w-mes'].canDrill).toBeUndefined()
  })

  it('nome de detalhe que não é um mês é ignorado (continua no nível original)', async () => {
    sqls.length = 0
    await mod.getBiWidgetsData(['w-mes'], { interact: { drill: { 'w-mes': ['qualquer coisa'] } } })
    expect(lastSql()).toContain("'YYYY-MM'")
  })

  it('widget sem "detalhar" não aceita drill vindo do navegador', async () => {
    sqls.length = 0
    await mod.getBiWidgetsData(['w-bar'], { interact: { drill: { 'w-bar': ['Aprovado'] } } })
    expect(lastSql()).not.toContain('Aprovado')
  })

  it('ver registros: lista as linhas do valor clicado e exige a opção ligada no widget', async () => {
    sqls.length = 0
    ;(globalThis as any).__rows = [{ id: 1, status: 'Aprovado', big: BigInt(5) }]
    const ok = await mod.getBiRecords('w-bar', 'Aprovado')
    expect(ok.error).toBeUndefined()
    expect(ok.rows).toEqual([{ id: 1, status: 'Aprovado', big: '5' }])
    expect(lastSql()).toContain('SELECT * FROM "pedidos"')
    expect(lastSql()).toContain(`"pedidos"."status" = 'Aprovado'`)
    expect(lastSql()).toContain('LIMIT 200')
    expect((await mod.getBiRecords('w-kpi', 'x')).error).toBeTruthy()
    expect((await mod.getBiRecords('nao-existe', 'x')).error).toBeTruthy()
    ;(globalThis as any).__rows = undefined
  })

  it('ver registros respeita o nível de drill e o filtro cruzado', async () => {
    sqls.length = 0
    await mod.getBiRecords('w-mes', '2026-03-05', { interact: { drill: { 'w-mes': ['2026-03'] }, cross: [{ sourceId: 'w-bar', name: 'Enviado' }] } })
    const sql = lastSql()
    // nível do mês (03-01 a 04-01) e, dentro dele, o dia clicado (03-05 a 03-06)
    expect(sql).toContain("CAST('2026-03-01' AS TIMESTAMP)")
    expect(sql).toContain("CAST('2026-04-01' AS TIMESTAMP)")
    expect(sql).toContain("CAST('2026-03-05' AS TIMESTAMP)")
    expect(sql).toContain("CAST('2026-03-06' AS TIMESTAMP)")
    expect(sql).not.toContain('Enviado') // w-mes não responde ao filtro cruzado (não é "cross_target")
  })
})
