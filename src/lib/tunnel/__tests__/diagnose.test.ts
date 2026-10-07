import { describe, it, expect, vi } from 'vitest'
import { diagnoseTunnel } from '../diagnose'
import { TunnelTimeoutError } from '../server'

const client = (project: any, models: any[] = [{ db_schema_name: 'vendas' }]) => ({
  from: (table: string) => table === 'projects'
    ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: project }) }) }) }
    : { select: () => ({ eq: () => ({ limit: async () => ({ data: models }) }) }) },
}) as any

const pg = client({ id: 'p', db_type: 'postgres' })
const deps = (call: any, extra: any = {}) => ({ client: pg, token: async () => 'tok', call, ...extra })

describe('diagnoseTunnel', () => {
  it('Agente responde ao comando assinado (um único envio): informa o tempo', async () => {
    const call = vi.fn(async (_p: string, _payload: any, _s: string) => ({ success: true }))
    let t = 1000
    const r = await diagnoseTunnel('p', deps(call, { now: () => (t += 40) }))
    expect(r).toEqual({ ok: true, ms: 40 })
    expect(call).toHaveBeenCalledTimes(1)
    expect(call.mock.calls[0][1]).toMatchObject({ action: 'select', schemaName: 'vendas', query: 'SELECT 1 AS ok' })
    expect(call.mock.calls[0][2]).toBe('tok')
  })

  it('sem resposta: Agente desligado, de outro projeto ou anterior à v1.2 (não entende a assinatura)', async () => {
    const call = async () => { throw new TunnelTimeoutError(1) }
    expect(await diagnoseTunnel('p', deps(call))).toEqual({ ok: false, reason: 'offline' })
  })

  it('no Oracle usa DUAL', async () => {
    const call = vi.fn(async (..._a: any[]) => ({ success: true }))
    await diagnoseTunnel('p', { ...deps(call), client: client({ id: 'p', db_type: 'oracle' }) })
    expect(call.mock.calls[0][1].query).toContain('FROM DUAL')
  })

  it('explica as demais falhas', async () => {
    expect(await diagnoseTunnel('p', { client: client(null) })).toEqual({ ok: false, reason: 'no_project' })
    expect(await diagnoseTunnel('p', { client: pg, token: async () => null })).toEqual({ ok: false, reason: 'no_token' })
    expect(await diagnoseTunnel('p', deps(async () => ({ success: false, error: 'banco fora' })))).toEqual({ ok: false, reason: 'agent_error', detail: 'banco fora' })
    expect(await diagnoseTunnel('p', deps(async () => { throw new Error('HTTP 500') }))).toEqual({ ok: false, reason: 'transport', detail: 'HTTP 500' })
  })
})
