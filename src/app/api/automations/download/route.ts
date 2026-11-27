import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from '@/lib/tunnel/relayPolicy'
import { applyAutomationDownload } from '@/lib/tunnel/automationDownload'

export const dynamic = 'force-dynamic'

// Entregas por projeto: 60 por hora (uma automação de relatório entrega poucas por dia) e tentativas com assinatura errada por origem
const perProject = new RateLimiter(60, 3_600_000)
const failedAuth = new RateLimiter(20, 60_000)

const originOf = (req: NextRequest) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'ip'

/**
 * POST /api/automations/download { projectId, command } — o Agente CLI entrega o arquivo gerado por uma ação "Download" na Central de
 * Downloads dos destinatários. Autenticado pela ASSINATURA com o token do projeto (nunca por cookie).
 */
export async function POST(request: NextRequest) {
  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const projectId = body?.projectId
  if (typeof projectId === 'string' && !perProject.allow(projectId)) return NextResponse.json({ error: 'Limite de entregas atingido. Tente mais tarde.' }, { status: 429 })

  const result = await applyAutomationDownload(projectId, body?.command)
  if (!result.ok) {
    if (result.status === 401 && !failedAuth.allow(originOf(request))) return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 })
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ ok: true, delivered: result.delivered })
}
