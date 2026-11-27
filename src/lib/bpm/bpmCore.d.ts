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
  recipients?: { resolveSystem(nodeData: Record<string, any>): Promise<string>; resolveIds?(nodeData: Record<string, any>): Promise<string[]> }
  /** Ação "Download": só o Agente CLI entrega arquivos na Central de Downloads; sem a porta, a ação para com aviso. */
  downloads?: { deliver(args: { dataset: any; format: string; fileName: string; recipientIds: string[]; title: string }): Promise<{ delivered: number }> }
  scheduler?: { schedule(cron: string, fn: () => Promise<void> | void): { stop(): void } }
  runs?: { report(run: BpmRunReport): Promise<void> }
  log?: Partial<Record<'debug' | 'info' | 'ok' | 'warn' | 'error' | 'sql' | 'danger' | 'mail', (msg: string) => void>>
  verbose?: boolean
  /** Recursos que só alguns ambientes têm: `approvals` liga o bloco "Aguardar aprovação" (só o Agente CLI; o app exportado não o tem). */
  features?: { approvals?: boolean }
  /** Gerador de ids (uuid) das tarefas de aprovação; sem ele o núcleo usa um id aleatório próprio. */
  ids?: { next(): string }
}

export interface BpmSyncResult {
  success: boolean
  data: Record<string, any>
  message: string | null
  error: string | null
}

/** Quem agiu (vem da sessão assinada do usuário final). */
export interface BpmActor { id: string; email?: string; name?: string; /** nomes dos grupos (o servidor assina); servem à aprovação por perfil */ roles?: string[] }

/** Mensagem da aba Mensagem de uma ação: texto pronto e o tipo do aviso. */
export interface BpmUserMessage { text: string; type: 'success' | 'info' | 'warning' }

export class BpmCore {
  constructor(ports: BpmPorts)
  workflows: BpmFlow[]
  setWorkflows(list: BpmFlow[]): void
  clearScheduledJobs(): void
  /** `oldRow`: o registro antes da edição (só para o gatilho de edição restrito a um campo, De/Para). */
  /** `actor` = quem agiu (sessão assinada), para {{usuario.*}}. Devolve as mensagens de sucesso das ações (aba Mensagem). */
  processEvent(table: string, actionType: string, row: Record<string, any>, oldRow?: Record<string, any> | null, actor?: BpmActor | null): Promise<BpmUserMessage[]>
  processSyncEvent(table: string, actionType: string, row: Record<string, any>, oldRow?: Record<string, any> | null, actor?: BpmActor | null): Promise<BpmSyncResult>
  /** Algum fluxo ativo escuta a edição desta tabela restrita a um campo (precisa do registro anterior)? */
  needsOldRow(table: string): Promise<boolean>
  processWebhook(workflowId: string, data: Record<string, any>): Promise<void>
  processCustomAction(workflowIds: string[], table: string, row: Record<string, any>, actor?: BpmActor | null): Promise<BpmUserMessage[]>
  /** Ações approval_* do Agente CLI (aprovações): o `actor` vem da sessão assinada pelo servidor. */
  approvalOp(action: string, data: Record<string, any>, actor?: BpmActor | null): Promise<any>
  /** Lembretes de aprovação vencidos (prazo do bloco); devolve quantos enviou. O Agente chama a cada 15 minutos. */
  sweepApprovalReminders(now?: Date): Promise<number>
  decideApproval(args: { taskId: string; decision: 'approved' | 'rejected'; comment?: string; actor: BpmActor | null }): Promise<{ ok: boolean; resumed: boolean; messages: BpmUserMessage[]; warning?: string }>
}

export function approvalDdl(dialect: 'postgres' | 'oracle'): string[]
export function approvalAssignees(data: Record<string, any>): { users: string[]; groups: string[] }
export function approvalAllows(assignees: { users: string[]; groups: string[] }, actor: BpmActor | null | undefined): boolean
export function approvalSnapshot(row: Record<string, any>): string

export const MAX_STEPS: number
export const WEBHOOK_TIMEOUT_MS: number
