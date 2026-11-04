import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from '@/lib/tunnel/relayPolicy'
import { getProjectSecretToken, serviceClient, tunnelCall, TunnelTimeoutError } from '@/lib/tunnel/server'
import { WEBHOOK_MAX_BODY_BYTES, extractSecret, findWebhookTrigger, secretMatches, toFlowData } from '@/lib/automations/webhookInbound'

export const dynamic = 'force-dynamic'

// Tentativas recusadas por origem: impede adivinhar o segredo de um fluxo
const failedAuth = new RateLimiter(10, 60_000)
// Chamadas aceitas por fluxo: um sistema externo com defeito não pode sobrecarregar o banco do cliente
const callsPerWorkflow = new RateLimiter(60, 60_000)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const originOf = (req: NextRequest) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'ip'
const denied = (status: number, error: string) => NextResponse.json({ success: false, error }, { status })

/**
 * Webhook de entrada de um fluxo BPM: /api/v1/webhook/<id do fluxo>.
 * Exige o segredo do fluxo (Authorization: Bearer ou X-Webhook-Secret). Confere, limita e repassa ao Agente CLI do cliente
 * pelo canal de comandos assinado; o fluxo roda lá e a resposta volta aqui.
 */
async function handle(req: NextRequest, ctx: { params: Promise<{ workflowId: string }> }) {
  try {
    const origin = originOf(req)
    const { workflowId } = await ctx.params

    // mesma resposta para fluxo inexistente, inativo, sem segredo ou segredo errado: não revela quais fluxos existem
    const refuse = () => failedAuth.allow(origin)
      ? denied(401, 'Credenciais inválidas.')
      : denied(429, 'Muitas tentativas. Aguarde um instante.')

    if (!UUID.test(workflowId)) return refuse()
    const presented = extractSecret(req.headers)
    if (!presented) return refuse()

    const { data: wf } = await serviceClient()
      .from('bpm_workflows')
      .select('id, project_id, flow_data, is_active')
      .eq('id', workflowId)
      .maybeSingle()
    const trigger = wf && wf.is_active ? findWebhookTrigger(wf.flow_data) : null
    if (!wf || !trigger || !secretMatches(presented, trigger.secretHash)) return refuse()

    if (req.method !== trigger.method) return NextResponse.json({ success: false, error: `Método não permitido. Use ${trigger.method}.` }, { status: 405, headers: { Allow: trigger.method } })
    if (!callsPerWorkflow.allow(workflowId)) return denied(429, 'Limite de chamadas atingido. Tente novamente em instantes.')

    // entrada: consulta (GET) ou corpo JSON (demais métodos), com limite de tamanho
    let input: unknown = {}
    if (req.method === 'GET') {
      input = Object.fromEntries(req.nextUrl.searchParams.entries())
    } else {
      const declared = Number(req.headers.get('content-length') || 0)
      if (declared > WEBHOOK_MAX_BODY_BYTES) return denied(413, 'Corpo grande demais.')
      const text = await req.text()
      if (text.length > WEBHOOK_MAX_BODY_BYTES) return denied(413, 'Corpo grande demais.')
      if (text.trim()) {
        try { input = JSON.parse(text) } catch { return denied(400, 'O corpo precisa ser um JSON válido.') }
      }
    }

    const token = await getProjectSecretToken(wf.project_id)
    if (!token) return denied(502, 'Projeto sem túnel configurado.')

    const reply = await tunnelCall(
      wf.project_id,
      'sql_query',
      { queryId: crypto.randomUUID(), action: 'trigger_webhook', workflowId, data: toFlowData(input) },
      { secret: token, timeoutMs: 15000 },
    )
    if (reply?.success === false) return denied(422, reply.error || 'O fluxo recusou a chamada.')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof TunnelTimeoutError) return denied(504, 'O Agente CLI do projeto não respondeu. Ele está ligado?')
    console.error('[v1/webhook] erro:', error?.message)
    return denied(500, 'Erro interno no servidor.')
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
