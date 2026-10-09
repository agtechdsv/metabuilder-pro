import { describe, it, expect, vi } from 'vitest'
import { createLivenessChecker, isRowActive, ALIVE_TTL_MS, REVOKED_TTL_MS, UNKNOWN_TTL_MS } from '../sessionLiveness'

const PID = '123e4567-e89b-42d3-a456-426614174000'
const session = { pid: PID, sub: 'u-1', row: { id: 'u-1', email: 'maria@x.com' } }
const setup = (over: any = {}) => ({
  project: { id: PID }, visual: {}, security: { mfa_enabled: false, passkey_enabled: false }, schemaName: 'public',
  auth: { auth_type: 'database', db_table_name: 'usuarios', db_email_column: 'email', ...over },
}) as any

function make(opts: { rows?: any[]; setup?: any; fail?: 'throw' | 'error' } = {}) {
  let t = 1_000_000
  const call = vi.fn(async (_pid: string, _p: any) => {
    if (opts.fail === 'throw') throw new Error('timeout')
    if (opts.fail === 'error') return { success: false, error: 'x' }
    return { success: true, data: opts.rows ?? [{ id: 'u-1', ativo: true }] }
  })
  const checker = createLivenessChecker({
    loadSetup: async () => (opts.setup === undefined ? setup() : opts.setup),
    secretToken: async () => 'segredo-do-projeto-0123456789',
    call, now: () => t, newId: () => 'q1',
  })
  return { checker, call, advance: (ms: number) => { t += ms } }
}

describe('coluna de ativo', () => {
  it('só é inativa quando existe a coluna e ela está desligada', () => {
    expect(isRowActive({ id: 1 })).toBe(true)
    expect(isRowActive({ id: 1, ativo: true })).toBe(true)
    for (const v of [false, 0, '0', 'false', 'F', 'N', 'não', 'inativo']) expect(isRowActive({ ativo: v }), String(v)).toBe(false)
    expect(isRowActive({ IS_ACTIVE: 0 })).toBe(false)
    expect(isRowActive(null)).toBe(false)
  })
})

describe('sessão do usuário final: reconferência no banco do cliente', () => {
  it('usuário existente e ativo vale; a conferência é guardada (não consulta a cada requisição)', async () => {
    const m = make()
    expect(await m.checker.check(PID, session)).toBe('alive')
    expect(await m.checker.check(PID, session)).toBe('alive')
    expect(m.call).toHaveBeenCalledTimes(1)
    // consulta a linha pelo id da sessão, sem trazer mais que um registro
    expect(m.call.mock.calls[0][1]).toMatchObject({ action: 'select', table: 'usuarios', filters: { id: 'u-1' }, limit: 1 })
    m.advance(ALIVE_TTL_MS + 1)
    await m.checker.check(PID, session)
    expect(m.call).toHaveBeenCalledTimes(2)
  })

  it('usuário apagado, ou desativado no banco, tem a sessão revogada', async () => {
    expect(await make({ rows: [] }).checker.check(PID, session)).toBe('revoked')
    expect(await make({ rows: [{ id: 'u-1', ativo: false }] }).checker.check(PID, session)).toBe('revoked')
  })

  it('a revogação é reavaliada em 1 minuto (reativar o usuário volta a valer)', async () => {
    const m = make({ rows: [] })
    expect(await m.checker.check(PID, session)).toBe('revoked')
    m.advance(REVOKED_TTL_MS - 1)
    await m.checker.check(PID, session)
    expect(m.call).toHaveBeenCalledTimes(1)
    m.advance(2)
    await m.checker.check(PID, session)
    expect(m.call).toHaveBeenCalledTimes(2)
  })

  it('sem conseguir conferir (Agente desligado, erro) a sessão segue valendo, e a dúvida dura pouco', async () => {
    for (const fail of ['throw', 'error'] as const) {
      const m = make({ fail })
      expect(await m.checker.check(PID, session)).toBe('unknown')
      expect(await m.checker.check(PID, session)).toBe('unknown')
      expect(m.call).toHaveBeenCalledTimes(1)
      m.advance(UNKNOWN_TTL_MS + 1)
      await m.checker.check(PID, session)
      expect(m.call).toHaveBeenCalledTimes(2)
    }
  })

  it('login que não é pelo banco do cliente (LDAP, gerenciado) não tem linha para conferir', async () => {
    const m = make({ setup: setup({ auth_type: 'ldap' }) })
    expect(await m.checker.check(PID, session)).toBe('alive')
    expect(m.call).not.toHaveBeenCalled()
  })

  it('sessão sem id na linha: confere pelo e-mail configurado', async () => {
    const m = make()
    await m.checker.check(PID, { pid: PID, sub: 'maria@x.com', row: { email: 'maria@x.com' } })
    expect(m.call.mock.calls[0][1].filters).toEqual({ email: 'maria@x.com' })
  })

  it('várias requisições ao mesmo tempo viram uma só consulta', async () => {
    const m = make()
    await Promise.all([1, 2, 3, 4].map(() => m.checker.check(PID, session)))
    expect(m.call).toHaveBeenCalledTimes(1)
  })
})
