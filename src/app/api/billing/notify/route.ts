import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/server'
import { loadBillingSettings, processQueue } from '@/lib/billing/billingService'

export const dynamic = 'force-dynamic'

/** Comparação em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres do segredo acertou). */
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * O webhook do Asaas (Edge Function) chama aqui logo depois de enfileirar um aviso de cobrança, para o e-mail sair na hora em vez de esperar a
 * rotina diária. Só quem tem o segredo (BILLING_NOTIFY_SECRET, igual nas duas pontas) consegue. Sem o segredo configurado, recusa tudo.
 * Só envia a fila: não cria nem altera nada, então chamar de novo é inofensivo.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.BILLING_NOTIFY_SECRET?.trim()
    const given = req.headers.get('x-billing-secret') || ''
    if (!secret || !sameSecret(given, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const cfg = await loadBillingSettings(admin)
    const result = await processQueue(admin, cfg)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error('[billing/notify] erro:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
