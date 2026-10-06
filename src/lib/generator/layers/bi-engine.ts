import type { AppAST, DbType } from '../ast'
import { BI_RUNTIME_FILES } from '../biRuntimeFiles.generated'

// ─────────────────────────────────────────────────────────────────────────────
// Motor de BI do app exportado.
//
// O app exportado usa o MESMO planejador do painel em execução (lib/bi/widgetPlan): o SQL de cada widget é montado no
// servidor a partir das especificações embutidas na geração e executado no banco do cliente. O navegador envia só o id
// do widget, o período e os filtros da tela — nunca SQL.
//
// O stack Supabase não tem conexão SQL direta (usa a API REST), então continua com a agregação em JavaScript.
// ─────────────────────────────────────────────────────────────────────────────

const SQL_DIALECTS: Partial<Record<DbType, 'postgres' | 'oracle' | 'mysql' | 'sqlserver'>> = {
  postgres: 'postgres',
  oracle: 'oracle',
  mysql: 'mysql',
  sqlserver: 'sqlserver',
}

/** O app tem dashboards de BI e o banco aceita SQL direto? */
export function biEngineEnabled(ast: AppAST): boolean {
  // no backend Java o frontend fala com a API Spring (sem actions de banco): o motor só vale para o backend Node
  if (ast.backendStack === 'java-spring') return false
  if (!SQL_DIALECTS[ast.dbStack] || !ast.biSchema) return false
  return ast.routes.some(r => (r.analyticsConfig?.widgets || []).some(w => !!w.spec))
}

function runSqlSource(stack: DbType): { imports: string; body: string } {
  switch (stack) {
    case 'oracle':
      // sem o Agente CLI no meio, a conversão dos identificadores para maiúsculas é feita aqui
      return {
        imports: "import { query } from './db'\nimport { oracleUpperIdentifiers } from '@/lib/bi/queryBuilder'",
        body: 'return (await query(oracleUpperIdentifiers(sql))) as any[]',
      }
    case 'mysql':
      return {
        imports: "import { query } from './db'",
        body: 'return (await query(sql)) as any[]',
      }
    case 'sqlserver':
      return {
        imports: "import { getPool } from './db'",
        body: 'const pool = await getPool()\n  const result = await pool.request().query(sql)\n  return result.recordset as any[]',
      }
    default:
      return {
        imports: "import { query } from './db'",
        body: 'const res = await query(sql)\n  return res.rows as any[]',
      }
  }
}

export function generateBiEngine(ast: AppAST, files: Map<string, string>) {
  if (!biEngineEnabled(ast)) return

  // 1. Código do motor (cópia exata de src/lib/bi e dos resolvedores de relação)
  for (const [path, content] of Object.entries(BI_RUNTIME_FILES)) {
    files.set(path, content)
  }

  // 2. Registro: tabelas, relações e especificação dos widgets (a fonte da verdade vem do projeto)
  const widgets: Record<string, { spec: any; joins: any[] }> = {}
  const groupIds: string[] = []
  for (const route of ast.routes) {
    const ac = route.analyticsConfig
    if (!ac) continue
    const joins = Array.isArray(route.rawLayoutConfig?.joins) ? route.rawLayoutConfig.joins : []
    for (const w of ac.widgets) {
      if (w.spec) widgets[w.id] = { spec: w.spec, joins }
    }
    for (const g of ac.groups || []) groupIds.push(g.id)
  }

  const dialect = SQL_DIALECTS[ast.dbStack]!
  files.set('app/actions/bi-registry.ts', `// ARQUIVO GERADO pelo MetaBuilder — esquema e widgets de BI embutidos (sem credenciais).
export const BI_DIALECT = ${JSON.stringify(dialect)} as const
export const BI_PROJECT_SLUG = ${JSON.stringify(ast.projectSlug)}
export const BI_MODELS: any[] = ${JSON.stringify(ast.biSchema!.models, null, 2)}
export const BI_RELATIONS: any[] = ${JSON.stringify(ast.biSchema!.relations, null, 2)}
export const BI_GROUP_IDS: string[] = ${JSON.stringify(groupIds)}
export const BI_WIDGETS: Record<string, { spec: any; joins: any[] }> = ${JSON.stringify(widgets, null, 2)}
`)

  // 3. Ação de servidor
  const run = runSqlSource(ast.dbStack)
  files.set('app/actions/bi.ts', `'use server'
import { planWidgetQuery } from '@/lib/bi/widgetPlan'
import { shapeAggRows, prevValueFromRows } from '@/lib/bi/shapeResult'
import { PERIOD_PRESETS, resolveWidgetPeriod, previousRange, type PeriodRange, type PeriodChoice } from '@/lib/bi/period'
import { BI_DIALECT, BI_PROJECT_SLUG, BI_MODELS, BI_RELATIONS, BI_GROUP_IDS, BI_WIDGETS } from './bi-registry'
${run.imports}

const DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/
const MAX_ROWS = 50000
const MAX_GROUPS = 2000
const MAX_FILTER_VALUE = 200
const MAX_WIDGETS_PER_CALL = 100

export interface BiWidgetResult {
  /** KPI/gauge: número; demais: lista { name, value } */
  data: number | Array<{ name: string; value: number }>
  /** gráfico segmentado: tabela com uma coluna por série */
  series: { rows: any[]; keys: string[] } | null
  /** havia mais grupos do que o teto: o gráfico mostra só os maiores */
  truncated: boolean
  /** KPI com comparação: valor do período anterior e o intervalo comparado */
  prev?: number
  prevRange?: PeriodRange
  error?: string
}

export interface BiInput {
  /** período do painel (YYYY-MM-DD, fim inclusivo); vale para os widgets que seguem o painel */
  period?: PeriodRange | null
  /** filtros da tela: coluna (ou tabela.coluna) → texto digitado */
  filters?: Record<string, string>
  /** barra de período de cada grupo: { idDoGrupo: { preset, from, to } } */
  groupPeriods?: Record<string, PeriodChoice>
  /** seletor próprio dos widgets em modo "próprio": { idDoWidget: { preset, from, to } } */
  ownPeriods?: Record<string, PeriodChoice>
}

async function runSql(sql: string): Promise<any[]> {
  ${run.body}
}

function cleanPeriod(p: BiInput['period']): PeriodRange | null {
  if (!p || typeof p.from !== 'string' || typeof p.to !== 'string') return null
  return DATE_RE.test(p.from) && DATE_RE.test(p.to) && p.from <= p.to ? { from: p.from, to: p.to } : null
}

const PRESET_IDS = new Set<string>([...PERIOD_PRESETS.map(p => p.id), 'custom'])

function cleanChoices(c: Record<string, PeriodChoice> | undefined): Record<string, PeriodChoice> {
  const out: Record<string, PeriodChoice> = {}
  if (!c || typeof c !== 'object') return out
  for (const [k, v] of Object.entries(c)) {
    if (!v || typeof v.preset !== 'string' || !PRESET_IDS.has(v.preset)) continue
    out[k] = {
      preset: v.preset,
      from: typeof v.from === 'string' && DATE_RE.test(v.from) ? v.from : undefined,
      to: typeof v.to === 'string' && DATE_RE.test(v.to) ? v.to : undefined,
    }
  }
  return out
}

function cleanFilters(f: BiInput['filters']): Record<string, string> {
  const out: Record<string, string> = {}
  if (!f || typeof f !== 'object') return out
  for (const [k, v] of Object.entries(f)) {
    if (typeof v !== 'string' || v === '') continue
    out[k] = v.slice(0, MAX_FILTER_VALUE)
  }
  return out
}

async function computeWidget(id: string, input: BiInput, groupPeriods: Record<string, PeriodChoice>, ownPeriods: Record<string, PeriodChoice>): Promise<BiWidgetResult> {
  const entry = BI_WIDGETS[id]
  const empty: BiWidgetResult = { data: 0, series: null, truncated: false }
  if (!entry) return { ...empty, error: 'Widget não encontrado' }

  const spec = entry.spec
  const period = resolveWidgetPeriod(spec, { panel: cleanPeriod(input.period), groupIds: BI_GROUP_IDS, groupPeriods, ownPeriods })
  const plan = planWidgetQuery({
    widget: spec,
    models: BI_MODELS,
    relations: BI_RELATIONS,
    dialect: BI_DIALECT,
    layoutJoins: entry.joins,
    screenFilters: cleanFilters(input.filters),
    period,
    projectSlug: BI_PROJECT_SLUG,
    rawRowLimit: MAX_ROWS,
    maxGroups: MAX_GROUPS,
  })
  plan.warnings.forEach(w => console.warn('[BI]', w))
  if (plan.kind !== 'agg' || !plan.sql) {
    return { ...empty, error: plan.message || 'Não foi possível montar a consulta' }
  }

  try {
    const [rows, prevRows] = await Promise.all([
      runSql(plan.sql),
      plan.prev ? runSql(plan.prev.sql) : Promise.resolve(undefined),
    ])
    const shaped = shapeAggRows(spec, rows, MAX_GROUPS)
    const result: BiWidgetResult = { data: shaped.data, series: shaped.series, truncated: shaped.truncated }
    if (prevRows && period) {
      result.prev = prevValueFromRows(prevRows)
      result.prevRange = previousRange(period)
    }
    return result
  } catch (err) {
    console.error('[BI] falha ao executar o widget', id, err)
    return { ...empty, error: 'Não foi possível carregar este widget' }
  }
}

/** Calcula vários widgets em paralelo; cada um falha de forma independente. */
export async function getBiWidgetsData(ids: string[], input?: BiInput): Promise<Record<string, BiWidgetResult>> {
  const list = (Array.isArray(ids) ? ids : []).filter(i => typeof i === 'string').slice(0, MAX_WIDGETS_PER_CALL)
  const safe: BiInput = input && typeof input === 'object' ? input : {}
  const groupPeriods = cleanChoices(safe.groupPeriods)
  const ownPeriods = cleanChoices(safe.ownPeriods)
  const entries = await Promise.all(list.map(async id => [id, await computeWidget(id, safe, groupPeriods, ownPeriods)] as const))
  return Object.fromEntries(entries)
}
`)
}
