import { describe, it, expect, beforeEach } from 'vitest'
import { setEndUserCookies, clearEndUserCookies } from '../endUserAuth'
import { endUserCookieName } from '../sessionToken'

const PID = '123e4567-e89b-42d3-a456-426614174000'

describe('cookies do usuário final', () => {
  beforeEach(() => { process.env.RUNTIME_SESSION_SECRET = 'segredo-de-teste-0123456789abcdef' })

  it('a sessão assinada e o cookie de exibição são de SESSÃO (somem juntos ao fechar o navegador)', () => {
    const jar: Record<string, any> = {}
    const res = { cookies: { set: (n: string, v: string, o?: any) => { jar[n] = { v, o } } } }
    setEndUserCookies(res, PID, { id: 'u1' }, { pid: PID, sub: 'u1' }, true)
    expect(jar[endUserCookieName(PID)].o.httpOnly).toBe(true)
    expect(jar[endUserCookieName(PID)].o.maxAge).toBeUndefined()
    expect(jar[`client_session_${PID}`].o.maxAge).toBeUndefined()
  })

  it('o logout apaga os dois', () => {
    const jar: Record<string, any> = {}
    clearEndUserCookies({ cookies: { set: (n: string, v: string, o?: any) => { jar[n] = { v, o } } } }, PID)
    expect(jar[endUserCookieName(PID)].o.maxAge).toBe(0)
    expect(jar[`client_session_${PID}`].o.maxAge).toBe(0)
  })
})
