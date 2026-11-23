import { NextResponse } from 'next/server'
import { isCronAuthorized } from '@/lib/cronAuth'
import { createAdminClient } from '@/utils/supabase/server'
import { drainQueue, scheduleChangeReminders } from '@/lib/billing/priceChangeService'

export const dynamic = 'force-dynamic'

const MAX_CALLS = 8 // cada chamada recalcula um lote de assinaturas (o Asaas é lento); o resto continua no dia seguinte

/**
 * Cron diário (vercel.json) do reajuste de preços agendado:
 *  1) chama a Edge Function `price-change-apply`, que na data de vigência grava a regra nova e recalcula as assinaturas no Asaas (em lotes; a chave do
 *     Asaas fica só na Edge Function);
 *  2) enfileira os lembretes (7 dias antes da vigência, e 30 dias antes da renovação de quem paga trimestral, semestral ou anual) e envia a fila.
 */
export async function GET(req: Request) {
  try {
    if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing Supabase service credentials' }, { status: 500 })

    let applied = 0, resynced = 0, calls = 0, more = false
    for (; calls < MAX_CALLS; calls++) {
      const res = await fetch(`${url}/functions/v1/price-change-apply`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.error('[cron/price-change] a função respondeu', res.status, body)
        return NextResponse.json({ error: 'price-change-apply failed', status: res.status }, { status: 502 })
      }
      applied += Number(body.applied) || 0
      resynced += Number(body.resynced) || 0
      more = body.pending === true
      if (!more) break
    }

    const admin = createAdminClient()
    const reminders = await scheduleChangeReminders(admin)
    await drainQueue(admin)
    return NextResponse.json({ success: true, applied, resynced, calls: calls + (more ? 0 : 1), moreToResync: more, ...reminders })
  } catch (e: any) {
    console.error('[cron/price-change] erro:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
