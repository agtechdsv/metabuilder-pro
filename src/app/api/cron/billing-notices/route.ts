import { NextResponse } from 'next/server'
import { runBillingNotices } from '@/lib/billing/billingService'

export const dynamic = 'force-dynamic'

/**
 * Cron diário (vercel.json): lembretes por data (3 dias antes, no dia, 1 e 3 dias depois), suspensão ao fim da carência, aviso de fim de acesso,
 * resumo ao admin e envio do que estiver na fila. Fechar o acesso de quem cancelou a renovação e passou da data roda sempre; o resto só com
 * os avisos ligados na aba Sistema.
 */
export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV === 'production' && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const result = await runBillingNotices()
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error('[cron/billing-notices] erro:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
