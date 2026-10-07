import { describe, it, expect } from 'vitest'
import { RateLimiter, actionAllowed, buildCommand, parseRelayRequest } from '../relayPolicy'

const PID = '123e4567-e89b-42d3-a456-426614174000'
const ok = (over: any = {}) => ({ projectId: PID, event: 'sql_query', payload: { queryId: 'q1', action: 'select', query: 'SELECT 1' }, ...over })

describe('parseRelayRequest', () => {
  it('aceita um comando bem formado', () => {
    const r = parseRelayRequest(ok())
    expect(r.ok).toBe(true)
  })
  it('recusa projeto inválido, evento fora da lista e comando sem queryId', () => {
    for (const bad of [
      ok({ projectId: 'abc' }), ok({ projectId: 5 }), ok({ event: 'raw' }), ok({ event: 'chunked_message' }),
      ok({ payload: null }), ok({ payload: [] }), ok({ payload: { action: 'select' } }), ok({ payload: { queryId: '' } }),
      null, 'texto', undefined,
    ]) expect(parseRelayRequest(bad).ok).toBe(false)
  })
})

describe('actionAllowed', () => {
  it('o desenvolvedor pode tudo, menos o login (que é do servidor)', () => {
    for (const a of ['select', 'insert', 'raw_sql', 'sync_bpm', 'read_logs']) expect(actionAllowed('member', a).ok).toBe(true)
    expect(actionAllowed('member', 'validate_login').ok).toBe(false)
  })
  it('o usuário final faz consultas e gravações, mas não SQL livre nem ações do desenvolvedor', () => {
    for (const a of ['select', 'insert', 'update', 'delete', 'count_records', undefined]) expect(actionAllowed('end_user', a).ok).toBe(true)
    for (const a of ['raw_sql', 'sync_bpm', 'sync_log_config', 'read_logs', 'clear_logs', 'get_log_stats', 'validate_login']) expect(actionAllowed('end_user', a).ok).toBe(false)
  })
})

describe('buildCommand', () => {
  it('o comando sai assinado com o token do servidor, sem token, e o do navegador é descartado', () => {
    const r = parseRelayRequest(ok({ payload: { queryId: 'q', token: 'FALSO', projectId: 'outro', action: 'select' } }))
    if (!r.ok) throw new Error('inválido')
    const cmd = buildCommand(r.req, 'token-real')
    expect(cmd.token).toBeUndefined()
    expect(typeof cmd.sig).toBe('string')
    expect(cmd.projectId).toBe(PID)
    expect(cmd.queryId).toBe('q')
  })
})

describe('RateLimiter', () => {
  it('bloqueia acima do limite na janela e libera depois', () => {
    let t = 0
    const rl = new RateLimiter(3, 1000, () => t)
    expect([rl.allow('a'), rl.allow('a'), rl.allow('a'), rl.allow('a')]).toEqual([true, true, true, false])
    expect(rl.allow('b')).toBe(true)
    t = 1001
    expect(rl.allow('a')).toBe(true)
  })
})
