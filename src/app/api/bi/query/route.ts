import { NextRequest, NextResponse } from 'next/server'
import { authorizeProjectActor } from '@/lib/tunnel/authorize'
import { MAX_RELAY_BYTES, RateLimiter } from '@/lib/tunnel/relayPolicy'
import { TunnelTimeoutError, getProjectSecretToken, tunnelCall } from '@/lib/tunnel/server'
import { endUserCookieName, verifyEndUserSession } from '@/lib/tunnel/sessionToken'
import { evaluateEndUserAccess, guardMode, loadAccessContext } from '@/lib/tunnel/tableAccess'
import { perfSettings } from '@/lib/bi/perf'
import { composeBiQuery, parseBiRequest, viewerFromSession } from '@/lib/bi/serverQuery'
import { loadBiContext } from '@/lib/bi/serverContext'
import { accessForSession } from '@/lib/rowPolicy/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// um painel dispara dezenas de consultas de uma vez (indicadores + comparação + atualização automática)
const limiter = new RateLimiter(900, 60_000)

/**
 * POST /api/bi/query
 *
 * O navegador pede "o indicador X com estes filtros". O servidor usa o indicador SALVO, lê o usuário da sessão assinada,
 * soma a regra de acesso por linha (RLS), planeja o SQL, executa pelo túnel (comando assinado, resposta em tópico
 * privado) e devolve o resultado. O navegador não envia SQL nem diz quem é o usuário.
 */
export async function POST(request: NextRequest) {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > MAX_RELAY_BYTES) return NextResponse.json({ error: 'Pedido grande demais.' }, { status: 413 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const parsed = parseBiRequest(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { req } = parsed

  const actor = await authorizeProjectActor(request, req.projectId)
  if (!actor) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  const isMember = actor.kind === 'member'

  const who = isMember ? `m:${(actor as any).userId}` : `e:${actor.session.pid}:${actor.session.sub}`
  if (!limiter.allow(who)) return NextResponse.json({ error: 'Muitas consultas em pouco tempo.' }, { status: 429 })

  try {
    // o rascunho (?preview=draft) é coisa de membro; o usuário final só enxerga o publicado
    const loaded = await loadBiContext(req.projectId, req.viewId, { draft: isMember && req.draft })
    if (!loaded.ok) return NextResponse.json({ error: loaded.message, code: loaded.code }, { status: loaded.status })
    const { config, ctx } = loaded.value

    // Quem vê o painel vem SEMPRE da sessão assinada. Membro que também entrou no app como usuário final testa a regra com esse usuário.
    const session = verifyEndUserSession(request.cookies.get(endUserCookieName(req.projectId))?.value, req.projectId)
    const viewer = viewerFromSession(session)

    const composed = composeBiQuery({ req, config, actor: isMember ? 'member' : 'end_user', viewer, ctx })
    if (!composed.ok) return NextResponse.json({ error: composed.message, code: composed.code, ...(composed.denied ? { denied: composed.denied } : {}) }, { status: composed.status })

    const payload = {
      action: 'select',
      query: composed.sql,
      sql: composed.sql,
      schemaName: composed.schemaName,
      table: composed.tableName,
      limit: composed.limit,
      projectId: req.projectId,
    }

    // usuário final: as mesmas conferências do relay (só tabelas do projeto, só leitura, sem colunas de senha)
    const mode = guardMode()
    if (!isMember && mode !== 'off') {
      try {
        const violations = evaluateEndUserAccess(payload, await loadAccessContext(req.projectId))
        if (violations.length) {
          console.warn(`[bi/guard] ${mode} projeto=${req.projectId} tabela=${composed.tableName} violacoes=${JSON.stringify(violations)}`)
          if (mode === 'enforce') return NextResponse.json({ error: 'Acesso a estes dados não permitido.', code: 'guard' }, { status: 403 })
        }
      } catch (e: any) {
        console.error('[bi/guard] não foi possível conferir:', e?.message)
        if (mode === 'enforce') return NextResponse.json({ error: 'Não foi possível validar o acesso.', code: 'guard' }, { status: 503 })
      }
    }

    // permissões e regras por linha das TABELAS (valem também no BI): o Agente as aplica no SQL
    const access = !isMember ? await accessForSession(req.projectId, session ?? (actor.kind === 'end_user' ? actor.session : null)) : undefined

    const token = await getProjectSecretToken(req.projectId)
    if (!token) return NextResponse.json({ error: 'Projeto sem token de túnel.' }, { status: 404 })

    const timeoutMs = Math.min(55, perfSettings(config).timeoutSeconds) * 1000
    const result = await tunnelCall(req.projectId, 'sql_query', { queryId: crypto.randomUUID(), ...payload, ...(access ? { access } : {}) }, { secret: token, timeoutMs })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof TunnelTimeoutError) return NextResponse.json({ error: 'timeout', code: 'timeout' }, { status: 504 })
    console.error('[bi/query] falha:', error?.message)
    return NextResponse.json({ error: 'Não foi possível consultar os dados.', code: 'transport' }, { status: 502 })
  }
}
