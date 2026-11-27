/** Chamadas do navegador à rota /api/v1/approvals (as tarefas de "Aguardar aprovação"). Quem age vem da sessão no servidor. */

export interface ApprovalTask {
  id: string
  title: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  table: string
  recordPk: string | null
  workflow: string | null
  requestedBy: string
  requestedById: string
  createdAt: string
  decidedBy: string
  decidedAt: string | null
  comment: string
  dueAt: string | null
  allowSelf: boolean
  summary: [string, string][]
  /** só no detalhe */
  record?: Record<string, any>
}

export interface ApprovalEvent { event: 'requested' | 'approved' | 'rejected' | 'cancelled' | string; by: string; comment: string; at: string }

export type ApprovalsBody =
  | { op: 'list'; view?: 'pending' | 'requested' | 'decided' }
  | { op: 'list'; taskId: string }
  | { op: 'decide'; taskId: string; decision: 'approved' | 'rejected'; comment?: string }
  | { op: 'history'; table: string; pk: string }
  | { op: 'admin_list'; status?: string }
  | { op: 'cancel'; taskId: string }

/** Devolve `data` da resposta; lança Error com a mensagem do servidor quando falha. No modo demonstração a chamada é simulada e vem vazia. */
export async function approvalsCall<T = any>(projectId: string, body: ApprovalsBody): Promise<T | null> {
  const res = await fetch('/api/v1/approvals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, ...body }),
  })
  let json: any = null
  try { json = await res.json() } catch { /* sem corpo */ }
  if (!res.ok || json?.success === false) throw new Error(json?.error || `Erro ${res.status}`)
  return (json?.data ?? null) as T | null
}
