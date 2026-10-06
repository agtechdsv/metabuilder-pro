import { NextResponse } from 'next/server'
import { securityContext, issueMfaProof } from './loginFlow'
import { relayEnabled } from './server'
import { endUserCookieName, verifyEndUserSession } from './sessionToken'

/** Lê um cookie de uma `Request` comum (as rotas de segurança usam Request e NextRequest). */
export function cookieOf(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie')
  if (!header) return undefined
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0 || part.slice(0, i).trim() !== name) continue
    const raw = part.slice(i + 1).trim()
    try { return decodeURIComponent(raw) } catch { return raw }
  }
  return undefined
}

/**
 * Porteiro das rotas de MFA e biometria do usuário final: com o relay ligado, quem chama precisa ser o próprio usuário
 * (token pendente do login ou sessão assinada). Devolve a resposta de recusa, ou null se pode seguir.
 * Com o relay desligado não muda nada (comportamento antigo).
 */
export function guardEndUser(request: Request, input: { projectId?: unknown; externalUserId?: unknown; pendingToken?: unknown }): NextResponse | null {
  if (!relayEnabled()) return null
  const pid = typeof input.projectId === 'string' ? input.projectId : ''
  const session = pid ? verifyEndUserSession(cookieOf(request, endUserCookieName(pid)), pid) : null
  const ctx = securityContext(input, session)
  return ctx.ok ? null : NextResponse.json({ error: ctx.error }, { status: ctx.status })
}

/** Prova de MFA para devolver ao navegador (só existe com o relay ligado). */
export const proofFor = (projectId: unknown, externalUserId: unknown): string | undefined =>
  relayEnabled() ? issueMfaProof(String(projectId), String(externalUserId)) : undefined
