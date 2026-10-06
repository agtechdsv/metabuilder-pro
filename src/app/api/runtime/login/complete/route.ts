import { NextRequest, NextResponse } from 'next/server'
import { completeLogin, loginResponse, relayEnabled, relayOffResponse } from '@/lib/tunnel/loginRoute'
import { loadLoginSetup } from '@/lib/tunnel/loginSetup'

export const dynamic = 'force-dynamic'

/**
 * POST /api/runtime/login/complete  { projectId, pendingToken, proof }
 * Último passo do login com MFA/biometria: troca o token pendente + a prova (emitida pela verificação) pela sessão.
 */
export async function POST(request: NextRequest) {
  if (!relayEnabled()) return relayOffResponse()
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ status: 'error', code: 'bad_request' }, { status: 400 }) }
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''
  if (!projectId) return NextResponse.json({ status: 'error', code: 'bad_request' }, { status: 400 })

  const setup = await loadLoginSetup(projectId)
  const result = completeLogin(projectId, setup?.auth.db_display_name_column, { pendingToken: body.pendingToken, proof: body.proof })
  return loginResponse(result, projectId)
}
