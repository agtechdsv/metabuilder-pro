import { describe, it, expect, vi, beforeEach } from 'vitest'

const authorize = vi.fn()
const tunnelSend = vi.fn()
const getToken = vi.fn()
let relayOn = true

vi.mock('@/lib/tunnel/authorize', () => ({ authorizeProjectActor: (...a: any[]) => authorize(...a) }))
vi.mock('@/lib/tunnel/server', () => ({
  relayEnabled: () => relayOn,
  tunnelSend: (...a: any[]) => tunnelSend(...a),
  getProjectSecretToken: (...a: any[]) => getToken(...a),
}))

import { POST } from '../route'

const PID = '123e4567-e89b-42d3-a456-426614174000'
const call = (body: any, headers: Record<string, string> = {}) =>
  POST(new Request('http://x/api/tunnel/send', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers }) as any)
const cmd = (over: any = {}) => ({ projectId: PID, event: 'sql_query', payload: { queryId: 'q1', action: 'select', query: 'SELECT 1', token: 'FALSO', ...over } })

beforeEach(() => {
  authorize.mockReset(); tunnelSend.mockReset(); getToken.mockReset(); relayOn = true
  getToken.mockResolvedValue('token-real')
  tunnelSend.mockResolvedValue(undefined)
})

describe('POST /api/tunnel/send', () => {
  it('desligado: 503 e nada é enviado', async () => {
    relayOn = false
    expect((await call(cmd())).status).toBe(503)
    expect(tunnelSend).not.toHaveBeenCalled()
  })

  it('pedido malformado: 400', async () => {
    expect((await call('{quebrado')).status).toBe(400)
    expect((await call({ projectId: 'x', event: 'sql_query', payload: {} })).status).toBe(400)
    expect((await call({ ...cmd(), event: 'outro' })).status).toBe(400)
  })

  it('sem sessão válida: 401, sem consultar o token', async () => {
    authorize.mockResolvedValue(null)
    expect((await call(cmd())).status).toBe(401)
    expect(getToken).not.toHaveBeenCalled()
    expect(tunnelSend).not.toHaveBeenCalled()
  })

  it('membro: envia com o token DO SERVIDOR (o do navegador é descartado)', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    const res = await call(cmd())
    expect(res.status).toBe(202)
    expect(tunnelSend).toHaveBeenCalledTimes(1)
    const [pid, event, payload] = tunnelSend.mock.calls[0]
    expect(pid).toBe(PID)
    expect(event).toBe('sql_query')
    expect(payload.token).toBe('token-real')
    expect(payload.queryId).toBe('q1')
  })

  it('usuário final: consulta passa, SQL livre e ações do desenvolvedor não', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    expect((await call(cmd())).status).toBe(202)
    expect((await call(cmd({ action: 'raw_sql' }))).status).toBe(403)
    expect((await call(cmd({ action: 'sync_bpm' }))).status).toBe(403)
    expect(tunnelSend).toHaveBeenCalledTimes(1)
  })

  it('login nunca passa pelo relay, nem para o desenvolvedor', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    expect((await call(cmd({ action: 'validate_login' }))).status).toBe(403)
  })

  it('projeto sem token: 404; falha no envio: 502', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    getToken.mockResolvedValueOnce(null)
    expect((await call(cmd())).status).toBe(404)
    tunnelSend.mockRejectedValueOnce(new Error('HTTP 500'))
    expect((await call(cmd())).status).toBe(502)
  })

  it('corpo declarado maior que o limite: 413', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    expect((await call(cmd(), { 'content-length': String(5 * 1024 * 1024) })).status).toBe(413)
  })
})
