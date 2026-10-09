import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from '@/lib/tunnel/relayPolicy'
import { applyExportProgress } from '@/lib/tunnel/exportProgress'

export const dynamic = 'force-dynamic'

// 240 avisos por minuto por projeto (uma exportação manda poucos: início, etapas e fim)
const limiter = new RateLimiter(240, 60_000)

/**
 * POST /api/export/progress { projectId, command } — o Agente CLI avisa o andamento de uma exportação.
 * Autenticado pela ASSINATURA com o token do projeto (nunca por cookie): só o Agente daquele projeto consegue.
 */
export async function POST(request: NextRequest) {
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const projectId = body?.projectId
  if (typeof projectId === 'string' && !limiter.allow(projectId)) return NextResponse.json({ error: 'Muitos avisos.' }, { status: 429 })

  const result = await applyExportProgress(projectId, body?.command)
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.status })
}
