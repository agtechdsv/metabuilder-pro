import { describe, it, expect, vi } from 'vitest'
import { diagnoseTunnel } from '../diagnose'
import { TunnelTimeoutError } from '../server'

const client = (project: any, models: any[] = [{ db_schema_name: 'vendas' }]) => ({
  from: (table: string) => table === 'projects'
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: project }) }) }) }
    : { select: () => ({ eq: () => ({ limit: async () => ({ data: models }) }) }) },
}) as any

describe('diagnoseTunnel', () => {
  it('manda SELECT 1 no schema do projeto e mede o tempo', async () => {
    const call = vi.fn(async (_p: string, _payload: any) => ({ success: true }))
    let t = 1000
    const r = await diagnoseTunnel('p', { client: client({ id: 'p', db_type: 'postgres' }), token: async () => 'tok', call, now: () => (t += 40) })
    expect(r).toEqual({ ok: true, ms: 40 })
    expect(call.mock.calls[0][1]).toMatchObject({ token: 'tok', action: 'select', schemaName: 'vendas', query: 'SELECT 1 AS ok' })
  })

  it('no Oracle usa DUAL', async () => {
    const call = vi.fn(async (_p: string, _payload: any) => ({ success: true }))
    await diagnoseTunnel('p', { client: client({ id: 'p', db_type: 'oracle' }), token: async () => 'tok', call })
    expect(call.mock.calls[0][1].query).toContain('FROM DUAL')
  })

  it('explica cada falha', async () => {
    const ok = client({ id: 'p', db_type: 'postgres' })
    expect(await diagnoseTunnel('p', { client: client(null) })).toEqual({ ok: false, reason: 'no_project' })
    expect(await diagnoseTunnel('p', { client: ok, token: async () => null })).toEqual({ ok: false, reason: 'no_token' })
    expect(await diagnoseTunnel('p', { client: ok, token: async () => 't', call: async () => { throw new TunnelTimeoutError(1) } })).toEqual({ ok: false, reason: 'offline' })
    expect(await diagnoseTunnel('p', { client: ok, token: async () => 't', call: async () => ({ success: false, error: 'banco fora' }) })).toEqual({ ok: false, reason: 'agent_error', detail: 'banco fora' })
    expect(await diagnoseTunnel('p', { client: ok, token: async () => 't', call: async () => { throw new Error('HTTP 500') } })).toEqual({ ok: false, reason: 'transport', detail: 'HTTP 500' })
  })
})
