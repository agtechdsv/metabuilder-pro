/**
 * Consulta do BI montada NO SERVIDOR (Fase 5c, item 3).
 *
 * Antes o navegador montava o SQL (planWidgetQuery), somava a regra de acesso por linha (RLS) com os dados lidos de um
 * cookie editável e mandava o SQL pronto. Quem mexesse no cookie ou no SQL via os dados de outro usuário. Agora o
 * navegador pede "o indicador X, com estes filtros" e o servidor:
 *   - usa o indicador SALVO (o usuário final nunca define a consulta; o membro do projeto pode testar uma edição);
 *   - lê QUEM é o usuário da sessão assinada (nunca de um cookie editável);
 *   - soma a regra de acesso e só então planeja o SQL, com o mesmo planejador do painel e do app exportado.
 *
 * Este arquivo é puro (sem rede nem banco): recebe o pedido já lido e devolve o SQL a executar ou o motivo da recusa.
 */
import { applyDrill, bucketConditions, crossConditionsFor, type CrossFilter, type DrillLevel } from './interaction'
import { cleanRlsRules, rlsAccess, withAccess, type AccessDenied, type AccessResult, type BiViewer } from './access'
import { planWidgetQuery } from './widgetPlan'
import { planRecordsQuery } from './recordsPlan'
import type { SqlDialect } from './queryBuilder'
import type { PeriodRange } from './period'
import type { BiAnalyticsConfig, BiWidget, BiWidgetCondition } from './widget'

/** Tetos das consultas do painel (o painel e o servidor precisam concordar). */
export const BI_ROW_LIMIT = 1000
export const BI_MAX_GROUPS = 2000
/** Máximo de linhas de "ver registros". */
export const BI_RECORDS_LIMIT = 200

export type BiPart = 'main' | 'prev' | 'records'

export interface BiQueryRequest {
  projectId: string
  viewId: string
  widgetId: string
  part: BiPart
  /** o indicador como o navegador o tem (SÓ vale para membro do projeto, que testa edições ainda não salvas) */
  widget?: BiWidget
  drill: DrillLevel[]
  cross: CrossFilter[]
  filters: Record<string, string>
  period: PeriodRange | null
  legacy: boolean
  reason?: string
  /** "ver registros": o nome da barra/fatia clicada */
  bucket?: string
  /** a tela está em ?preview=draft (só membro) */
  draft: boolean
}

// ── Leitura do pedido (vem do navegador: nada é confiado) ────────────────────────

const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '')
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const GRANULARITIES = new Set(['day', 'week', 'month', 'quarter', 'year'])

function cleanConds(raw: unknown): BiWidgetCondition[] {
  if (!Array.isArray(raw)) return []
  const out: BiWidgetCondition[] = []
  for (const c of raw.slice(0, 10)) {
    if (!c || typeof c !== 'object') continue
    const field = text((c as any).field, 200)
    const op = text((c as any).op, 30)
    if (!field || !op) continue
    const cond: BiWidgetCondition = { field, op }
    if ((c as any).value !== undefined && (c as any).value !== null) cond.value = text((c as any).value, 500)
    if ((c as any).value2 !== undefined && (c as any).value2 !== null) cond.value2 = text((c as any).value2, 500)
    out.push(cond)
  }
  return out
}

function cleanDrill(raw: unknown): DrillLevel[] {
  if (!Array.isArray(raw)) return []
  const out: DrillLevel[] = []
  for (const l of raw.slice(0, 6)) {
    if (!l || typeof l !== 'object') continue
    const group_by = text((l as any).group_by, 200)
    if (!group_by) continue
    const gran = text((l as any).date_granularity, 20)
    out.push({ group_by, ...(gran ? { date_granularity: gran } : {}), conds: cleanConds((l as any).conds), label: text((l as any).label, 200) })
  }
  return out
}

function cleanCross(raw: unknown): CrossFilter[] {
  if (!Array.isArray(raw)) return []
  const out: CrossFilter[] = []
  for (const f of raw.slice(0, 20)) {
    if (!f || typeof f !== 'object') continue
    const sourceId = text((f as any).sourceId, 120)
    if (!sourceId) continue
    out.push({ sourceId, sourceTitle: text((f as any).sourceTitle, 200), name: text((f as any).name, 300), conds: cleanConds((f as any).conds) })
  }
  return out
}

function cleanFilters(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 50)) {
    const value = text(v, 200)
    if (value !== '') out[text(k, 120)] = value
  }
  return out
}

function cleanPeriod(raw: unknown): PeriodRange | null {
  if (!raw || typeof raw !== 'object') return null
  const from = text((raw as any).from, 10)
  const to = text((raw as any).to, 10)
  return DATE_ONLY.test(from) && DATE_ONLY.test(to) ? { from, to } : null
}

export function parseBiRequest(body: unknown): { ok: true; req: BiQueryRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Pedido inválido.' }
  const b = body as Record<string, unknown>
  const projectId = text(b.projectId, 64)
  const viewId = text(b.viewId, 64)
  const widgetId = text(b.widgetId, 120)
  if (!projectId || !viewId || !widgetId) return { ok: false, error: 'Pedido incompleto.' }
  const part = b.part
  if (part !== 'main' && part !== 'prev' && part !== 'records') return { ok: false, error: 'Parte da consulta inválida.' }
  let widget: BiWidget | undefined
  if (b.widget && typeof b.widget === 'object' && !Array.isArray(b.widget)) {
    if ((b.widget as any).id !== widgetId) return { ok: false, error: 'O indicador enviado não é o pedido.' }
    widget = b.widget as BiWidget
  }
  return {
    ok: true,
    req: {
      projectId, viewId, widgetId, part, widget,
      drill: cleanDrill(b.drill),
      cross: cleanCross(b.cross),
      filters: cleanFilters(b.filters),
      period: cleanPeriod(b.period),
      legacy: b.legacy === true,
      reason: b.reason ? text(b.reason, 300) : undefined,
      bucket: b.bucket !== undefined && b.bucket !== null ? text(b.bucket, 300) : undefined,
      draft: b.draft === true,
    },
  }
}

// ── Montagem ─────────────────────────────────────────────────────────────────────

export interface BiServerContext {
  models: any[]
  relations: any[]
  /** JOINs configurados no caso de uso (legado) */
  joins: any[]
  dialect: SqlDialect | null
  projectSlug?: string
}

export type Composed =
  | { ok: true; sql: string; limit: number; schemaName: string; tableName: string; kind: 'agg' | 'raw' | 'records' | 'prev' }
  | { ok: false; status: number; code: string; message: string; denied?: AccessDenied }

/** Dialeto do SQL a partir do tipo do banco do projeto (o Agente CLI só executa PostgreSQL e Oracle). */
export function dialectOf(dbType: string | null | undefined): SqlDialect | null {
  const t = String(dbType || 'postgres').toLowerCase()
  return t === 'oracle' ? 'oracle' : (t === 'postgres' || t === 'postgresql') ? 'postgres' : null
}

/** O caminho de drill pedido só pode seguir o que o indicador permite (o agrupamento dele ou a dimensão `drill_by`). */
export function drillAllowed(widget: BiWidget, stack: DrillLevel[]): boolean {
  if (stack.length === 0) return true
  if (!widget.drill_detail || stack.length > 4) return false
  return stack.every(l =>
    (l.group_by === widget.group_by || (!!widget.drill_by && l.group_by === widget.drill_by)) &&
    (!l.date_granularity || GRANULARITIES.has(l.date_granularity)))
}

const fail = (status: number, code: string, message: string, denied?: AccessDenied): Composed => ({ ok: false, status, code, message, ...(denied ? { denied } : {}) })

export function composeBiQuery(args: {
  req: BiQueryRequest
  /** configuração salva do painel (publicada, ou o rascunho para membro em ?preview=draft) */
  config: BiAnalyticsConfig | null | undefined
  actor: 'member' | 'end_user'
  /** o usuário da SESSÃO ASSINADA (null = sem sessão) */
  viewer: BiViewer | null
  ctx: BiServerContext
}): Composed {
  const { req, config, actor, viewer, ctx } = args

  // O usuário final nunca define o indicador: vale o salvo. O membro pode testar uma edição que ainda não foi salva.
  const saved = (config?.widgets || []).find(w => w.id === req.widgetId)
  const base: BiWidget | undefined = actor === 'member' && req.widget ? req.widget : saved
  if (!base) return fail(404, 'widget_not_found', 'Indicador não encontrado.')

  if (actor !== 'member' && !drillAllowed(base, req.drill)) return fail(400, 'drill_not_allowed', 'Detalhamento não permitido neste indicador.')

  // Acesso por linha: usuário final sempre (sem usuário a regra nega); membro só se estiver testando como um usuário
  const rules = cleanRlsRules(config?.rls)
  let access: AccessResult = { conditions: [] }
  if (rules.length > 0 && (actor === 'end_user' || viewer)) access = rlsAccess(rules, viewer)
  if (access.denied) return fail(403, 'denied', 'Acesso negado pela regra de acesso por linha.', access.denied)

  const withCross = (w: BiWidget): BiWidget => {
    const extra = crossConditionsFor(base, req.cross)
    return extra.length ? { ...w, conditions: [...(w.conditions || []), ...extra] } : w
  }
  const drilled = withAccess(applyDrill(base, req.drill), access)
  const effective = withCross(drilled)

  const planInput = (widget: BiWidget) => ({
    widget,
    models: ctx.models,
    relations: ctx.relations,
    dialect: ctx.dialect,
    layoutJoins: ctx.joins,
    screenFilters: req.filters,
    period: req.period,
    legacy: req.legacy,
    failureReason: req.reason,
    projectSlug: ctx.projectSlug,
    rawRowLimit: BI_ROW_LIMIT,
    maxGroups: BI_MAX_GROUPS,
  })

  const plan = planWidgetQuery(planInput(effective))

  if (req.part === 'records') {
    // as linhas do grupo clicado: o grupo (campo, tipo, granularidade) é o que o planejador diz, não o que o navegador diz
    const bucketConds = plan.group && req.bucket !== undefined ? bucketConditions(plan.group, req.bucket) : []
    const ew = withCross({ ...drilled, conditions: [...(drilled.conditions || []), ...bucketConds] })
    const rec = planRecordsQuery({
      widget: ew, models: ctx.models, relations: ctx.relations, dialect: ctx.dialect,
      period: req.period, screenFilters: req.filters, projectSlug: ctx.projectSlug, limit: BI_RECORDS_LIMIT,
    })
    if (rec.kind === 'error' || !rec.sql) return fail(422, 'plan_error', rec.message || 'Não foi possível montar a consulta')
    return { ok: true, sql: rec.sql, limit: rec.limit, schemaName: rec.schemaName, tableName: rec.tableName, kind: 'records' }
  }

  if (plan.kind === 'error' || !plan.sql) return fail(422, 'plan_error', plan.message || 'Não foi possível montar a consulta')

  if (req.part === 'prev') {
    if (!plan.prev) return fail(404, 'no_previous', 'Este indicador não compara com o período anterior.')
    return { ok: true, sql: plan.prev.sql, limit: plan.prev.limit, schemaName: plan.schemaName, tableName: plan.tableName, kind: 'prev' }
  }
  return { ok: true, sql: plan.sql, limit: plan.limit ?? BI_ROW_LIMIT, schemaName: plan.schemaName, tableName: plan.tableName, kind: plan.kind }
}

/** Quem está vendo o painel, a partir da sessão ASSINADA do usuário final (visitante anônimo e sem sessão = null). */
export function viewerFromSession(session: { sub: string; email?: string; name?: string; attrs?: Record<string, unknown>; row?: Record<string, unknown> } | null | undefined): BiViewer | null {
  if (!session || String(session.sub).startsWith('anon:')) return null
  return { email: session.email ?? null, name: session.name ?? null, attrs: { ...(session.attrs || {}), ...(session.row || {}) } }
}
