import { NextRequest, NextResponse } from 'next/server'
import { loginLimiter, clientIp, loginResponse, performLogin, realLoginDeps, relayEnabled, relayOffResponse } from '@/lib/tunnel/loginRoute'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * POST /api/runtime/login  { projectId, email, password }
 * Valida o usuário final pelo túnel (o servidor vê a resposta do Agente CLI) e emite a sessão assinada.
 * Com MFA/biometria exigidos devolve { status: 'mfa', pendingToken } e a sessão só sai em /login/complete.
 */
export async function POST(request: NextRequest) {
  if (!relayEnabled()) return relayOffResponse()
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ status: 'error', code: 'bad_request' }, { status: 400 }) }
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
  if (!projectId) return NextResponse.json({ status: 'error', code: 'bad_request' }, { status: 400 })

  const key = `${clientIp(request)}:${projectId}:${String(body.email || '').toLowerCase()}`
  if (!loginLimiter.allow(key)) return NextResponse.json({ status: 'error', code: 'too_many' }, { status: 429 })

  const result = await performLogin(realLoginDeps, { projectId, email: body.email, password: body.password })
  return loginResponse(result, projectId)
}
