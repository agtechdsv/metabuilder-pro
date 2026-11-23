/** Tipos do núcleo do motor de BPM (cli/bpmCore.js). Ver o cabeçalho do arquivo .js para a descrição das portas. */

export interface BpmFlow {
  id: string
  name: string
  flow_data: { nodes: BpmNode[]; edges: BpmEdge[] }
}

export interface BpmNode {
  id: string
  type: 'trigger' | 'condition' | 'action' | 'response' | string
  data?: Record<string, any>
}

export interface BpmEdge {
  id?: string
  source: string
  target: string
  sourceHandle?: string | null
}

export interface BpmRunReport {
  workflow_id: string
  workflow_name: string
  status: 'success' | 'error' | 'loop'
  trigger_source: string | null
  started_at: string
  finished_at: string
  duration_ms: number
  error_message?: string
  details?: Record<string, any>
}

export interface BpmPorts {
  db: { dialect: 'postgres' | 'oracle'; query(sql: string, params?: any[]): Promise<any[]> }
  models: { tableOf(modelId: string): Promise<string | null>; isKnownTable?(name: string): Promise<boolean> }
  http?: { request(cfg: { method: string; url: string; headers?: Record<string, string>; data?: any; timeout?: number }): Promise<{ status?: number; statusText?: string }> }
  mail?: { send(msg: { to: string; subject: string; body: string; template: string }): Promise<void>; fallbackTo?(): string }
  recipients?: { resolveSystem(nodeData: Record<string, any>): Promise<string> }
  scheduler?: { schedule(cron: string, fn: () => Promise<void> | void): { stop(): void } }
  runs?: { report(run: BpmRunReport): Promise<void> }
  log?: Partial<Record<'debug' | 'info' | 'ok' | 'warn' | 'error' | 'sql' | 'danger' | 'mail', (msg: string) => void>>
  verbose?: boolean
}

export interface BpmSyncResult {
  success: boolean
  data: Record<string, any>
  message: string | null
  error: string | null
}

export class BpmCore {
  constructor(ports: BpmPorts)
  workflows: BpmFlow[]
  setWorkflows(list: BpmFlow[]): void
  clearScheduledJobs(): void
  processEvent(table: string, actionType: string, row: Record<string, any>): Promise<void>
  processSyncEvent(table: string, actionType: string, row: Record<string, any>): Promise<BpmSyncResult>
  processWebhook(workflowId: string, data: Record<string, any>): Promise<void>
  processCustomAction(workflowIds: string[], table: string, row: Record<string, any>): Promise<void>
}

export const MAX_STEPS: number
export const WEBHOOK_TIMEOUT_MS: number
