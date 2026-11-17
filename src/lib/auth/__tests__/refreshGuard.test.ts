import { describe, it, expect } from 'vitest'
import { createRefreshGuard, isRefreshRequest } from '../refreshGuard'

const REFRESH = 'https://x.supabase.co/auth/v1/token?grant_type=refresh_token'
const post = (body = '{"refresh_token":"a"}') => ({ method: 'POST', body })

const fakeFetch = (statuses: number[]) => {
  const calls: string[] = []
  const fn = async (input: RequestInfo | URL) => {
    calls.push(String(input))
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]
    return new Response('{}', { status })
  }
  return { fn, calls }
}

describe('disjuntor da renovação de token', () => {
  it('reconhece só o POST de renovação', () => {
    expect(isRefreshRequest(REFRESH, post())).toBe(true)
    expect(isRefreshRequest('https://x.supabase.co/auth/v1/token?grant_type=pkce', post())).toBe(false)
    expect(isRefreshRequest('https://x.supabase.co/rest/v1/profiles', { method: 'GET' })).toBe(false)
    expect(isRefreshRequest(REFRESH, { method: 'GET' })).toBe(false)
  })

  it('depois de um 429 os pedidos seguintes não saem da máquina até o fim da pausa', async () => {
    let t = 1000
    const { fn, calls } = fakeFetch([429])
    const guarded = createRefreshGuard(fn, { now: () => t, cooldown429Ms: 60_000 })
    expect((await guarded(REFRESH, post())).status).toBe(429)
    expect(calls.length).toBe(1)
    for (let i = 0; i < 50; i++) expect((await guarded(REFRESH, post(`{"refresh_token":"t${i}"}`))).status).toBe(429)
    expect(calls.length).toBe(1) // 50 tentativas, nenhuma foi à rede
    t += 60_001
    await guarded(REFRESH, post())
    expect(calls.length).toBe(2) // passou a pausa: volta a tentar
  })

  it('a resposta local parece a do servidor (429 com corpo JSON)', async () => {
    const { fn } = fakeFetch([429])
    const guarded = createRefreshGuard(fn, { now: () => 0 })
    await guarded(REFRESH, post())
    const r = await guarded(REFRESH, post())
    expect(r.status).toBe(429)
    expect((await r.json()).error_code).toBe('over_request_rate_limit')
  })

  it('um 400 faz só uma pausa curta', async () => {
    let t = 0
    const { fn, calls } = fakeFetch([400, 200])
    const guarded = createRefreshGuard(fn, { now: () => t, cooldown400Ms: 5_000 })
    await guarded(REFRESH, post())
    expect((await guarded(REFRESH, post())).status).toBe(429)
    expect(calls.length).toBe(1)
    t += 5_001
    expect((await guarded(REFRESH, post())).status).toBe(200)
  })

  it('pedidos iguais ao mesmo tempo viram um só', async () => {
    const { fn, calls } = fakeFetch([200])
    const guarded = createRefreshGuard(fn, { now: () => 0 })
    const rs = await Promise.all([guarded(REFRESH, post()), guarded(REFRESH, post()), guarded(REFRESH, post())])
    expect(calls.length).toBe(1)
    expect(rs.map(r => r.status)).toEqual([200, 200, 200])
  })

  it('outras chamadas passam direto, mesmo durante a pausa', async () => {
    const { fn, calls } = fakeFetch([429, 200])
    const guarded = createRefreshGuard(fn, { now: () => 0 })
    await guarded(REFRESH, post())
    const r = await guarded('https://x.supabase.co/rest/v1/profiles', { method: 'GET' })
    expect(r.status).toBe(200)
    expect(calls.length).toBe(2)
  })

  it('avisa uma vez por pausa', async () => {
    const seen: number[] = []
    const { fn } = fakeFetch([429])
    const guarded = createRefreshGuard(fn, { now: () => 0, onBlock: i => seen.push(i.status) })
    await guarded(REFRESH, post())
    await guarded(REFRESH, post())
    await guarded(REFRESH, post())
    expect(seen).toEqual([429])
  })
})
