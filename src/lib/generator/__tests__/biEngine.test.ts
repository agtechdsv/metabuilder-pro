import { describe, it, expect } from 'vitest'
import ts from 'typescript'
import { parseMetaBuilderJSON } from '../parser'
import { generateNodeProject } from '../emitter/node-project'
import { generateNativeProject } from '../emitter/single-project'
import { planWidgetQuery } from '../../bi/widgetPlan'
import { BI_RUNTIME_FILES } from '../biRuntimeFiles.generated'

// Projeto mínimo: pedidos (com cliente) e um dashboard de BI sobre pedidos
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
        groups: [{ id: 'g1', title: 'Geral' }],
        widgets: [
          { id: 'w-kpi', type: 'kpi', title: 'Faturamento', model_id: 'm-ped', field: 'pedidos.valor', calc: 'SUM', period_field: 'pedidos.data_pedido', compare_previous: true },
          { id: 'w-bar', type: 'bar', title: 'Por status', model_id: 'm-ped', field: '*', calc: 'COUNT', group_by: 'pedidos.status' },
          { id: 'w-grp', type: 'kpi', title: 'Do grupo', model_id: 'm-ped', field: 'pedidos.valor', calc: 'SUM', group_id: 'g1', period_field: 'pedidos.data_pedido', period_mode: 'group' },
          { id: 'w-own', type: 'kpi', title: 'Proprio', model_id: 'm-ped', field: 'pedidos.valor', calc: 'SUM', period_field: 'pedidos.data_pedido', period_mode: 'own' },
          { id: 'w-cli', type: 'bar', title: 'Por cliente', model_id: 'm-ped', field: 'pedidos.valor', calc: 'SUM', group_by: 'pedidos.cliente_id' },
        ],
      },
    },
  }],
})

describe('motor de BI no app exportado', () => {
  it('stack Postgres: copia o motor, o registro e a ação de servidor', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres'))
    for (const p of Object.keys(BI_RUNTIME_FILES)) expect(files.has(p), p).toBe(true)
    const action = files.get('app/actions/bi.ts')!
    expect(action).toContain("'use server'")
    expect(action).toContain('planWidgetQuery')
    expect(action).toContain('res.rows')
    const registry = files.get('app/actions/bi-registry.ts')!
    expect(registry).toContain('"postgres"')
    expect(registry).toContain('w-kpi')
    expect(registry).toContain('"db_table_name": "pedidos"')
    const page = [...files.entries()].find(([p]) => p.endsWith('/page.tsx') && p.includes('dashboard'))![1]
    expect(page).toContain("import { getBiWidgetsData } from '@/app/actions/bi'")
    expect(page).toContain('biResults')
    expect(page).not.toContain('calculateWidgetData(widget, dashboardRows')
  })

  it('cada stack executa o SQL do seu jeito', () => {
    const run = (stack: any) => generateNodeProject(parseMetaBuilderJSON(raw(), stack)).get('app/actions/bi.ts')!
    expect(run('oracle')).toContain('query(oracleUpperIdentifiers(sql))')
    expect(run('mysql')).toContain('return (await query(sql)) as any[]')
    expect(run('sqlserver')).toContain('pool.request().query(sql)')
    expect(run('sqlserver')).toContain('result.recordset')
  })

  it('backend Java: o frontend não recebe o motor nem importa a ação de BI', () => {
    const ast = parseMetaBuilderJSON(raw(), 'postgres', { backendStack: 'java-spring' } as any)
    const files = generateNativeProject(ast)
    expect([...files.keys()].some(p => p.endsWith('actions/bi.ts'))).toBe(false)
    const pages = [...files.entries()].filter(([p]) => p.endsWith('/page.tsx') && p.includes('dashboard'))
    expect(pages.length).toBeGreaterThan(0)
    for (const [, src] of pages) expect(src).not.toContain('@/app/actions/bi')
  })

  it('Postgres: o schema das tabelas entra no search_path da conexão', () => {
    const db = generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres')).get('app/actions/db.ts')!
    expect(db).toContain("options: '-c search_path=vendas,public'")
  })

  it('subtítulo e eixo: fórmula/tabela toda e todos os rótulos do eixo', () => {
    const client = [...generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres')).entries()].find(([p]) => p.endsWith('AnalyticsClient.tsx'))![1]
    expect(client).toContain('fieldLabel(')
    expect(client).toContain('interval={0}')
  })

  it('cliente do dashboard: grupos, barras de período e recálculo pelo servidor', () => {
    const client = [...generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres')).entries()].find(([p]) => p.endsWith('AnalyticsClient.tsx'))![1]
    expect(client).toContain("import { getBiWidgetsData, getBiRecords } from '@/app/actions/bi'")
    expect(client).toContain("from '@/lib/bi/groups'")
    expect(client).toContain('renderGroupHeader')
    expect(client).toContain("'Período do grupo'")
    expect(client).toContain('groupPeriods, ownPeriods')
    const page = [...generateNodeProject(parseMetaBuilderJSON(raw(), 'postgres')).entries()].find(([p]) => p.endsWith('/page.tsx') && p.includes('dashboard'))![1]
    expect(page).toContain('filters={biFilters}')
    expect(page).toContain('"id":"g1"')
  })

  it('Supabase: grupos aparecem, mas sem barras de período (não há recálculo)', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'supabase'))
    const client = [...files.entries()].find(([p]) => p.endsWith('AnalyticsClient.tsx'))![1]
    expect(client).not.toContain('getBiWidgetsData')
    expect(client).toContain('const hasPeriod = (w: AnalyticsWidget) => false &&')
    expect(client).toContain('renderGroupHeader')
    // o cliente importa estas bibliotecas: precisam existir mesmo sem o motor
    expect(files.has('lib/bi/period.ts')).toBe(true)
    expect(files.has('lib/bi/groups.ts')).toBe(true)
    expect(files.has('lib/bi/scaleLayout.ts')).toBe(true)
    const client2 = [...files.entries()].find(([p]) => p.endsWith('AnalyticsClient.tsx'))![1]
    expect(client2).toContain("from '@/lib/bi/scaleLayout'")
    expect(client2).toContain('setScaleKey')
  })

  it('Supabase (sem SQL direto) continua com a agregação em JavaScript', () => {
    const files = generateNodeProject(parseMetaBuilderJSON(raw(), 'supabase'))
    expect(files.has('app/actions/bi.ts')).toBe(false)
    expect(files.has('lib/bi/widgetPlan.ts')).toBe(false)
    const page = [...files.entries()].find(([p]) => p.endsWith('/page.tsx') && p.includes('dashboard'))![1]
    expect(page).not.toContain('getBiWidgetsData')
    expect(page).toContain('calculateWidgetData(widget, dashboardRows')
  })

  it('o esquema embutido basta para o planejador montar o mesmo SQL do painel', () => {
    const ast = parseMetaBuilderJSON(raw(), 'oracle')
    const registrySrc = generateNodeProject(ast).get('app/actions/bi-registry.ts')!
    // executa o arquivo gerado (apenas dados) para obter as constantes
    const js = ts.transpileModule(registrySrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
    const exp: any = {}
    new Function('exports', js)(exp)
    const mod = exp

    const plan = (id: string, period: any = null) => planWidgetQuery({
      widget: mod.BI_WIDGETS[id].spec, models: mod.BI_MODELS, relations: mod.BI_RELATIONS, dialect: mod.BI_DIALECT,
      period, projectSlug: mod.BI_PROJECT_SLUG, rawRowLimit: 50000, maxGroups: 2000,
    })

    const kpi = plan('w-kpi', { from: '2026-10-01', to: '2026-10-05' })
    expect(kpi.kind).toBe('agg')
    expect(kpi.sql).toContain('SUM(')
    expect(kpi.sql).toContain('"pedidos"')
    expect(kpi.prev?.sql).toBeTruthy()

    const bar = plan('w-bar')
    expect(bar.kind).toBe('agg')
    expect(bar.sql).toContain('COUNT(')

    // nome do cliente no lugar do código: o JOIN vem das relações embutidas
    const cli = plan('w-cli')
    expect(cli.kind).toBe('agg')
    expect(cli.sql).toContain('"clientes"')
  })
})
