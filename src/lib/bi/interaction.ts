/**
 * Interações do painel de BI (Fase 4): filtro cruzado e drill-down.
 *
 * Tudo aqui é puro (sem React, sem SQL): transforma o clique do usuário numa lista de condições que o planejador
 * (widgetPlan) já sabe executar. O painel em execução e o app exportado usam estas mesmas funções.
 */
import type { BiWidget, BiWidgetCondition } from './widget'

export type GroupKind = 'text' | 'number' | 'date'

/** Como o gráfico está agrupado (informado pelo planejador): campo a filtrar, tipo e granularidade de data. */
export interface GroupInfo { field: string; kind: GroupKind; granularity?: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}/
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** Último dia do mês (m de 1 a 12). */
function lastDayOf(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Segunda-feira da semana ISO (ano ISO + número da semana). */
function isoWeekMonday(y: number, w: number): Date {
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const dow = jan4.getUTCDay() || 7
  const mondayW1 = new Date(Date.UTC(y, 0, 4 - (dow - 1)))
  return new Date(mondayW1.getTime() + (w - 1) * 7 * 86400000)
}

/** Intervalo [de, até] (datas inclusivas, YYYY-MM-DD) que o rótulo do grupo representa, ou null se não reconhecido. */
export function bucketRange(granularity: string, name: string): { from: string; to: string } | null {
  const n = name.trim()
  let m: RegExpMatchArray | null
  switch (granularity) {
    case 'day':
      return /^\d{4}-\d{2}-\d{2}$/.test(n) ? { from: n, to: n } : null
    case 'month':
      m = n.match(/^(\d{4})-(\d{2})$/)
      return m ? { from: iso(+m[1], +m[2], 1), to: iso(+m[1], +m[2], lastDayOf(+m[1], +m[2])) } : null
    case 'year':
      m = n.match(/^(\d{4})$/)
      return m ? { from: iso(+m[1], 1, 1), to: iso(+m[1], 12, 31) } : null
    case 'quarter': {
      m = n.match(/^(\d{4})-T([1-4])$/)
      if (!m) return null
      const startMonth = (+m[2] - 1) * 3 + 1
      return { from: iso(+m[1], startMonth, 1), to: iso(+m[1], startMonth + 2, lastDayOf(+m[1], startMonth + 2)) }
    }
    case 'week': {
      m = n.match(/^(\d{4})-S(\d{1,2})$/)
      if (!m) return null
      const mon = isoWeekMonday(+m[1], +m[2])
      const sun = new Date(mon.getTime() + 6 * 86400000)
      return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
    }
  }
  return null
}

/** Condições que selecionam o grupo clicado (a barra/fatia de nome `name`). */
export function bucketConditions(group: GroupInfo, name: string): BiWidgetCondition[] {
  const field = group.field
  if (name === 'N/A') return [{ field, op: 'is_null' }]
  if (group.kind === 'date') {
    if (group.granularity) {
      const r = bucketRange(group.granularity, name)
      return r ? [{ field, op: 'between', value: r.from, value2: r.to }] : []
    }
    // sem granularidade o grupo é o valor da data (às vezes com hora): compara o dia
    return DATE_RE.test(name) ? [{ field, op: 'eq', value: name.slice(0, 10) }] : []
  }
  return [{ field, op: 'eq', value: name }]
}

/** Próximo nível de data ao detalhar (semana vai direto para o dia). */
export function nextGranularity(g: string | undefined): string | null {
  switch (g) {
    case 'year': return 'quarter'
    case 'quarter': return 'month'
    case 'month': return 'day'
    case 'week': return 'day'
    default: return null
  }
}

// ── Drill-down ────────────────────────────────────────────────────────────────

/** Um nível aberto: o novo agrupamento, o filtro que o abriu e o texto do caminho. */
export interface DrillLevel {
  group_by: string
  date_granularity?: string
  conds: BiWidgetCondition[]
  label: string
}

/** Como o gráfico está agrupado agora (widget original ou o último nível aberto). */
function currentGroupBy(widget: BiWidget, stack: DrillLevel[]) {
  const last = stack[stack.length - 1]
  return last
    ? { group_by: last.group_by, date_granularity: last.date_granularity }
    : { group_by: widget.group_by || '', date_granularity: widget.date_granularity }
}

/** Para onde o "detalhar" levaria (null = não há próximo nível). `group` é o agrupamento atual segundo o planejador. */
export function drillTarget(widget: BiWidget, stack: DrillLevel[], group: GroupInfo | null | undefined): { group_by: string; date_granularity?: string } | null {
  if (!widget.drill_detail || !widget.group_by || !group) return null
  const cur = currentGroupBy(widget, stack)
  if (group.kind === 'date' && cur.date_granularity) {
    const next = nextGranularity(cur.date_granularity)
    if (next) return { group_by: cur.group_by, date_granularity: next }
  }
  // dimensão do próximo nível: só uma vez e só se for diferente do agrupamento atual
  if (widget.drill_by && stack.every(l => l.group_by !== widget.drill_by) && cur.group_by !== widget.drill_by) {
    return { group_by: widget.drill_by }
  }
  return null
}

/** Abre o próximo nível para o grupo clicado (null se não houver). */
export function drillInto(widget: BiWidget, stack: DrillLevel[], group: GroupInfo | null | undefined, name: string): DrillLevel | null {
  const target = drillTarget(widget, stack, group)
  if (!target || !group) return null
  const conds = bucketConditions(group, name)
  if (conds.length === 0) return null
  return { ...target, conds, label: name }
}

/** O widget como deve ser consultado com os níveis abertos (agrupamento do último nível + filtros de todos). */
export function applyDrill(widget: BiWidget, stack: DrillLevel[]): BiWidget {
  if (stack.length === 0) return widget
  const last = stack[stack.length - 1]
  return {
    ...widget,
    group_by: last.group_by,
    date_granularity: last.date_granularity,
    conditions: [...(widget.conditions || []), ...stack.flatMap(l => l.conds)],
  }
}

/** Condições do caminho aberto (para "ver registros" do nível atual). */
export function drillConditions(stack: DrillLevel[]): BiWidgetCondition[] {
  return stack.flatMap(l => l.conds)
}

// ── Filtro cruzado ───────────────────────────────────────────────────────────

export interface CrossFilter {
  sourceId: string
  sourceTitle: string
  /** valor clicado, como aparece no gráfico */
  name: string
  conds: BiWidgetCondition[]
}

/** Cria o filtro cruzado de um clique (null se o grupo não pode virar condição). */
export function makeCrossFilter(source: BiWidget, group: GroupInfo | null | undefined, name: string): CrossFilter | null {
  if (!group) return null
  const conds = bucketConditions(group, name)
  if (conds.length === 0) return null
  return { sourceId: source.id, sourceTitle: source.title || 'Gráfico', name, conds }
}

/** Condições a somar às do widget `target`: só se ele responde ao filtro cruzado, e nunca as do próprio clique. */
export function crossConditionsFor(target: BiWidget, filters: CrossFilter[]): BiWidgetCondition[] {
  if (!target.cross_target) return []
  return filters.filter(f => f.sourceId !== target.id).flatMap(f => f.conds)
}

/** Clicar no mesmo valor de novo limpa o filtro; outro valor do mesmo gráfico o substitui. */
export function toggleCrossFilter(current: Record<string, CrossFilter>, next: CrossFilter): Record<string, CrossFilter> {
  const out = { ...current }
  if (out[next.sourceId] && out[next.sourceId].name === next.name) delete out[next.sourceId]
  else out[next.sourceId] = next
  return out
}
