import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const authorize = vi.fn()
const loadCtx = vi.fn()
const tunnelCall = vi.fn()
const getToken = vi.fn()
const accessCtx = vi.fn()
const accessFor = vi.fn()
vi.mock('@/lib/rowPolicy/server', () => ({ accessForSession: (...a: any[]) => accessFor(...a) }))

vi.mock('@/lib/tunnel/authorize', () => ({ authorizeProjectActor: (...a: any[]) => authorize(...a) }))
vi.mock('@/lib/bi/serverContext', () => ({ loadBiContext: (...a: any[]) => loadCtx(...a) }))
vi.mock('@/lib/tunnel/server', () => {
  class TunnelTimeoutError extends Error { constructor(public ms: number) { super('timeout') } }
  return { tunnelCall: (...a: any[]) => tunnelCall(...a), getProjectSecretToken: (...a: any[]) => getToken(...a), TunnelTimeoutError }
})
vi.mock('@/lib/tunnel/tableAccess', async () => {
  const real = await vi.importActual<typeof import('@/lib/tunnel/tableAccess')>('@/lib/tunnel/tableAccess')
  return { ...real, loadAccessContext: (...a: any[]) => accessCtx(...a) }
})
// a sessão assinada: aqui o cookie guarda o próprio JSON (a verificação real da assinatura é testada em sessionToken)
vi.mock('@/lib/tunnel/sessionToken', () => ({
  endUserCookieName: (p: string) => `mb_eu_${p}`,
  verifyEndUserSession: (v: string | undefined) => { try { return v ? JSON.parse(v) : null } catch { return null } },
}))

import { NextRequest } from 'next/server'
import { POST } from '../route'
import { TunnelTimeoutError } from '@/lib/tunnel/server'

const PID = '123e4567-e89b-42d3-a456-426614174000'
let n = 0
const f = (m: string, c: string, t: string, x: any = {}) => ({ id: `${m}.${c}`, db_column_name: c, data_type: t, order_index: n++, ...x })
const models = [
  { id: 'm_ped', db_table_name: 'pedidos', db_schema_name: 'crm', fields: [f('ped', 'id', 'uuid', { is_primary_key: true }), f('ped', 'funcionario_id', 'uuid'), f('ped', 'status', 'text')] },
  { id: 'm_fun', db_table_name: 'funcionarios', db_schema_name: 'crm', fields: [f('fun', 'id', 'uuid', { is_primary_key: true }), f('fun', 'email', 'text')] },
]
const relations = [{ id: 'r', from_model_id: 'm_ped', from_field_id: 'ped.funcionario_id', to_model_id: 'm_fun', to_field_id: 'fun.id' }]
const config = {
  widgets: [{ id: 'w1', type: 'kpi', model_id: 'm_ped', calc: 'COUNT', field: '', width: 'third' }],
  rls: [{ id: 'r1', field: 'funcionarios.email', op: 'eq', source: 'user.email' }],
}
const sessionCookie = (s: any) => `mb_eu_${PID}=${JSON.stringify(s)}`

const call = (body: any, cookie = '') =>
  POST(new NextRequest('http://x/api/bi/query', { method: 'POST', body: JSON.stringify(body), headers: cookie ? { cookie } : {} }))
const ask = (over: any = {}) => ({ projectId: PID, viewId: 'v1', widgetId: 'w1', part: 'main', ...over })

beforeEach(() => {
  authorize.mockReset(); loadCtx.mockReset(); tunnelCall.mockReset(); getToken.mockReset(); accessCtx.mockReset()
  loadCtx.mockResolvedValue({ ok: true, value: { config, ctx: { models, relations, joins: [], dialect: 'postgres', projectSlug: 'x' } } })
  getToken.mockResolvedValue('token-real')
  accessCtx.mockResolvedValue({ allowedTables: new Set(['pedidos', 'funcionarios']), authTable: 'usuarios' })
  tunnelCall.mockResolvedValue({ success: true, data: [{ bi_value: 3 }] })
  accessFor.mockReset()
  accessFor.mockResolvedValue({ policies: [], flags: {} })
})
afterEach(() => { delete process.env.TUNNEL_GUARD; vi.restoreAllMocks() })

describe('POST /api/bi/query', () => {
  it('pedido inválido: 400; sem sessão: 401 e nada vai ao túnel', async () => {
    expect((await call({ projectId: PID })).status).toBe(400)
    authorize.mockResolvedValue(null)
    expect((await call(ask())).status).toBe(401)
    expect(tunnelCall).not.toHaveBeenCalled()
  })

  it('usuário final: o SQL leva a regra com o e-mail da SESSÃO, o comando vai assinado (com o token do servidor) e volta o resultado', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    const res = await call(ask(), sessionCookie({ pid: PID, sub: '5', email: 'maria@x.com' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: [{ bi_value: 3 }] })
    const [pid, event, payload, opts] = tunnelCall.mock.calls[0]
    expect(pid).toBe(PID)
    expect(event).toBe('sql_query')
    expect(payload.sql).toContain('maria@x.com')
    expect(payload.action).toBe('select')
    expect(opts.secret).toBe('token-real')
    expect(payload.token).toBeUndefined()
  })

  it('as regras de acesso das TABELAS (não só as do painel) vão no comando do usuário final; o membro vai sem', async () => {
    const access = { policies: [{ table: 'pedidos', conds: [{ column: 'funcionario_id', op: 'eq', values: ['7'] }] }], flags: {} }
    accessFor.mockResolvedValue(access)
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    await call(ask(), sessionCookie({ pid: PID, sub: '5', email: 'maria@x.com' }))
    expect(tunnelCall.mock.calls[0][2].access).toEqual(access)
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    await call(ask())
    expect(tunnelCall.mock.calls[1][2].access).toBeUndefined()
  })

  it('usuário final sem sessão com regra cadastrada: 403 com o motivo, sem consultar o banco', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: 'anon:1.1.1.1' } })
    const res = await call(ask())
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'denied', denied: { code: 'no_viewer' } })
    expect(tunnelCall).not.toHaveBeenCalled()
  })

  it('um cookie de exibição adulterado não vale: o e-mail vem só da sessão assinada', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    const forged = encodeURIComponent(JSON.stringify({ email: 'chefe@x.com' }))
    await call(ask(), `${sessionCookie({ pid: PID, sub: '5', email: 'maria@x.com' })}; client_session_${PID}=${forged}`)
    expect(tunnelCall.mock.calls[0][2].sql).toContain('maria@x.com')
    expect(tunnelCall.mock.calls[0][2].sql).not.toContain('chefe@x.com')
  })

  it('o indicador enviado pelo usuário final é ignorado', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    await call(ask({ widget: { id: 'w1', type: 'kpi', model_id: 'm_fun', calc: 'COUNT', field: '', conditions: [] } }), sessionCookie({ pid: PID, sub: '5', email: 'maria@x.com' }))
    expect(tunnelCall.mock.calls[0][2].table).toBe('pedidos')
  })

  it('membro: usa o indicador enviado e, sem estar testando como usuário, sem a regra', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    await call(ask({ widget: { id: 'w1', type: 'kpi', model_id: 'm_fun', calc: 'COUNT', field: '', width: 'third' } }))
    expect(tunnelCall.mock.calls[0][2].table).toBe('funcionarios')
    expect(tunnelCall.mock.calls[0][2].sql).not.toContain('@')
    expect(loadCtx).toHaveBeenCalledWith(PID, 'v1', { draft: false })
  })

  it('o rascunho só é pedido ao banco se for membro', async () => {
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    await call(ask({ draft: true }), sessionCookie({ pid: PID, sub: '5', email: 'a@x.com' }))
    expect(loadCtx).toHaveBeenLastCalledWith(PID, 'v1', { draft: false })
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    await call(ask({ draft: true }))
    expect(loadCtx).toHaveBeenLastCalledWith(PID, 'v1', { draft: true })
  })

  it('tela de outro projeto ou inexistente: o status do carregamento', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    loadCtx.mockResolvedValue({ ok: false, status: 404, code: 'view_not_found', message: 'Tela não encontrada.' })
    expect((await call(ask())).status).toBe(404)
    expect(tunnelCall).not.toHaveBeenCalled()
  })

  it('conferência de tabelas (TUNNEL_GUARD): em exigir recusa tabela fora do projeto do usuário final', async () => {
    process.env.TUNNEL_GUARD = 'enforce'
    accessCtx.mockResolvedValue({ allowedTables: new Set(['clientes']), authTable: 'usuarios' })
    authorize.mockResolvedValue({ kind: 'end_user', session: { pid: PID, sub: '5' } })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cookie = sessionCookie({ pid: PID, sub: '5', email: 'a@x.com' })
    expect((await call(ask(), cookie)).status).toBe(403)
    expect(tunnelCall).not.toHaveBeenCalled()
    // em observar (padrão) só registra
    process.env.TUNNEL_GUARD = 'observe'
    expect((await call(ask(), cookie)).status).toBe(200)
  })

  it('tempo esgotado no túnel: 504; falha de transporte: 502', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    tunnelCall.mockRejectedValueOnce(new TunnelTimeoutError(30000))
    expect((await call(ask())).status).toBe(504)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    tunnelCall.mockRejectedValueOnce(new Error('HTTP 500'))
    expect((await call(ask())).status).toBe(502)
  })

  it('projeto sem token: 404', async () => {
    authorize.mockResolvedValue({ kind: 'member', userId: 'u1' })
    getToken.mockResolvedValue(null)
    expect((await call(ask())).status).toBe(404)
  })
})
