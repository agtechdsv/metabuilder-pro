import { NextRequest, NextResponse } from 'next/server'
import { authorizeProjectActor } from '@/lib/tunnel/authorize'
import { MAX_RELAY_BYTES, RateLimiter, actionAllowed, buildCommand, parseRelayRequest } from '@/lib/tunnel/relayPolicy'
import { getProjectSecretToken, relayEnabled, tunnelSend } from '@/lib/tunnel/server'
import { signingEnabled } from '@/lib/tunnel/commandSigning'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// 600 comandos por minuto por usuário (uma tela cheia de listas dispara dezenas de uma vez)
const limiter = new RateLimiter(600, 60_000)

/**
 * POST /api/tunnel/send
 *
 * O navegador não tem mais o secret_token do projeto: ele pede aqui, o servidor confere quem está pedindo
 * (membro do projeto ou usuário final com sessão assinada), coloca o token e envia o comando ao Agente CLI.
 * A resposta do CLI continua chegando pelo canal em tempo real.
 */
export async function POST(request: NextRequest) {
  if (!relayEnabled()) return NextResponse.json({ error: 'Relay do túnel desligado.' }, { status: 503 })

  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > MAX_RELAY_BYTES) return NextResponse.json({ error: 'Comando grande demais.' }, { status: 413 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }

  const parsed = parseRelayRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { req } = parsed

  const actor = await authorizeProjectActor(request, req.projectId)
  if (!actor) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const allowed = actionAllowed(actor.kind, req.payload.action)
  if (!allowed.ok) return NextResponse.json({ error: allowed.error }, { status: 403 })

  const who = actor.kind === 'member' ? `m:${actor.userId}` : `e:${actor.session.pid}:${actor.session.sub}`
  if (!limiter.allow(who)) return NextResponse.json({ error: 'Muitos comandos em pouco tempo.' }, { status: 429 })

  const token = await getProjectSecretToken(req.projectId)
  if (!token) return NextResponse.json({ error: 'Projeto sem token de túnel.' }, { status: 404 })

  try {
    await tunnelSend(req.projectId, req.event, buildCommand(req, token, { sign: signingEnabled() }))
    return NextResponse.json({ ok: true }, { status: 202 })
  } catch (error: any) {
    console.error('[tunnel/send] falha ao enviar:', error?.message)
    return NextResponse.json({ error: 'Não foi possível enviar ao túnel.' }, { status: 502 })
  }
}
