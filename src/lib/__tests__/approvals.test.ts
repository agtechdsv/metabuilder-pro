import { describe, it, expect } from 'vitest'
import { APPROVAL_CLI_ACTION, approvalActor, approvalCommandData, parseApprovalRequest } from '../approvals'
import { APPROVAL_ACTIONS, actionAllowed, buildCommand } from '../tunnel/relayPolicy'

const PID = '123e4567-e89b-42d3-a456-426614174000'
const TASK = '9f1c2a3b-0000-4000-8000-123456789abc'

describe('parseApprovalRequest', () => {
  it('lista: pendentes por padrão; aceita as outras visões e o detalhe de uma tarefa', () => {
    expect(parseApprovalRequest({ projectId: PID, op: 'list' })).toMatchObject({ ok: true, req: { op: 'list', view: 'pending' } })
    expect(parseApprovalRequest({ projectId: PID, op: 'list', view: 'decided' })).toMatchObject({ ok: true, req: { view: 'decided' } })
    expect(parseApprovalRequest({ projectId: PID, op: 'list', taskId: TASK })).toMatchObject({ ok: true, req: { taskId: TASK } })
    expect(parseApprovalRequest({ projectId: PID, op: 'list', view: 'todas' }).ok).toBe(false)
    // contador: só vale para pendentes; nas outras visões é ignorado
    expect(parseApprovalRequest({ projectId: PID, op: 'list', view: 'pending', countOnly: true })).toMatchObject({ ok: true, req: { countOnly: true } })
    const other = parseApprovalRequest({ projectId: PID, op: 'list', view: 'decided', countOnly: true })
    expect(other.ok && other.req.countOnly).toBeUndefined()
    expect(approvalCommandData({ projectId: PID, op: 'list', view: 'pending', countOnly: true })).toEqual({ view: 'pending', countOnly: true })
  })

  it('decidir exige tarefa e decisão válidas; o comentário é aparado e limitado', () => {
    const r = parseApprovalRequest({ projectId: PID, op: 'decide', taskId: TASK, decision: 'rejected', comment: `  ${'a'.repeat(2000)}  ` })
    expect(r.ok && r.req.comment!.length).toBe(1000)
    expect(parseApprovalRequest({ projectId: PID, op: 'decide', taskId: TASK, decision: 'talvez' }).ok).toBe(false)
    expect(parseApprovalRequest({ projectId: PID, op: 'decide', decision: 'approved' }).ok).toBe(false)
    expect(parseApprovalRequest({ projectId: PID, op: 'decide', taskId: "x'; DROP TABLE", decision: 'approved' }).ok).toBe(false)
    expect(parseApprovalRequest({ projectId: PID, op: 'decide', taskId: TASK, decision: 'approved', comment: 5 }).ok).toBe(false)
  })

  it('histórico exige tabela e chave seguras (nada de aspas ou ponto e vírgula)', () => {
    expect(parseApprovalRequest({ projectId: PID, op: 'history', table: 'pedidos', pk: 7 })).toMatchObject({ ok: true, req: { table: 'pedidos', pk: '7' } })
    expect(parseApprovalRequest({ projectId: PID, op: 'history', table: 'pedidos; drop', pk: '1' }).ok).toBe(false)
    expect(parseApprovalRequest({ projectId: PID, op: 'history', table: 'pedidos', pk: "1' OR '1'='1" }).ok).toBe(false)
  })

  it('recusa projeto inválido, operação desconhecida e corpo que não é objeto', () => {
    for (const bad of [null, 'x', [], { op: 'list' }, { projectId: 'abc', op: 'list' }, { projectId: PID, op: 'raw' }, { projectId: PID }]) expect(parseApprovalRequest(bad).ok).toBe(false)
  })

  it('o comando ao CLI leva só os campos da operação', () => {
    expect(approvalCommandData({ projectId: PID, op: 'decide', taskId: TASK, decision: 'approved', comment: 'ok' })).toEqual({ taskId: TASK, decision: 'approved', comment: 'ok' })
    expect(approvalCommandData({ projectId: PID, op: 'list', view: 'requested' })).toEqual({ view: 'requested' })
    expect(approvalCommandData({ projectId: PID, op: 'admin_list' })).toEqual({})
    expect(APPROVAL_CLI_ACTION.cancel).toBe('approval_cancel')
  })
})

describe('approvalActor', () => {
  it('usuário final: id, nome, e-mail e os perfis (limpos); anônimo não tem identidade', () => {
    expect(approvalActor({ kind: 'end_user', session: { sub: '20', name: 'Gil', email: 'g@x.com' } }, ['Gerente', '', 'Vendas'])).toEqual({ id: '20', name: 'Gil', email: 'g@x.com', roles: ['Gerente', 'Vendas'] })
    expect(approvalActor({ kind: 'end_user', session: { sub: 'anon:1.2.3.4' } }, ['Gerente'])).toBeNull()
  })
  it('membro entra com id prefixado, que nunca coincide com o de um usuário do app, e sem perfis', () => {
    expect(approvalActor({ kind: 'member', userId: 'u1' }, ['Gerente'])).toEqual({ id: 'member:u1', name: 'Administrador do projeto' })
  })
})

describe('relay: as ações de aprovação só o servidor envia', () => {
  it('nem o navegador (usuário final) nem um membro pelo relay as enviam', () => {
    for (const a of APPROVAL_ACTIONS) {
      expect(actionAllowed('end_user', a).ok).toBe(false)
      expect(actionAllowed('member', a).ok).toBe(false)
    }
    expect([...APPROVAL_ACTIONS].sort()).toEqual(['approval_admin_list', 'approval_cancel', 'approval_decide', 'approval_history', 'approval_list'])
  })
  it('ator e perfis forjados no corpo do relay são descartados; só valem os que o servidor põe', () => {
    const req = { projectId: PID, event: 'sql_query', payload: { queryId: 'q', action: 'select', actor: { id: '1', roles: ['Gerente'] } } }
    const cmd: any = buildCommand(req, 'segredo', undefined, { id: '20', roles: ['Vendas'] })
    expect(JSON.stringify(cmd)).not.toContain('"Gerente"')
    expect(JSON.stringify(cmd)).toContain('"Vendas"')
  })
})
