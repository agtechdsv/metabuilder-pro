/**
 * Aguardar aprovação — regras puras do lado do servidor (sem rede), para testar sem o túnel.
 * Quem age vem SEMPRE da sessão (o servidor o assina no comando); daqui só sai a identidade e o comando limpo.
 */
import type { ActorIdentity } from '@/lib/tunnel/relayPolicy'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TASK_ID = /^[\w-]{8,64}$/
const TABLE = /^[A-Za-z0-9_]{1,128}$/
const PK = /^[\w\-.:@ ]{1,200}$/

export type ApprovalOp = 'list' | 'decide' | 'history' | 'admin_list' | 'cancel'

export interface ApprovalRequest {
  projectId: string
  op: ApprovalOp
  /** list: pendentes (padrão), as que pedi ou as que decidi */
  view?: 'pending' | 'requested' | 'decided'
  /** list (pendentes): devolve só a quantidade (contador do cabeçalho) */
  countOnly?: boolean
  /** list (detalhe de uma), decide e cancel */
  taskId?: string
  /** decide */
  decision?: 'approved' | 'rejected'
  comment?: string
  /** history */
  table?: string
  pk?: string
  /** admin_list */
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
}

/** Ação do Agente CLI de cada operação. */
export const APPROVAL_CLI_ACTION: Record<ApprovalOp, string> = {
  list: 'approval_list',
  decide: 'approval_decide',
  history: 'approval_history',
  admin_list: 'approval_admin_list',
  cancel: 'approval_cancel',
}

/** Operações que só o membro do projeto (dono/desenvolvedor) faz. */
export const MEMBER_ONLY_OPS: readonly ApprovalOp[] = ['admin_list']

export const APPROVAL_MAX_COMMENT = 1000

export function parseApprovalRequest(body: unknown): { ok: true; req: ApprovalRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Pedido inválido.' }
  const b = body as Record<string, unknown>
  if (typeof b.projectId !== 'string' || !UUID.test(b.projectId)) return { ok: false, error: 'Projeto inválido.' }
  const ops: ApprovalOp[] = ['list', 'decide', 'history', 'admin_list', 'cancel']
  if (typeof b.op !== 'string' || !ops.includes(b.op as ApprovalOp)) return { ok: false, error: 'Operação inválida.' }
  const op = b.op as ApprovalOp
  const req: ApprovalRequest = { projectId: b.projectId, op }

  const needTask = () => {
    if (typeof b.taskId !== 'string' || !TASK_ID.test(b.taskId)) return false
    req.taskId = b.taskId
    return true
  }

  if (op === 'list') {
    if (b.taskId !== undefined && b.taskId !== null && b.taskId !== '') { if (!needTask()) return { ok: false, error: 'Tarefa inválida.' } }
    else {
      const view = b.view === undefined || b.view === null || b.view === '' ? 'pending' : b.view
      if (view !== 'pending' && view !== 'requested' && view !== 'decided') return { ok: false, error: 'Lista inválida.' }
      req.view = view
      if (b.countOnly === true && view === 'pending') req.countOnly = true
    }
  } else if (op === 'decide') {
    if (!needTask()) return { ok: false, error: 'Tarefa inválida.' }
    if (b.decision !== 'approved' && b.decision !== 'rejected') return { ok: false, error: 'Decisão inválida.' }
    req.decision = b.decision
    if (b.comment !== undefined && b.comment !== null) {
      if (typeof b.comment !== 'string') return { ok: false, error: 'Comentário inválido.' }
      const c = b.comment.trim().slice(0, APPROVAL_MAX_COMMENT)
      if (c) req.comment = c
    }
  } else if (op === 'cancel') {
    if (!needTask()) return { ok: false, error: 'Tarefa inválida.' }
  } else if (op === 'history') {
    if (typeof b.table !== 'string' || !TABLE.test(b.table)) return { ok: false, error: 'Tabela inválida.' }
    const pk = typeof b.pk === 'number' ? String(b.pk) : b.pk
    if (typeof pk !== 'string' || !PK.test(pk)) return { ok: false, error: 'Registro inválido.' }
    req.table = b.table
    req.pk = pk
  } else if (op === 'admin_list') {
    if (b.status !== undefined && b.status !== null && b.status !== '') {
      if (b.status !== 'pending' && b.status !== 'approved' && b.status !== 'rejected' && b.status !== 'cancelled') return { ok: false, error: 'Situação inválida.' }
      req.status = b.status
    }
  }
  return { ok: true, req }
}

/** O comando (já sem o projectId) que vai ao Agente CLI dentro do `data`. */
export function approvalCommandData(req: ApprovalRequest): Record<string, unknown> {
  switch (req.op) {
    case 'list': return req.taskId ? { taskId: req.taskId } : { view: req.view || 'pending', ...(req.countOnly ? { countOnly: true } : {}) }
    case 'decide': return { taskId: req.taskId, decision: req.decision, comment: req.comment }
    case 'cancel': return { taskId: req.taskId }
    case 'history': return { table: req.table, pk: req.pk }
    case 'admin_list': return req.status ? { status: req.status } : {}
  }
}

/**
 * Quem age, a partir do tipo de ator que o servidor confirmou. Visitante anônimo (projeto sem login) NÃO tem identidade
 * para aprovar nada; membro entra com id prefixado para nunca coincidir com o id de um usuário do app.
 */
export function approvalActor(
  actor: { kind: 'member'; userId: string } | { kind: 'end_user'; session: { sub: string; email?: string; name?: string } },
  roles: string[],
): ActorIdentity | null {
  if (actor.kind === 'member') return { id: `member:${actor.userId}`, name: 'Administrador do projeto' }
  const sub = actor.session.sub
  if (!sub || String(sub).startsWith('anon:')) return null
  const clip = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 200) : undefined)
  const id: ActorIdentity = { id: String(sub).slice(0, 200) }
  const email = clip(actor.session.email); if (email) id.email = email
  const name = clip(actor.session.name); if (name) id.name = name
  const clean = roles.filter(r => typeof r === 'string' && r).slice(0, 50).map(r => r.slice(0, 200))
  if (clean.length) id.roles = clean
  return id
}
