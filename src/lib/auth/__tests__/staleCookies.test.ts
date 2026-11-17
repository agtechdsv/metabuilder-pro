import { describe, it, expect } from 'vitest'
import { parseCookieString, authSessionTexts, cookiesHoldingToken, expireStrings, purgeStaleAuthCookies } from '../staleCookies'

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const NAME = 'sb-abcdefghij-auth-token'
const session = (refresh: string) => JSON.stringify({ access_token: 'a.b.c', refresh_token: refresh, user: { id: 'u' } })

/** monta cookies como o @supabase/ssr: base64- + base64url(JSON), repartido em pedaços .0, .1 */
const chunked = (refresh: string, parts = 2) => {
  const enc = 'base64-' + b64url(session(refresh))
  const size = Math.ceil(enc.length / parts)
  const out: Record<string, string> = {}
  for (let i = 0; i < parts; i++) out[`${NAME}.${i}`] = encodeURIComponent(enc.slice(i * size, (i + 1) * size))
  return out
}
const asString = (c: Record<string, string>) => Object.entries(c).map(([k, v]) => `${k}=${v}`).join('; ')

describe('cookies de login presos', () => {
  it('lê a sessão de cookies repartidos em pedaços', () => {
    const c = { ...chunked('tokenAntigo123'), 'app-language': 'pt' }
    const [s] = authSessionTexts(c)
    expect(s.base).toBe(NAME)
    expect(s.names).toEqual([`${NAME}.0`, `${NAME}.1`])
    expect(JSON.parse(s.text).refresh_token).toBe('tokenAntigo123')
  })

  it('lê também o cookie sem pedaços e sem o prefixo base64', () => {
    const c = { [NAME]: encodeURIComponent(session('abc')) }
    expect(authSessionTexts(c)[0].text).toContain('"refresh_token":"abc"')
  })

  it('só aponta os cookies que ainda carregam o token recusado', () => {
    const c = chunked('tokenAntigo123')
    expect(cookiesHoldingToken(c, 'tokenAntigo123')).toEqual([`${NAME}.0`, `${NAME}.1`])
    // outra aba já gravou uma sessão nova: nada a limpar
    expect(cookiesHoldingToken(chunked('tokenNovo456'), 'tokenAntigo123')).toEqual([])
    expect(cookiesHoldingToken(c, '')).toEqual([])
    expect(cookiesHoldingToken({ 'app-language': 'pt' }, 'x')).toEqual([])
  })

  it('expira o cookie em todos os escopos: host sozinho, www e domínio raiz', () => {
    const list = expireStrings([`${NAME}.0`], 'www.metabuilderpro.com', true)
    const joined = list.join('\n')
    expect(joined).toContain(`${NAME}.0=; path=/; max-age=0`) // host-only (o que ficou preso na VM)
    expect(joined).toContain('; domain=www.metabuilderpro.com;')
    expect(joined).toContain('; domain=.metabuilderpro.com;')
    expect(list.every(s => s.includes('max-age=0') && s.includes('Secure'))).toBe(true)
    // localhost: só host-only e host atual, sem domínio raiz inventado
    expect(expireStrings(['x'], 'localhost', false).join('\n')).not.toContain('domain=.localhost')
  })

  it('purgeStaleAuthCookies apaga só o que carrega o token e devolve quantos nomes limpou', () => {
    const jar: string[] = []
    const doc = { get cookie() { return asString({ ...chunked('tokenAntigo123'), 'app-language': 'pt' }) }, set cookie(v: string) { jar.push(v) } }
    const n = purgeStaleAuthCookies('tokenAntigo123', doc, { hostname: 'www.metabuilderpro.com', protocol: 'https:' })
    expect(n).toBe(2)
    expect(jar.some(s => s.startsWith(`${NAME}.0=`))).toBe(true)
    expect(jar.some(s => s.startsWith('app-language='))).toBe(false)

    jar.length = 0
    expect(purgeStaleAuthCookies('outroToken', doc, { hostname: 'www.metabuilderpro.com', protocol: 'https:' })).toBe(0)
    expect(jar).toEqual([])
  })

  it('apaga também pelo token de acesso (sessão revogada com o token ainda válido)', () => {
    const jar: string[] = []
    const doc = { get cookie() { return asString(chunked('refreshX')) }, set cookie(v: string) { jar.push(v) } }
    expect(purgeStaleAuthCookies('a.b.c', doc, { hostname: 'www.metabuilderpro.com', protocol: 'https:' })).toBe(2) // 'a.b.c' é o access_token do cookie de teste
    expect(jar.length).toBeGreaterThan(0)
  })

  it('parseCookieString ignora lixo', () => {
    expect(parseCookieString('a=1; b=2; ; =x; c')).toEqual({ a: '1', b: '2' })
  })
})
