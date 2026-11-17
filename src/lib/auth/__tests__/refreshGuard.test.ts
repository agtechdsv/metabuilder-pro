import { describe, it, expect } from 'vitest'
import { createRefreshGuard, errorCodeOf, isRefreshRequest, isUserRequest } from '../refreshGuard'

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

  describe('sessão revogada (GET /auth/v1/user 403 session_not_found)', () => {
    const USER = 'https://x.supabase.co/auth/v1/user'
    const bearer = (t: string) => ({ method: 'GET', headers: { Authorization: `Bearer ${t}` } })
    const respond = (status: number, body: object) => async () => new Response(JSON.stringify(body), { status })

    it('avisa com o token de acesso, uma vez por token, e devolve a resposta original', async () => {
      const seen: string[] = []
      const guarded = createRefreshGuard(respond(403, { code: 403, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' }), { now: () => 0, onSessionGone: i => seen.push(i.accessToken) })
      const r = await guarded(USER, bearer('jwtA'))
      expect(r.status).toBe(403)
      expect((await r.json()).error_code).toBe('session_not_found') // o corpo continua legível para quem chamou
      await guarded(USER, bearer('jwtA'))
      await guarded(USER, bearer('jwtB'))
      expect(seen).toEqual(['jwtA', 'jwtB'])
    })

    it('entende o formato novo da API (code em texto, message, cabeçalho X-Sb-Error-Code), o que o Supabase manda de verdade', async () => {
      const seen: string[] = []
      const corpoNovo = { code: 'session_not_found', message: 'Session from session_id claim in JWT does not exist' }
      // só o corpo no formato novo
      await createRefreshGuard(respond(403, corpoNovo), { now: () => 0, onSessionGone: i => seen.push(i.accessToken) })(USER, bearer('novo1'))
      // só o cabeçalho
      const soCabecalho = async () => new Response('{}', { status: 403, headers: { 'x-sb-error-code': 'session_not_found' } })
      await createRefreshGuard(soCabecalho, { now: () => 0, onSessionGone: i => seen.push(i.accessToken) })(USER, bearer('novo2'))
      expect(seen).toEqual(['novo1', 'novo2'])
    })

    it('errorCodeOf: cabeçalho primeiro, depois error_code, depois code em texto; número HTTP em code não conta', async () => {
      expect(await errorCodeOf(new Response('{}', { status: 403, headers: { 'x-sb-error-code': 'a' } }))).toBe('a')
      expect(await errorCodeOf(new Response(JSON.stringify({ error_code: 'b', code: 403 }), { status: 403 }))).toBe('b')
      expect(await errorCodeOf(new Response(JSON.stringify({ code: 'c' }), { status: 403 }))).toBe('c')
      expect(await errorCodeOf(new Response(JSON.stringify({ code: 403 }), { status: 403 }))).toBe('')
      expect(await errorCodeOf(new Response('não é json', { status: 403 }))).toBe('')
    })

    it('lê o token também de Headers e de lista de pares', async () => {
      const seen: string[] = []
      const guarded = createRefreshGuard(respond(403, { error_code: 'session_not_found' }), { now: () => 0, onSessionGone: i => seen.push(i.accessToken) })
      await guarded(USER, { method: 'GET', headers: new Headers({ authorization: 'Bearer h1' }) })
      await guarded(USER, { method: 'GET', headers: [['AUTHORIZATION', 'Bearer h2']] })
      expect(seen).toEqual(['h1', 'h2'])
    })

    it('não age em outros 403, em 401 nem em outra rota', async () => {
      const seen: string[] = []
      const opts = { now: () => 0, onSessionGone: (i: { accessToken: string }) => seen.push(i.accessToken) }
      await createRefreshGuard(respond(403, { error_code: 'user_banned' }), opts)(USER, bearer('t1'))
      await createRefreshGuard(respond(401, { error_code: 'session_not_found' }), opts)(USER, bearer('t2'))
      await createRefreshGuard(respond(403, { error_code: 'session_not_found' }), opts)('https://x.supabase.co/rest/v1/profiles', bearer('t3'))
      await createRefreshGuard(respond(403, { error_code: 'session_not_found' }), opts)(USER, { method: 'GET' }) // sem token
      expect(seen).toEqual([])
    })

    it('isUserRequest só reconhece o GET de /auth/v1/user', () => {
      expect(isUserRequest(USER, { method: 'GET' })).toBe(true)
      expect(isUserRequest(USER + '?x=1', { method: 'GET' })).toBe(true)
      expect(isUserRequest(USER, { method: 'PUT' })).toBe(false)
      expect(isUserRequest('https://x.supabase.co/auth/v1/user/identities', { method: 'GET' })).toBe(false)
    })
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
