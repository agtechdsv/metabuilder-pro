import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const authorize = vi.fn()
const tunnelSend = vi.fn()
const getToken = vi.fn()

vi.mock('@/lib/tunnel/authorize', () => ({ authorizeProjectActor: (...a: any[]) => authorize(...a) }))
vi.mock('@/lib/tunnel/server', () => ({
  tunnelSend: (...a: any[]) => tunnelSend(...a),
  getProjectSecretToken: (...a: any[]) => getToken(...a),
}))

const accessFor = vi.fn()
vi.mock('@/lib/rowPolicy/server', () => ({ accessForSession: (...a: any[]) => accessFor(...a) }))

const accessCtx = vi.fn()
vi.mock('@/lib/tunnel/tableAccess', async () => {
  const real = await vi.importActual<typeof import('@/lib/tunnel/tableAccess')>('@/lib/tunnel/tableAccess')
  return { ...real, loadAccessContext: (...a: any[]) => accessCtx(...a) }
})

import { POST } from '../route'

const PID = '123e4567-e89b-42d3-a456-426614174000'
const call = (body: any, headers: Record<string, string> = {}) =>
  POST(new Request('http://x/api/tunnel/send', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers }) as any)
const cmd = (over: any = {}) => ({ projectId: PID, event: 'sql_query', payload: { queryId: 'q1', action: 'select', query: 'SELECT 1', token: 'FALSO', ...over } })

beforeEach(() => {
  authorize.mockReset(); tunnelSend.mockReset(); getToken.mockReset()
  getToken.mockResolvedValue('token-real')
  tunnelSend.mockResolvedValue(undefined)
  accessFor.mockReset()
  accessFor.mockResolvedValue({ policies: [], flags: {} })
})

describe('POST /api/tunnel/send', () => {
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

  it('membro: o comando vai assinado com o token DO SERVIDOR, sem token (o do navegador é descartado)', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    const res = await call(cmd())
    expect(res.status).toBe(202)
    expect(tunnelSend).toHaveBeenCalledTimes(1)
    const [pid, event, payload] = tunnelSend.mock.calls[0]
    expect(pid).toBe(PID)
    expect(event).toBe('sql_query')
    expect(payload.token).toBeUndefined()
    expect(typeof payload.sig).toBe('string')
    expect(payload.queryId).toBe('q1')
  })

  it('usuário final: consulta passa, SQL livre e ações do desenvolvedor não', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    expect((await call(cmd())).status).toBe(202)
    expect((await call(cmd({ action: 'raw_sql' }))).status).toBe(403)
    expect((await call(cmd({ action: 'sync_bpm' }))).status).toBe(403)
    expect(tunnelSend).toHaveBeenCalledTimes(1)
  })

  describe('acesso por tabela do usuário final (permissões e regras por linha)', () => {
    const session = { pid: PID, sub: '5', email: 'maria@x.com' }

    it('o comando do usuário final vai com `access` resolvido pelo servidor (assinado em v2); o do membro vai sem', async () => {
      const access = { policies: [{ table: 'pedidos', conds: [{ column: 'funcionario_id', op: 'eq', values: ['7'] }] }], flags: { clientes: { delete: false } } }
      accessFor.mockResolvedValue(access)
      authorize.mockResolvedValue({ kind: 'end_user', session })
      expect((await call(cmd())).status).toBe(202)
      expect(accessFor).toHaveBeenCalledWith(PID, session)
      expect(tunnelSend.mock.calls[0][2].access).toEqual(access)

      authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
      expect((await call(cmd())).status).toBe(202)
      expect(tunnelSend.mock.calls[1][2].access).toBeUndefined()
    })

    it('um `access` enviado pelo navegador é descartado (o servidor é quem define)', async () => {
      authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
      await call(cmd({ access: { policies: [], flags: {} } }))
      expect(tunnelSend.mock.calls[0][2].access).toBeUndefined()
      authorize.mockResolvedValue({ kind: 'end_user', session })
      await call(cmd({ access: { policies: [], flags: { pedidos: { delete: true } } } }))
      expect(tunnelSend.mock.calls[1][2].access).toEqual({ policies: [], flags: {} })
    })

    it('sem conseguir ler as regras de acesso, o usuário final é recusado (falha fechada)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      accessFor.mockRejectedValue(new Error('banco fora'))
      authorize.mockResolvedValue({ kind: 'end_user', session })
      expect((await call(cmd())).status).toBe(503)
      expect(tunnelSend).not.toHaveBeenCalled()
    })
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

  describe('conferência de tabelas do usuário final (TUNNEL_GUARD)', () => {
    const ctx = { allowedTables: new Set(['clientes']), authTable: 'usuarios' }
    beforeEach(() => {
      accessCtx.mockReset(); accessCtx.mockResolvedValue(ctx)
      authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    })
    afterEach(() => { delete process.env.TUNNEL_GUARD; vi.restoreAllMocks() })

    it('observar (padrão): registra a violação mas deixa passar', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect((await call(cmd({ table: 'usuarios', query: 'SELECT * FROM usuarios' }))).status).toBe(202)
      expect(tunnelSend).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toContain('auth_table')
    })

    it('exigir: recusa tabela fora do projeto e SQL de escrita; consulta normal passa', async () => {
      process.env.TUNNEL_GUARD = 'enforce'
      expect((await call(cmd({ table: 'usuarios', query: 'SELECT * FROM usuarios' }))).status).toBe(403)
      expect((await call(cmd({ table: 'clientes', query: 'DELETE FROM clientes' }))).status).toBe(403)
      expect(tunnelSend).not.toHaveBeenCalled()
      expect((await call(cmd({ table: 'clientes', query: 'SELECT * FROM clientes' }))).status).toBe(202)
    })

    it('exigir: se não consegue conferir, recusa (falha fechada)', async () => {
      process.env.TUNNEL_GUARD = 'enforce'
      vi.spyOn(console, 'error').mockImplementation(() => {})
      accessCtx.mockRejectedValue(new Error('banco fora'))
      expect((await call(cmd({ table: 'clientes' }))).status).toBe(503)
    })

    it('desligado, e membros do projeto, não são conferidos', async () => {
      process.env.TUNNEL_GUARD = 'off'
      expect((await call(cmd({ table: 'usuarios' }))).status).toBe(202)
      process.env.TUNNEL_GUARD = 'enforce'
      authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
      expect((await call(cmd({ table: 'usuarios', query: 'SELECT * FROM usuarios' }))).status).toBe(202)
      expect(accessCtx).not.toHaveBeenCalled()
    })
  })

  describe('tópico de resposta da aba', () => {
    const TOPIC = `tunnel:${PID}:abcdefghijklmnopqrstuv`

    it('o comando vai assinado e SEM token; o tópico de resposta da aba é mantido', async () => {
      authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
      expect((await call(cmd({ replyTo: TOPIC }))).status).toBe(202)
      const sent = tunnelSend.mock.calls[0][2]
      expect(sent.token).toBeUndefined()
      expect(typeof sent.sig).toBe('string')
      expect(sent.replyTo).toBe(TOPIC)
    })

    it('tópico de resposta de outro projeto ou fora do padrão é descartado', async () => {
      authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
      await call(cmd({ replyTo: 'tunnel:outro-projeto:abcdefghijklmnopqrstuv' }))
      expect(tunnelSend.mock.calls[0][2].replyTo).toBeUndefined()
      await call(cmd({ replyTo: 'sala-publica' }))
      expect(tunnelSend.mock.calls[1][2].replyTo).toBeUndefined()
    })
  })
})
