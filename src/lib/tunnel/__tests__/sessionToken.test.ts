import { describe, it, expect } from 'vitest'
import { endUserCookieName, sessionSecret, signEndUserSession, signToken, verifyEndUserSession, verifyToken } from '../sessionToken'

const secret = Buffer.from('segredo-de-teste-com-mais-de-32-caracteres!!')
const other = Buffer.from('outro-segredo-totalmente-diferente-1234567')
const at = (t: number) => ({ secret, now: () => t })

describe('sessionSecret', () => {
  it('usa RUNTIME_SESSION_SECRET quando é longo o bastante', () => {
    expect(sessionSecret({ RUNTIME_SESSION_SECRET: 'x'.repeat(40) }).toString()).toBe('x'.repeat(40))
  })
  it('sem ele, deriva da chave de serviço (estável e diferente dela)', () => {
    const env = { SUPABASE_SERVICE_ROLE_KEY: 'k'.repeat(40) }
    const a = sessionSecret(env)
    expect(a.equals(sessionSecret(env))).toBe(true)
    expect(a.toString()).not.toContain('kkkk')
    expect(a.equals(sessionSecret({ SUPABASE_SERVICE_ROLE_KEY: 'j'.repeat(40) }))).toBe(false)
  })
  it('sem nenhuma das duas, falha com mensagem clara', () => {
    expect(() => sessionSecret({})).toThrow(/RUNTIME_SESSION_SECRET/)
    expect(() => sessionSecret({ RUNTIME_SESSION_SECRET: 'curto', SUPABASE_SERVICE_ROLE_KEY: 'k' })).toThrow()
  })
})

describe('signToken / verifyToken', () => {
  it('ida e volta', () => {
    const t = signToken('session', { a: 1 }, 60, at(1000))
    expect(verifyToken('session', t, at(1000))).toEqual({ a: 1 })
  })
  it('expira', () => {
    const t = signToken('session', { a: 1 }, 60, at(1000))
    expect(verifyToken('session', t, at(1060))).toEqual({ a: 1 })
    expect(verifyToken('session', t, at(1061))).toBeNull()
  })
  it('o tipo é parte da assinatura: um token pendente não serve de sessão', () => {
    const pending = signToken('mfa_pending', { sub: '1' }, 60, at(1000))
    expect(verifyToken('session', pending, at(1000))).toBeNull()
    expect(verifyToken('mfa_proof', pending, at(1000))).toBeNull()
    expect(verifyToken('mfa_pending', pending, at(1000))).toEqual({ sub: '1' })
  })
  it('recusa conteúdo trocado, assinatura de outro segredo e lixo', () => {
    const t = signToken('session', { sub: '1' }, 60, at(1000))
    const [, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ k: 'session', d: { sub: 'admin' }, exp: 9999999999 })).toString('base64url')
    expect(verifyToken('session', `${forged}.${sig}`, at(1000))).toBeNull()
    expect(verifyToken('session', t, { secret: other, now: () => 1000 })).toBeNull()
    for (const bad of ['', 'a.b', 'a.b.c', undefined, null, 'x'.repeat(9000)]) expect(verifyToken('session', bad as any, at(1000))).toBeNull()
  })
})

describe('sessão do usuário final', () => {
  const s = { pid: 'proj-1', sub: '42', email: 'ana@x.com', name: 'Ana', attrs: { vendedor_id: '7' } }
  it('vale só no projeto em que foi emitida', () => {
    const token = signEndUserSession(s, at(1000))
    expect(verifyEndUserSession(token, 'proj-1', at(1000))).toEqual(s)
    expect(verifyEndUserSession(token, 'proj-2', at(1000))).toBeNull()
  })
  it('exige identificador do usuário', () => {
    const token = signEndUserSession({ ...s, sub: '' }, at(1000))
    expect(verifyEndUserSession(token, 'proj-1', at(1000))).toBeNull()
  })
  it('nome do cookie é por projeto', () => {
    expect(endUserCookieName('abc')).toBe('mb_eu_abc')
  })
})
