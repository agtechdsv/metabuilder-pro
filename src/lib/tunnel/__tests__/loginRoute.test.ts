import { describe, it, expect, beforeAll } from 'vitest'
import { loginResponse } from '../loginRoute'
import { buildSession } from '../endUserAuth'
import { endUserCookieName, verifyEndUserSession } from '../sessionToken'

beforeAll(() => { process.env.RUNTIME_SESSION_SECRET = 'z'.repeat(48) })

const PID = 'proj-1'
const user = { id: 7, email: 'ana@x.com', nome: 'Ana', role_id: 'r1' }

describe('loginResponse', () => {
  it('sucesso: devolve o usuário e grava a sessão assinada (httpOnly) e o cookie de exibição', async () => {
    const session = buildSession(PID, user, 'nome')!
    const res = loginResponse({ kind: 'ok', user, session }, PID)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ status: 'ok', user: { id: 7 }, offerPasskey: false })

    const signed = res.cookies.get(endUserCookieName(PID))
    expect(signed?.value).toBeTruthy()
    expect(verifyEndUserSession(signed!.value, PID)).toMatchObject({ sub: '7', email: 'ana@x.com' })
    const header = res.headers.get('set-cookie') || ''
    expect(header).toMatch(/mb_eu_proj-1=[^;]+;[^]*HttpOnly/i)
    expect(res.cookies.get(`client_session_${PID}`)?.value).toBe(JSON.stringify(user))
  })

  it('MFA pendente: devolve o token, NÃO grava nenhum cookie de sessão', async () => {
    const res = loginResponse({ kind: 'mfa', user, pendingToken: 'tok' }, PID)
    expect(await res.json()).toMatchObject({ status: 'mfa', pendingToken: 'tok' })
    expect(res.cookies.get(endUserCookieName(PID))).toBeUndefined()
    expect(res.cookies.get(`client_session_${PID}`)).toBeUndefined()
  })

  it('erro: status HTTP e código para o navegador traduzir, sem cookies', async () => {
    const res = loginResponse({ kind: 'error', status: 401, code: 'invalid_credentials', message: 'Senha incorreta' }, PID)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ status: 'error', code: 'invalid_credentials', message: 'Senha incorreta' })
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})
