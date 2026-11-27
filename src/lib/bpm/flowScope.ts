/**
 * Escopo dos fluxos de automação: um fluxo é da TABELA (o motor dispara por tabela + evento), ou "Geral" quando nenhum gatilho tem
 * tabela (agendado e webhook). O caso de uso (`use_case_id`) não entra: ele só dizia em qual tela o fluxo foi desenhado.
 *
 * Regra: o fluxo pertence a cada tabela que algum gatilho seu escolheu como "tabela alvo"; sem nenhuma, é Geral. Vale para o desenho
 * publicado e para o rascunho (um fluxo cuja tabela mudou no rascunho aparece nas duas listas até ser publicado).
 */

export type FlowScope = { kind: 'general' } | { kind: 'table'; modelId: string }

interface FlowLike {
  flow_data?: any
  draft_flow_data?: any
}

const nodesOf = (data: any): any[] => (data && Array.isArray(data.nodes) ? data.nodes : [])

/** Ids das tabelas (modelos) escolhidas nos gatilhos do fluxo, sem repetir. */
export function triggerModelIds(flow: FlowLike): string[] {
  const ids = new Set<string>()
  for (const data of [flow?.flow_data, flow?.draft_flow_data]) {
    for (const n of nodesOf(data)) {
      if (n?.type !== 'trigger') continue
      const id = n?.data?.triggerModelId
      if (typeof id === 'string' && id) ids.add(id)
    }
  }
  return [...ids]
}

export const isGeneralFlow = (flow: FlowLike): boolean => triggerModelIds(flow).length === 0

export function flowInScope(flow: FlowLike, scope: FlowScope): boolean {
  return scope.kind === 'general' ? isGeneralFlow(flow) : triggerModelIds(flow).includes(scope.modelId)
}

export function filterFlowsByScope<T extends FlowLike>(flows: T[], scope: FlowScope): T[] {
  return (flows || []).filter(f => flowInScope(f, scope))
}

/** Quantos fluxos há em "Geral" e em cada tabela (um fluxo com duas tabelas conta nas duas). */
export function scopeCounts(flows: FlowLike[]): { general: number; byModel: Record<string, number> } {
  const byModel: Record<string, number> = {}
  let general = 0
  for (const f of flows || []) {
    const ids = triggerModelIds(f)
    if (ids.length === 0) general++
    for (const id of ids) byModel[id] = (byModel[id] || 0) + 1
  }
  return { general, byModel }
}

/** Escopo de abertura de um fluxo (a primeira tabela, ou Geral): para o link "abrir este fluxo". */
export function primaryScopeOf(flow: FlowLike): FlowScope {
  const ids = triggerModelIds(flow)
  return ids.length ? { kind: 'table', modelId: ids[0] } : { kind: 'general' }
}

/** Lê o escopo da URL: `?table=<id>` ou `?scope=general`; sem nenhum dos dois, não há escopo (painel de escolha). */
export function parseScopeParams(params: { table?: unknown; scope?: unknown } | null | undefined): FlowScope | null {
  const table = typeof params?.table === 'string' ? params.table : ''
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(table)) return { kind: 'table', modelId: table }
  if (params?.scope === 'general') return { kind: 'general' }
  return null
}

/** Endereço do editor (ou do painel, sem escopo). */
export function automationsHref(base: string, scope?: FlowScope | null, flowId?: string): string {
  const q = new URLSearchParams()
  if (scope?.kind === 'table') q.set('table', scope.modelId)
  else if (scope?.kind === 'general') q.set('scope', 'general')
  if (flowId && scope) q.set('flow', flowId)
  const s = q.toString()
  return `${base}/automations${s ? `?${s}` : ''}`
}
