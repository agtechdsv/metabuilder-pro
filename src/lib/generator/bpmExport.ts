import type { BpmExport, DbType, BackendStack } from './ast'

/**
 * Fluxos BPM no app exportado (ver docs/bpm-exportacao-desenho.md). Primeiro corte: app Node com PostgreSQL ou Oracle.
 * Os fluxos viram um RETRATO: o app só muda quando o projeto é exportado/sincronizado de novo.
 */

const HOOK_TRIGGERS = ['INSERT', 'UPDATE', 'DELETE', 'BEFORE_INSERT', 'BEFORE_UPDATE', 'BEFORE_DELETE']

const triggerTypesOf = (node: any): string[] => {
  const raw = node?.data?.triggerType
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((t: any) => String(t).toUpperCase())
}

export function bpmSupported(dbStack: DbType, backendStack: BackendStack | undefined): boolean {
  return (dbStack === 'postgres' || dbStack === 'oracle') && (backendStack ?? 'nodejs') === 'nodejs'
}

/** Nome da tabela como o app a usa nas consultas (sem o schema). */
export const bpmTableName = (dbTable: string) => String(dbTable || '').split('.').pop() as string

export function buildBpmExport(
  rawWorkflows: any[] | undefined,
  models: Array<{ id: string; dbTable: string }>,
  dbStack: DbType,
  backendStack: BackendStack | undefined,
): BpmExport | undefined {
  if (!bpmSupported(dbStack, backendStack)) return undefined
  const flows = (rawWorkflows || [])
    .filter(w => w && w.is_active !== false && w.flow_data && Array.isArray(w.flow_data.nodes))
    .map(w => ({ id: String(w.id), name: String(w.name || 'Fluxo'), flow_data: { nodes: w.flow_data.nodes, edges: Array.isArray(w.flow_data.edges) ? w.flow_data.edges : [] } }))
  if (flows.length === 0) return undefined

  const modelMap: Record<string, string> = {}
  for (const m of models) modelMap[m.id] = bpmTableName(m.dbTable)

  const hooked = new Set<string>()
  let hasWebhook = false
  let hasSchedule = false
  for (const f of flows) {
    for (const node of f.flow_data.nodes) {
      if (node?.type !== 'trigger') continue
      const types = triggerTypesOf(node)
      if (types.includes('WEBHOOK')) hasWebhook = true
      if (types.includes('SCHEDULED')) hasSchedule = true
      const table = modelMap[node.data?.triggerModelId]
      if (table && types.some(t => HOOK_TRIGGERS.includes(t))) hooked.add(table)
    }
  }

  return { dialect: dbStack as 'postgres' | 'oracle', models: modelMap, flows, hookedTables: [...hooked].sort(), hasWebhook, hasSchedule }
}
