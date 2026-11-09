import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Cron diário (vercel.json): chama a Edge Function `iclub-release`, que libera as recompensas de indicação cuja carência terminou
 * e recalcula a assinatura de quem as ganhou (o Asaas é acessado só pela Edge Function, que tem a chave dele).
 */
export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV === 'production' && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing Supabase service credentials' }, { status: 500 })

    const res = await fetch(`${url}/functions/v1/iclub-release`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[cron/iclub-release] a função respondeu', res.status, body)
      return NextResponse.json({ error: 'iclub-release failed', status: res.status }, { status: 502 })
    }
    return NextResponse.json({ success: true, ...body })
  } catch (e: any) {
    console.error('[cron/iclub-release] erro:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
