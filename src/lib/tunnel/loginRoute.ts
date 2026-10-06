import { NextResponse } from 'next/server'
import { loadLoginSetup } from './loginSetup'
import { completeLogin, performLogin, performPasskeyLogin, type LoginResult } from './loginFlow'
import { clearEndUserCookies, setEndUserCookies } from './endUserAuth'
import { RateLimiter } from './relayPolicy'
import { relayEnabled, tunnelCall } from './server'

/** Peças compartilhadas pelas rotas de login/logout do usuário final (a lógica em si está em loginFlow.ts). */

// 10 tentativas por minuto para cada combinação IP + projeto + e-mail: contém tentativa de adivinhar senha
export const loginLimiter = new RateLimiter(10, 60_000)

export const clientIp = (request: Request): string =>
  (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'ip-desconhecido'

export const isProduction = () => process.env.NODE_ENV === 'production'

export const realLoginDeps = {
  loadSetup: (projectId: string) => loadLoginSetup(projectId),
  call: (projectId: string, payload: Record<string, any>) => tunnelCall(projectId, 'sql_query', payload as any, { timeoutMs: 12_000 }),
}

export function relayOffResponse() {
  return NextResponse.json({ error: 'relay_off' }, { status: 503 })
}

/** Resposta HTTP de um resultado de login (e os cookies, quando há sessão). */
export function loginResponse(result: LoginResult, projectId: string): NextResponse {
  if (result.kind === 'error') {
    return NextResponse.json({ status: 'error', code: result.code, message: result.message }, { status: result.status })
  }
  if (result.kind === 'mfa') {
    return NextResponse.json({ status: 'mfa', user: result.user, pendingToken: result.pendingToken })
  }
  const res = NextResponse.json({ status: 'ok', user: result.user, offerPasskey: result.offerPasskey === true })
  setEndUserCookies(res, projectId, result.user, result.session, isProduction())
  return res
}

export { relayEnabled, performLogin, performPasskeyLogin, completeLogin, clearEndUserCookies }
