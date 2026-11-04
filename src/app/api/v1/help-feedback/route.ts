import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from '@/lib/tunnel/relayPolicy'
import { authorizeProjectActor } from '@/lib/tunnel/authorize'
import { getProjectSecretToken, tunnelCall, TunnelTimeoutError } from '@/lib/tunnel/server'
import { parseHelpFeedback } from '@/lib/helpFeedback'

export const dynamic = 'force-dynamic'

// Um usuário não precisa de mais que isso; evita encher o banco do cliente
const perUser = new RateLimiter(20, 60_000)

const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status })

/**
 * Feedback da ajuda ("Isto ajudou?"). Quem votou vem da sessão (usuário final ou membro do projeto), nunca do corpo.
 * O voto vai ao Agente CLI do cliente pelo canal assinado e fica na tabela mb_help_feedback do banco dele.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try { body = await req.json() } catch { return fail(400, 'Pedido inválido.') }
    const parsed = parseHelpFeedback(body)
    if (!parsed.ok) return fail(400, parsed.error)
    const f = parsed.value

    const actor = await authorizeProjectActor(req, f.projectId)
    if (!actor) return fail(401, 'Sessão inválida.')
    const userRef = actor.kind === 'member' ? `member:${actor.userId}` : actor.session.sub
    if (!perUser.allow(`${f.projectId}:${userRef}`)) return fail(429, 'Muitos envios. Aguarde um instante.')

    const token = await getProjectSecretToken(f.projectId)
    if (!token) return fail(502, 'Projeto sem túnel configurado.')

    const reply = await tunnelCall(
      f.projectId,
      'sql_query',
      {
        queryId: crypto.randomUUID(), action: 'help_feedback',
        data: { screen: f.screen, field: f.field, vote: f.vote, comment: f.comment, language: f.language, userRef },
      },
      { secret: token, timeoutMs: 10000 },
    )
    if (reply?.success === false) return fail(422, reply.error || 'Não foi possível gravar o feedback.')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof TunnelTimeoutError) return fail(504, 'O Agente CLI do projeto não respondeu.')
    console.error('[v1/help-feedback] erro:', error?.message)
    return fail(500, 'Erro interno no servidor.')
  }
}
