import { describe, it, expect, vi, beforeAll } from 'vitest'
import { completeLogin, issueMfaProof, performLogin, performPasskeyLogin, securityContext, type LoginDeps } from '../loginFlow'
import { TunnelTimeoutError } from '../server'
import { buildSession, clearEndUserCookies, compactRow, displayNameOf, readClientUser, setEndUserCookies, subjectOf } from '../endUserAuth'
import { endUserCookieName, signEndUserSession, signToken } from '../sessionToken'

const PID = 'proj-1'

beforeAll(() => { process.env.RUNTIME_SESSION_SECRET = 'x'.repeat(48) })

const setup = (over: any = {}) => ({
  project: { id: PID, is_active: true },
  auth: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', db_password_column: 'senha', db_display_name_column: 'nome', db_user_role_column: 'role_id' },
  visual: {},
  schemaName: 'vendas',
  security: { mfa_enabled: false, passkey_enabled: false },
  ...over,
})

const deps = (over: Partial<LoginDeps> = {}, callResult: any = { success: true, data: [{ id: 7, email: 'ana@x.com', nome: 'Ana', role_id: 'r1' }] }): LoginDeps & { call: any } => ({
  loadSetup: async () => setup() as any,
  call: vi.fn(async () => callResult),
  secretToken: async () => 'token-do-servidor',
  newId: () => 'q-fixo',
  ...over,
}) as any

describe('performLogin', () => {
  it('valida pelo túnel com a configuração do CADASTRO e o token do servidor, e devolve a sessão', async () => {
    const d = deps()
    const r = await performLogin(d, { projectId: PID, email: 'ana@x.com', password: 'segredo' })
    expect(r.kind).toBe('ok')
    const sent = d.call.mock.calls[0][1]
    expect(sent).toMatchObject({ queryId: 'q-fixo', token: 'token-do-servidor', action: 'validate_login', schemaName: 'vendas', credentials: { email: 'ana@x.com', password: 'segredo' } })
    expect(sent.config.db_table_name).toBe('usuarios')
    if (r.kind === 'ok') {
      expect(r.session).toMatchObject({ pid: PID, sub: '7', email: 'ana@x.com', name: 'Ana', row: { role_id: 'r1' } })
      expect(r.user.__display_name).toBe('Ana')
    }
  })

  it('credenciais inválidas: 401 com a mensagem do CLI; túnel mudo: 504; erro de rede: 504', async () => {
    const bad = await performLogin(deps({}, { success: false, error: 'Senha incorreta' }), { projectId: PID, email: 'a@x.com', password: 'x' })
    expect(bad).toMatchObject({ kind: 'error', status: 401, code: 'invalid_credentials', message: 'Senha incorreta' })
    const offline = await performLogin(deps({ call: async () => { throw new TunnelTimeoutError(1000) } }), { projectId: PID, email: 'a@x.com', password: 'x' })
    expect(offline).toMatchObject({ kind: 'error', status: 504, code: 'tunnel_offline' })
    const broken = await performLogin(deps({ call: async () => { throw new Error('HTTP 500') } }), { projectId: PID, email: 'a@x.com', password: 'x' })
    expect(broken).toMatchObject({ kind: 'error', status: 504, code: 'tunnel_error' })
  })

  it('recusa entrada inválida, projeto sem login, inativo ou sem token', async () => {
    for (const input of [{ email: '', password: 'x' }, { email: 'a', password: '' }, { email: 5, password: 'x' }, { email: 'a'.repeat(300), password: 'x' }]) {
      expect((await performLogin(deps(), { projectId: PID, ...input } as any)).kind).toBe('error')
    }
    expect(await performLogin(deps({ loadSetup: async () => null }), { projectId: PID, email: 'a', password: 'b' })).toMatchObject({ status: 404 })
    expect(await performLogin(deps({ loadSetup: async () => setup({ auth: { auth_type: 'none' } }) as any }), { projectId: PID, email: 'a', password: 'b' })).toMatchObject({ code: 'no_auth' })
    expect(await performLogin(deps({ loadSetup: async () => setup({ project: { id: PID, is_active: false } }) as any }), { projectId: PID, email: 'a', password: 'b' })).toMatchObject({ code: 'inactive' })
    expect(await performLogin(deps({ secretToken: async () => null }), { projectId: PID, email: 'a', password: 'b' })).toMatchObject({ code: 'tunnel_error' })
  })

  it('com MFA exigido NÃO emite sessão: devolve o token pendente', async () => {
    const r = await performLogin(deps({ loadSetup: async () => setup({ security: { mfa_enabled: true, passkey_enabled: false } }) as any }), { projectId: PID, email: 'ana@x.com', password: 'x' })
    expect(r.kind).toBe('mfa')
    expect((r as any).session).toBeUndefined()
  })

  it('só biometria (opcional): emite a sessão e avisa que há o convite para cadastrar', async () => {
    const r = await performLogin(deps({ loadSetup: async () => setup({ security: { mfa_enabled: false, passkey_enabled: true } }) as any }), { projectId: PID, email: 'ana@x.com', password: 'x' })
    expect(r).toMatchObject({ kind: 'ok', offerPasskey: true })
    const plain: any = await performLogin(deps(), { projectId: PID, email: 'ana@x.com', password: 'x' })
    expect(plain.offerPasskey).toBeUndefined()
  })

  it('resposta sem identificação do usuário não vira sessão', async () => {
    const r = await performLogin(deps({}, { success: true, data: [{ nome: 'Sem id nem e-mail' }] }), { projectId: PID, email: 'a', password: 'b' })
    expect(r).toMatchObject({ kind: 'error', code: 'tunnel_error' })
  })
})

describe('MFA: pendente + prova → sessão', () => {
  const mfaDeps = () => deps({ loadSetup: async () => setup({ security: { mfa_enabled: true, passkey_enabled: false } }) as any })

  it('a sessão só sai com o pendente E a prova do mesmo usuário', async () => {
    const login: any = await performLogin(mfaDeps(), { projectId: PID, email: 'ana@x.com', password: 'x' })
    const ok = completeLogin(PID, 'nome', { pendingToken: login.pendingToken, proof: issueMfaProof(PID, '7') })
    expect(ok.kind).toBe('ok')
    if (ok.kind === 'ok') expect(ok.session.sub).toBe('7')
  })

  it('prova de OUTRO usuário, de outro projeto, ausente, ou token trocado de tipo: recusado', async () => {
    const login: any = await performLogin(mfaDeps(), { projectId: PID, email: 'ana@x.com', password: 'x' })
    const attempts = [
      { pendingToken: login.pendingToken, proof: issueMfaProof(PID, '999') },
      { pendingToken: login.pendingToken, proof: issueMfaProof('outro', '7') },
      { pendingToken: login.pendingToken, proof: undefined },
      { pendingToken: undefined, proof: issueMfaProof(PID, '7') },
      { pendingToken: login.pendingToken, proof: login.pendingToken },
      { pendingToken: signToken('session', { pid: PID, sub: '7', user: {} }, 60), proof: issueMfaProof(PID, '7') },
    ]
    for (const a of attempts) expect(completeLogin(PID, 'nome', a as any).kind).toBe('error')
    // pendente emitido para um projeto não vale em outro
    expect(completeLogin('outro', 'nome', { pendingToken: login.pendingToken, proof: issueMfaProof('outro', '7') }).kind).toBe('error')
  })
})

describe('securityContext (rotas de MFA/biometria)', () => {
  it('aceita o token pendente do login ou a sessão, só para o próprio usuário', async () => {
    const pending = signToken('mfa_pending', { pid: PID, sub: '7', user: {} }, 60)
    expect(securityContext({ projectId: PID, externalUserId: 7, pendingToken: pending }, null)).toEqual({ ok: true, pid: PID, sub: '7' })
    const session = { pid: PID, sub: '7' }
    expect(securityContext({ projectId: PID, externalUserId: '7' }, session)).toEqual({ ok: true, pid: PID, sub: '7' })
  })
  it('sem sessão: 401; para outro usuário ou projeto: 403', () => {
    expect(securityContext({ projectId: PID, externalUserId: '7' }, null)).toMatchObject({ ok: false, status: 401 })
    const session = { pid: PID, sub: '7' }
    expect(securityContext({ projectId: PID, externalUserId: '8' }, session)).toMatchObject({ ok: false, status: 403 })
    expect(securityContext({ projectId: 'outro', externalUserId: '7' }, session)).toMatchObject({ ok: false, status: 403 })
    expect(securityContext({ projectId: PID, externalUserId: '7', pendingToken: 'lixo' }, null)).toMatchObject({ ok: false, status: 401 })
  })
})

describe('endUserAuth', () => {
  it('identifica o usuário e escolhe o nome de exibição', () => {
    expect(subjectOf({ ID: 12, email: 'a@x' })).toBe('12')
    expect(subjectOf({ EMAIL: 'a@x' })).toBe('a@x')
    expect(subjectOf({})).toBeUndefined()
    expect(displayNameOf({ NOME_COMPLETO: 'Ana Souza', nome: 'ana' }, 'NOME_COMPLETO')).toBe('Ana Souza')
    expect(displayNameOf({ nome: 'Ana' })).toBe('Ana')
  })

  it('a linha na sessão é compacta: sem objetos, sem valores longos, com teto de tamanho', () => {
    const row = compactRow({ id: 1, role: 'r', foto: 'x'.repeat(5000), obj: { a: 1 }, ativo: true, nulo: null, __display_name: 'Ana' })
    expect(Object.keys(row).sort()).toEqual(['ativo', 'id', 'nulo', 'role'])
    const many: any = {}
    for (let i = 0; i < 400; i++) many['campo_' + i] = 'y'.repeat(100)
    expect(JSON.stringify(compactRow(many)).length).toBeLessThanOrEqual(3000)
  })

  it('grava os dois cookies (o assinado é httpOnly) e apaga os dois', () => {
    const jar: Record<string, { value: string; opts: any }> = {}
    const res = { cookies: { set: (n: string, v: string, o: any) => { jar[n] = { value: v, opts: o } } } }
    const session = buildSession(PID, { id: 7, email: 'ana@x.com', nome: 'Ana' }, 'nome')!
    setEndUserCookies(res, PID, { id: 7, nome: 'Ana' }, session, true)
    expect(jar[endUserCookieName(PID)].opts).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax' })
    expect(jar[`client_session_${PID}`].opts.httpOnly).toBe(false)
    expect(JSON.parse(jar[`client_session_${PID}`].value)).toEqual({ id: 7, nome: 'Ana' })
    clearEndUserCookies(res, PID)
    expect(jar[endUserCookieName(PID)].value).toBe('')
    expect(jar[endUserCookieName(PID)].opts.maxAge).toBe(0)
  })

  it('com relay ligado só a sessão assinada vale; o cookie escrito à mão é ignorado', () => {
    const session = buildSession(PID, { id: 7, email: 'ana@x.com', nome: 'Ana', role_id: 'r1' }, 'nome')!
    const signed = signEndUserSession(session)
    const forged = encodeURIComponent(JSON.stringify({ id: 1, role_id: 'admin' }))
    const jar = (entries: Record<string, string>) => ({ get: (n: string) => (n in entries ? { value: entries[n] } : undefined) })

    const real = readClientUser(jar({ [endUserCookieName(PID)]: signed, [`client_session_${PID}`]: forged }), PID, true)
    expect(real).toMatchObject({ id: 7, role_id: 'r1', __display_name: 'Ana' })
    expect(readClientUser(jar({ [`client_session_${PID}`]: forged }), PID, true)).toBeNull()
    expect(readClientUser(jar({ [endUserCookieName(PID)]: signed }), 'outro', true)).toBeNull()
    // relay desligado: comportamento antigo (cookie do navegador), nas duas formas de codificação
    expect(readClientUser(jar({ [`client_session_${PID}`]: forged }), PID, false)).toMatchObject({ role_id: 'admin' })
    expect(readClientUser(jar({ [`client_session_${PID}`]: JSON.stringify({ id: 2 }) }), PID, false)).toEqual({ id: 2 })
    expect(readClientUser(jar({}), PID, false)).toBeNull()
  })
})

describe('performPasskeyLogin', () => {
  const row = { id: 7, email: 'ana@x.com', nome: 'Ana', senha: '$2b$hash-secreto', role_id: 'r1' }

  it('busca o usuário pelo túnel com o token do servidor e NUNCA deixa a senha passar', async () => {
    const d = deps({}, { success: true, data: [row] })
    const r = await performPasskeyLogin(d, { projectId: PID, externalUserId: '7' })
    expect(r.kind).toBe('ok')
    expect(d.call.mock.calls[0][1]).toMatchObject({ action: 'select', table: 'usuarios', schemaName: 'vendas', filters: { id: '7' }, token: 'token-do-servidor' })
    if (r.kind === 'ok') {
      expect(JSON.stringify(r.user)).not.toContain('hash-secreto')
      expect(JSON.stringify(r.session)).not.toContain('hash-secreto')
      expect(r.session.sub).toBe('7')
    }
  })

  it('usuário não encontrado, túnel mudo e projeto sem tabela de usuários', async () => {
    expect(await performPasskeyLogin(deps({}, { success: true, data: [] }), { projectId: PID, externalUserId: '7' })).toMatchObject({ kind: 'error', status: 401 })
    const mudo = await performPasskeyLogin(deps({ call: async () => { throw new TunnelTimeoutError(1) } }), { projectId: PID, externalUserId: '7' })
    expect(mudo).toMatchObject({ code: 'tunnel_offline' })
    const semTabela = deps({ loadSetup: async () => setup({ auth: { auth_type: 'database' } }) as any })
    expect(await performPasskeyLogin(semTabela, { projectId: PID, externalUserId: '7' })).toMatchObject({ code: 'no_auth' })
  })
})
