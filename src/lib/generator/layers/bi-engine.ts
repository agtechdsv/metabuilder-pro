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
  const widgets: Record<string, { spec: any; joins: any[]; rls: any[]; perf: { cacheSeconds: number; timeoutSeconds: number } }> = {}
  const groupIds: string[] = []
  for (const route of ast.routes) {
    const ac = route.analyticsConfig
    if (!ac) continue
    const joins = Array.isArray(route.rawLayoutConfig?.joins) ? route.rawLayoutConfig.joins : []
    for (const w of ac.widgets) {
      // regras de acesso por linha e desempenho valem para o painel inteiro (e ficam no servidor, nunca no navegador)
      if (w.spec) widgets[w.id] = { spec: w.spec, joins, rls: ac.rls || [], perf: { cacheSeconds: ac.cacheSeconds ?? 0, timeoutSeconds: ac.timeoutSeconds ?? 30 } }
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
export const BI_WIDGETS: Record<string, { spec: any; joins: any[]; rls: any[]; perf: { cacheSeconds: number; timeoutSeconds: number } }> = ${JSON.stringify(widgets, null, 2)}
`)

  // 3. Ação de servidor
  const run = runSqlSource(ast.dbStack)
  files.set('app/actions/bi.ts', `'use server'
import { planWidgetQuery } from '@/lib/bi/widgetPlan'
import { shapeAggRows, prevValueFromRows } from '@/lib/bi/shapeResult'
import { PERIOD_PRESETS, resolveWidgetPeriod, previousRange, type PeriodRange, type PeriodChoice } from '@/lib/bi/period'
import { applyDrill, drillInto, drillTarget, makeCrossFilter, crossConditionsFor, bucketConditions, type DrillLevel, type CrossFilter } from '@/lib/bi/interaction'
import { planRecordsQuery } from '@/lib/bi/recordsPlan'
import { rlsAccess, withAccess, type AccessDenied, type BiViewer, type RlsRule } from '@/lib/bi/access'
import { QueryCache, withTimeout, BiTimeoutError } from '@/lib/bi/perf'
import { getSessionUser } from '@/lib/session-server'
import type { BiWidget } from '@/lib/bi/widget'
import { BI_DIALECT, BI_PROJECT_SLUG, BI_MODELS, BI_RELATIONS, BI_GROUP_IDS, BI_WIDGETS } from './bi-registry'
${run.imports}

const DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/
const MAX_ROWS = 50000
const MAX_GROUPS = 2000
const MAX_FILTER_VALUE = 200
const MAX_WIDGETS_PER_CALL = 100
const MAX_NAME = 300
const MAX_DEPTH = 5
const MAX_CROSS = 10
const RECORDS_LIMIT = 200

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
  /** ainda há um próximo nível para detalhar */
  canDrill?: boolean
  /** o filtro cruzado ativo não tem relação com este indicador e foi ignorado */
  crossIgnored?: boolean
  /** quando os dados foram lidos do banco (um resultado em cache mostra a hora da leitura original) */
  updatedAt?: number
  /** a consulta passou do tempo limite (o painel oferece "tentar de novo") */
  timedOut?: boolean
  error?: string
}

/**
 * Interações do painel. O navegador envia só os NOMES clicados (nunca condições): o servidor refaz o caminho com as
 * mesmas funções do painel e monta as condições a partir do cadastro dos widgets.
 */
export interface BiInteractions {
  /** filtros cruzados ativos: o gráfico de origem e o valor clicado nele */
  cross?: Array<{ sourceId: string; name: string }>
  /** caminho de drill aberto por widget: o nome clicado em cada nível */
  drill?: Record<string, string[]>
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
  interact?: BiInteractions
  /** atualização manual ou automática: ignora o cache e o renova */
  fresh?: boolean
}

async function runSql(sql: string): Promise<any[]> {
  ${run.body}
}

// Cache dos resultados: a chave é o próprio SQL, que já inclui período, filtros e a regra de acesso do usuário.
const queryCache = new QueryCache<{ rows: any[]; at: number }>(300)

interface BiPerf { cacheSeconds: number; timeoutSeconds: number }

async function runQuery(sql: string, perf: BiPerf, fresh: boolean): Promise<{ rows: any[]; at: number }> {
  const { value } = await queryCache.run(
    sql,
    perf.cacheSeconds * 1000,
    async () => ({ rows: await withTimeout(runSql(sql), perf.timeoutSeconds * 1000), at: Date.now() }),
    fresh,
  )
  return value
}

/** Quem está logado (sessão assinada); as regras de acesso usam este usuário, nunca algo enviado pelo navegador. */
async function currentViewer(): Promise<BiViewer | null> {
  const u = await getSessionUser()
  return u ? { email: u.email, name: u.name ?? null, attrs: u.attrs ?? {} } : null
}

function denyMessage(d: AccessDenied): string {
  return d.code === 'no_viewer'
    ? 'Entre no sistema para ver este indicador.'
    : 'Seu cadastro não tem o dado "' + d.detail + '" que a regra de acesso deste indicador exige.'
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

function cleanInteract(i: BiInteractions | undefined): { cross: Array<{ sourceId: string; name: string }>; drill: Record<string, string[]> } {
  const cross: Array<{ sourceId: string; name: string }> = []
  const drill: Record<string, string[]> = {}
  if (i && typeof i === 'object') {
    if (Array.isArray(i.cross)) {
      for (const c of i.cross.slice(0, MAX_CROSS)) {
        if (c && typeof c.sourceId === 'string' && typeof c.name === 'string') cross.push({ sourceId: c.sourceId, name: c.name.slice(0, MAX_NAME) })
      }
    }
    if (i.drill && typeof i.drill === 'object') {
      for (const [k, v] of Object.entries(i.drill)) {
        if (Array.isArray(v)) drill[k] = v.filter(n => typeof n === 'string').map(n => n.slice(0, MAX_NAME)).slice(0, MAX_DEPTH)
      }
    }
  }
  return { cross, drill }
}

const planArgs = (widget: BiWidget, joins: any[], period: PeriodRange | null, filters: Record<string, string>) => ({
  widget,
  models: BI_MODELS,
  relations: BI_RELATIONS,
  dialect: BI_DIALECT,
  layoutJoins: joins,
  screenFilters: filters,
  period,
  projectSlug: BI_PROJECT_SLUG,
  rawRowLimit: MAX_ROWS,
  maxGroups: MAX_GROUPS,
})

/** Refaz o caminho de drill do widget a partir dos nomes clicados e diz como ele está agrupado agora. */
function resolveDrill(id: string, names: string[]) {
  const entry = BI_WIDGETS[id]
  if (!entry) return null
  const spec = entry.spec as BiWidget
  const groupOf = (w: BiWidget) => planWidgetQuery(planArgs(w, entry.joins, null, {})).group
  let stack: DrillLevel[] = []
  for (const name of names) {
    const level = drillInto(spec, stack, groupOf(applyDrill(spec, stack)), name)
    if (!level) break
    stack = [...stack, level]
  }
  const widget = applyDrill(spec, stack)
  return { entry, spec, stack, widget, group: groupOf(widget) }
}

function buildCross(cross: Array<{ sourceId: string; name: string }>, drill: Record<string, string[]>): CrossFilter[] {
  const out: CrossFilter[] = []
  for (const c of cross) {
    const r = resolveDrill(c.sourceId, drill[c.sourceId] || [])
    if (!r || !r.spec.cross_source) continue
    const cf = makeCrossFilter(r.spec, r.group, c.name)
    if (cf && !out.some(o => o.sourceId === cf.sourceId)) out.push(cf)
  }
  return out
}

interface CallCtx {
  viewer: BiViewer | null
  fresh: boolean
  input: BiInput
  groupPeriods: Record<string, PeriodChoice>
  ownPeriods: Record<string, PeriodChoice>
  filters: Record<string, string>
  drill: Record<string, string[]>
  cross: CrossFilter[]
}

async function computeWidget(id: string, ctx: CallCtx): Promise<BiWidgetResult> {
  const empty: BiWidgetResult = { data: 0, series: null, truncated: false }
  const r = resolveDrill(id, ctx.drill[id] || [])
  if (!r) return { ...empty, error: 'Widget não encontrado' }
  const { entry, spec, stack, widget: drilledWidget } = r

  // acesso por linha: as regras do painel viram condições do widget (sem usuário ou sem o dado da regra, nega)
  const access = rlsAccess(entry.rls as RlsRule[], ctx.viewer)
  if (access.denied) return { ...empty, error: denyMessage(access.denied) }
  const scopedWidget = withAccess(drilledWidget, access)

  const period = resolveWidgetPeriod(spec, { panel: cleanPeriod(ctx.input.period), groupIds: BI_GROUP_IDS, groupPeriods: ctx.groupPeriods, ownPeriods: ctx.ownPeriods })
  const crossConds = crossConditionsFor(spec, ctx.cross)
  const attempt = (w: BiWidget) => planWidgetQuery(planArgs(w, entry.joins, period, ctx.filters))

  // filtro cruzado de uma tabela sem relação com este widget: ignora o filtro e avisa
  let used: BiWidget = crossConds.length ? { ...scopedWidget, conditions: [...(scopedWidget.conditions || []), ...crossConds] } : scopedWidget
  let plan = attempt(used)
  let crossIgnored = false
  if (plan.kind === 'error' && crossConds.length) {
    used = scopedWidget
    plan = attempt(used)
    crossIgnored = true
  }
  plan.warnings.forEach(w => console.warn('[BI]', w))
  if (plan.kind !== 'agg' || !plan.sql) {
    // a regra de acesso não coube neste indicador (ex.: tabela sem relação com a coluna da regra): nunca mostra sem o filtro
    return { ...empty, error: access.conditions.length && plan.kind === 'error'
      ? 'Este indicador não pode ser filtrado pela regra de acesso: ' + (plan.message || '')
      : plan.message || 'Não foi possível montar a consulta' }
  }

  try {
    const [main, prevRun] = await Promise.all([
      runQuery(plan.sql, entry.perf, ctx.fresh),
      plan.prev ? runQuery(plan.prev.sql, entry.perf, ctx.fresh) : Promise.resolve(undefined),
    ])
    const shaped = shapeAggRows(used, main.rows, MAX_GROUPS)
    const result: BiWidgetResult = { data: shaped.data, series: shaped.series, truncated: shaped.truncated, updatedAt: main.at }
    if (prevRun && period) {
      result.prev = prevValueFromRows(prevRun.rows)
      result.prevRange = previousRange(period)
    }
    if (drillTarget(spec, stack, plan.group)) result.canDrill = true
    if (crossIgnored) result.crossIgnored = true
    return result
  } catch (err) {
    if (err instanceof BiTimeoutError) {
      return { ...empty, timedOut: true, error: 'Tempo esgotado: a consulta passou de ' + entry.perf.timeoutSeconds + 's.' }
    }
    console.error('[BI] falha ao executar o widget', id, err)
    return { ...empty, error: 'Não foi possível carregar este widget' }
  }
}

async function makeCtx(input: BiInput | undefined): Promise<CallCtx> {
  const safe: BiInput = input && typeof input === 'object' ? input : {}
  const { cross, drill } = cleanInteract(safe.interact)
  return {
    viewer: await currentViewer(),
    fresh: safe.fresh === true,
    input: safe,
    groupPeriods: cleanChoices(safe.groupPeriods),
    ownPeriods: cleanChoices(safe.ownPeriods),
    filters: cleanFilters(safe.filters),
    drill,
    cross: buildCross(cross, drill),
  }
}

/** Calcula vários widgets em paralelo; cada um falha de forma independente. */
export async function getBiWidgetsData(ids: string[], input?: BiInput): Promise<Record<string, BiWidgetResult>> {
  const list = (Array.isArray(ids) ? ids : []).filter(i => typeof i === 'string').slice(0, MAX_WIDGETS_PER_CALL)
  const ctx = await makeCtx(input)
  const entries = await Promise.all(list.map(async id => [id, await computeWidget(id, ctx)] as const))
  return Object.fromEntries(entries)
}

/** "Ver registros": as linhas (até 200) que compõem a barra/fatia clicada. */
export async function getBiRecords(widgetId: string, name: string, input?: BiInput): Promise<{ rows?: any[]; error?: string }> {
  if (typeof widgetId !== 'string' || typeof name !== 'string') return { error: 'Pedido inválido' }
  const ctx = await makeCtx(input)
  const r = resolveDrill(widgetId, ctx.drill[widgetId] || [])
  if (!r || !r.spec.drill_records || !r.group) return { error: 'Este indicador não permite ver os registros' }

  // a lista de registros respeita a mesma regra de acesso do indicador
  const access = rlsAccess(r.entry.rls as RlsRule[], ctx.viewer)
  if (access.denied) return { error: denyMessage(access.denied) }

  const clicked = bucketConditions(r.group, name.slice(0, MAX_NAME))
  if (clicked.length === 0) return { error: 'Valor inválido' }
  const period = resolveWidgetPeriod(r.spec, { panel: cleanPeriod(ctx.input.period), groupIds: BI_GROUP_IDS, groupPeriods: ctx.groupPeriods, ownPeriods: ctx.ownPeriods })
  const crossConds = crossConditionsFor(r.spec, ctx.cross)
  const attempt = (extra: typeof clicked) => planRecordsQuery({
    widget: { ...r.widget, conditions: [...(r.widget.conditions || []), ...access.conditions, ...clicked, ...extra] },
    models: BI_MODELS,
    relations: BI_RELATIONS,
    dialect: BI_DIALECT,
    period,
    screenFilters: ctx.filters,
    projectSlug: BI_PROJECT_SLUG,
    limit: RECORDS_LIMIT,
  })
  let plan = attempt(crossConds)
  if (plan.kind === 'error' && crossConds.length) plan = attempt([])
  if (plan.kind !== 'records' || !plan.sql) {
    return { error: access.conditions.length && plan.kind === 'error'
      ? 'Este indicador não pode ser filtrado pela regra de acesso: ' + (plan.message || '')
      : plan.message || 'Não foi possível montar a consulta' }
  }

  try {
    const { rows } = await runQuery(plan.sql, r.entry.perf, ctx.fresh)
    return { rows: JSON.parse(JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? String(v) : v))) }
  } catch (err) {
    if (err instanceof BiTimeoutError) return { error: 'Tempo esgotado: a consulta passou de ' + r.entry.perf.timeoutSeconds + 's.' }
    console.error('[BI] falha ao listar os registros', widgetId, err)
    return { error: 'Não foi possível carregar os registros' }
  }
}
`)
}
