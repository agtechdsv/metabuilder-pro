import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

const MAX_CALLS = 12 // cada chamada concilia um lote de assinantes (o Asaas é lento); o resto continua no dia seguinte

/**
 * Cron diário (vercel.json): chama a Edge Function `asaas-reconcile`, que compara as cobranças abertas das assinaturas no Asaas com a tabela `payments`
 * e grava as que o webhook deixou passar (renovações), ajusta as que divergem e relata o que o Asaas diz estar PAGO e aqui está aberto. A chave do
 * Asaas fica só na Edge Function. Ver supabase/functions/_shared/reconcile.ts.
 */
export async function GET(req: Request) {
  try {
    if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing Supabase service credentials' }, { status: 500 })

    const total = { scanned: 0, inserted: 0, updated: 0, canceled: 0, paidNotRecorded: [] as string[], failures: [] as string[] }
    let after: string | null = null
    let calls = 0
    for (; calls < MAX_CALLS; calls++) {
      const res: Response = await fetch(`${url}/functions/v1/asaas-reconcile`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ after }), cache: 'no-store',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[cron/asaas-reconcile] a função respondeu', res.status, body)
        return NextResponse.json({ error: 'asaas-reconcile failed', status: res.status }, { status: 502 })
      }
      total.scanned += Number(body.scanned) || 0
      total.inserted += Number(body.inserted) || 0
      total.updated += Number(body.updated) || 0
      total.canceled += Number(body.canceled) || 0
      total.paidNotRecorded.push(...(Array.isArray(body.paidNotRecorded) ? body.paidNotRecorded : []))
      total.failures.push(...(Array.isArray(body.failures) ? body.failures : []))
      after = typeof body.next === 'string' ? body.next : null
      if (!after) break
    }
    if (total.paidNotRecorded.length) console.error('[cron/asaas-reconcile] PAGAS no Asaas e abertas aqui (webhook de pagamento não processado):', total.paidNotRecorded.join(', '))
    return NextResponse.json({ success: true, ...total, moreToReconcile: after !== null })
  } catch (e: any) {
    console.error('[cron/asaas-reconcile] erro:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
