import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from '@/lib/tunnel/relayPolicy'
import { authorizeProjectActor, authorizeProjectMember } from '@/lib/tunnel/authorize'
import { getProjectSecretToken, tunnelCall, TunnelTimeoutError } from '@/lib/tunnel/server'
import { groupNamesForSession, loadTableAccess } from '@/lib/rowPolicy/server'
import { APPROVAL_CLI_ACTION, MEMBER_ONLY_OPS, approvalActor, approvalCommandData, parseApprovalRequest } from '@/lib/approvals'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// uma tela de tarefas faz poucas chamadas; o limite só barra abuso
const perUser = new RateLimiter(120, 60_000)

const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status })

/**
 * Aguardar aprovação: lista as tarefas, decide, mostra o histórico de um registro e (só o dono do projeto) vê e cancela todas.
 * Quem age e os perfis dele vêm da SESSÃO (cookie assinado do usuário final, ou login de membro do projeto), nunca do corpo:
 * o servidor os assina dentro do comando e o Agente CLI só confia nisso. O navegador não consegue enviar estas ações pelo relay.
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try { body = await req.json() } catch { return fail(400, 'Pedido inválido.') }
    const parsed = parseApprovalRequest(body)
    if (!parsed.ok) return fail(400, parsed.error)
    const r = parsed.req

    let actor = await authorizeProjectActor(req, r.projectId)
    if (!actor) return fail(401, 'Sessão inválida.')
    // dono que também entrou no app como usuário final: nas operações de administração vale como membro (como no relay do túnel)
    // Cancelar: o dono cancela qualquer tarefa; o usuário final só o próprio pedido (o Agente confere quem pediu).
    if (actor.kind !== 'member' && (MEMBER_ONLY_OPS.includes(r.op) || r.op === 'cancel')) {
      const member = await authorizeProjectMember(r.projectId)
      if (member) actor = member
      else if (MEMBER_ONLY_OPS.includes(r.op)) return fail(403, 'Apenas membros do projeto.')
    }

    // perfis do usuário (nomes dos grupos): só para quem é usuário final; falha ao ler = sem perfis (falha fechada: não aprova por perfil)
    const roles = actor.kind === 'end_user' ? await groupNamesForSession(r.projectId, actor.session) : []
    const identity = approvalActor(actor, roles)
    if (!identity) return fail(401, 'Entre no aplicativo para ver e decidir aprovações.')
    if (!perUser.allow(`${r.projectId}:${identity.id}`)) return fail(429, 'Muitas chamadas. Aguarde um instante.')

    // histórico de um registro: o usuário final só vê o de tabelas que o projeto cadastrou e que não estão fechadas para ele
    if (r.op === 'history' && actor.kind === 'end_user') {
      const configs = await loadTableAccess(r.projectId).catch(() => null)
      const cfg = configs?.find(c => c.table.split('.').pop()!.toLowerCase() === String(r.table).toLowerCase())
      if (!cfg || cfg.closed) return fail(403, 'Acesso a estes dados não permitido.')
    }

    const token = await getProjectSecretToken(r.projectId)
    if (!token) return fail(502, 'Projeto sem túnel configurado.')

    const reply = await tunnelCall(
      r.projectId,
      'sql_query',
      { queryId: crypto.randomUUID(), action: APPROVAL_CLI_ACTION[r.op], data: approvalCommandData(r), actor: identity },
      { secret: token, timeoutMs: r.countOnly ? 8000 : 20000 }, // o contador do cabeçalho não pode segurar a página com o CLI desligado
    )
    if (reply?.success === false) return fail(422, reply.error || 'Não foi possível concluir a operação.')
    return NextResponse.json({ success: true, data: reply?.data?.[0] ?? null })
  } catch (error: any) {
    if (error instanceof TunnelTimeoutError) return fail(504, 'O Agente CLI do projeto não respondeu. Ele está ligado?')
    console.error('[v1/approvals] erro:', error?.message)
    return fail(500, 'Erro interno no servidor.')
  }
}
