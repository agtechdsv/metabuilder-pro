import { describe, it, expect, vi, beforeEach } from 'vitest'

const authorize = vi.fn()
const tunnelCall = vi.fn()
const getToken = vi.fn()
const groups = vi.fn()
const tableAccess = vi.fn()

const authorizeMember = vi.fn()
vi.mock('@/lib/tunnel/authorize', () => ({
  authorizeProjectActor: (...a: any[]) => authorize(...a),
  authorizeProjectMember: (...a: any[]) => authorizeMember(...a),
}))
vi.mock('@/lib/tunnel/server', () => ({
  getProjectSecretToken: (...a: any[]) => getToken(...a),
  tunnelCall: (...a: any[]) => tunnelCall(...a),
  TunnelTimeoutError: class TunnelTimeoutError extends Error {},
}))
vi.mock('@/lib/rowPolicy/server', () => ({
  groupNamesForSession: (...a: any[]) => groups(...a),
  loadTableAccess: (...a: any[]) => tableAccess(...a),
}))

import { POST } from '../route'

const PID = '123e4567-e89b-42d3-a456-426614174000'
const TASK = '9f1c2a3b-0000-4000-8000-123456789abc'
const call = (body: any) => POST(new Request('http://x/api/v1/approvals', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }) as any)
const gerente = { kind: 'end_user', session: { pid: PID, sub: '20', name: 'Gil' } }

beforeEach(() => {
  for (const m of [authorize, tunnelCall, getToken, groups, tableAccess, authorizeMember]) m.mockReset()
  authorizeMember.mockResolvedValue(null)
  getToken.mockResolvedValue('token-real')
  groups.mockResolvedValue(['Gerente'])
  tunnelCall.mockResolvedValue({ success: true, data: [{ ok: true }] })
  tableAccess.mockResolvedValue([{ table: 'pedidos', closed: false }, { table: 'segredos', closed: true }])
})

describe('POST /api/v1/approvals', () => {
  it('pedido malformado: 400, sem consultar a sessão', async () => {
    expect((await call('{quebrado')).status).toBe(400)
    expect((await call({ projectId: PID, op: 'raw' })).status).toBe(400)
    expect(authorize).not.toHaveBeenCalled()
  })

  it('sem sessão: 401, sem tocar no túnel', async () => {
    authorize.mockResolvedValue(null)
    expect((await call({ projectId: PID, op: 'list' })).status).toBe(401)
    expect(tunnelCall).not.toHaveBeenCalled()
  })

  it('visitante anônimo de projeto aberto não tem identidade: 401', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: 'anon:1.2.3.4' } })
    expect((await call({ projectId: PID, op: 'list' })).status).toBe(401)
    expect(tunnelCall).not.toHaveBeenCalled()
  })

  it('decidir: o ator e os perfis vêm da sessão e vão assinados; o que o corpo disser é ignorado', async () => {
    authorize.mockResolvedValue(gerente)
    const res = await call({ projectId: PID, op: 'decide', taskId: TASK, decision: 'approved', comment: 'ok', actor: { id: '1', roles: ['Diretoria'] }, roles: ['Diretoria'], token: 'FALSO' })
    expect(res.status).toBe(200)
    expect(tunnelCall).toHaveBeenCalledTimes(1)
    const [pid, event, payload, opts] = tunnelCall.mock.calls[0]
    expect(pid).toBe(PID)
    expect(event).toBe('sql_query')
    expect(payload).toMatchObject({ action: 'approval_decide', data: { taskId: TASK, decision: 'approved', comment: 'ok' }, actor: { id: '20', name: 'Gil', roles: ['Gerente'] } })
    expect(JSON.stringify(payload)).not.toMatch(/Diretoria|FALSO/)
    expect(opts.secret).toBe('token-real')
  })

  it('lista de tarefas devolve o resultado do CLI', async () => {
    authorize.mockResolvedValue(gerente)
    tunnelCall.mockResolvedValue({ success: true, data: [{ tasks: [{ id: TASK }] }] })
    const res = await call({ projectId: PID, op: 'list', view: 'pending' })
    expect(await res.json()).toEqual({ success: true, data: { tasks: [{ id: TASK }] } })
  })

  it('ver todas e cancelar são só do membro do projeto', async () => {
    authorize.mockResolvedValue(gerente)
    expect((await call({ projectId: PID, op: 'admin_list' })).status).toBe(403)
    expect((await call({ projectId: PID, op: 'cancel', taskId: TASK })).status).toBe(403)
    expect(tunnelCall).not.toHaveBeenCalled()
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    expect((await call({ projectId: PID, op: 'admin_list' })).status).toBe(200)
    expect(tunnelCall.mock.calls[0][2]).toMatchObject({ action: 'approval_admin_list', actor: { id: 'member:u1' } })
    expect(groups).not.toHaveBeenCalled() // membro não tem perfis de usuário final
  })

  it('dono que entrou no app como usuário final também administra (vale como membro só nessas operações)', async () => {
    authorize.mockResolvedValue(gerente)
    authorizeMember.mockResolvedValue({ kind: 'member', userId: 'dono' })
    expect((await call({ projectId: PID, op: 'cancel', taskId: TASK })).status).toBe(200)
    expect(tunnelCall.mock.calls[0][2]).toMatchObject({ action: 'approval_cancel', actor: { id: 'member:dono' } })
    // decidir continua sendo como usuário final (com os perfis dele)
    tunnelCall.mockClear()
    await call({ projectId: PID, op: 'decide', taskId: TASK, decision: 'approved' })
    expect(tunnelCall.mock.calls[0][2]).toMatchObject({ actor: { id: '20', roles: ['Gerente'] } })
  })

  it('histórico: usuário final só vê tabela cadastrada e não fechada para ele', async () => {
    authorize.mockResolvedValue(gerente)
    expect((await call({ projectId: PID, op: 'history', table: 'pedidos', pk: '7' })).status).toBe(200)
    expect((await call({ projectId: PID, op: 'history', table: 'segredos', pk: '7' })).status).toBe(403)
    expect((await call({ projectId: PID, op: 'history', table: 'inexistente', pk: '7' })).status).toBe(403)
    expect(tunnelCall).toHaveBeenCalledTimes(1)
  })

  it('o CLI recusa (ex.: já decidida): 422 com a mensagem; túnel parado: 504', async () => {
    authorize.mockResolvedValue(gerente)
    tunnelCall.mockResolvedValue({ success: false, error: 'Esta tarefa já foi decidida.' })
    const res = await call({ projectId: PID, op: 'decide', taskId: TASK, decision: 'approved' })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/já foi decidida/)
    const { TunnelTimeoutError } = await import('@/lib/tunnel/server')
    tunnelCall.mockRejectedValue(new (TunnelTimeoutError as any)(1000))
    expect((await call({ projectId: PID, op: 'list' })).status).toBe(504)
  })

  it('projeto sem token de túnel: 502', async () => {
    authorize.mockResolvedValue(gerente)
    getToken.mockResolvedValue(null)
    expect((await call({ projectId: PID, op: 'list' })).status).toBe(502)
  })
})
