import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isCronAuthorized } from '@/lib/cronAuth'
import { dayInBrasilia, dueState } from '@/lib/nfse/queue'
import { nfseDigestMail } from '@/lib/nfse/nfseMail'
import { sendTeamNoticeFor } from '@/lib/security/securityMail'

export const dynamic = 'force-dynamic'

/**
 * Cron diário (vercel.json, 8h em Brasília): avisa a equipe por e-mail quantas notas fiscais pedem atenção (para emitir hoje ou atrasadas).
 * Sem nada a avisar, não envia nada. O destino vem do Gerenciador de e-mails (assunto "avisos de cobrança à equipe"), como os outros avisos.
 * Se scripts/nfse-fila.sql ainda não foi rodado, só avisa no log e segue.
 */
export async function GET(req: Request) {
  try {
    if (!isCronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing Supabase service credentials' }, { status: 500 })
    const supabase = createClient(url, key)

    const { data, error } = await supabase.from('mb_nfse_queue').select('emit_on').eq('status', 'pending').limit(1000)
    if (error) {
      console.warn('[cron/nfse-due] fila indisponível:', error.message)
      return NextResponse.json({ success: true, skipped: true })
    }
    const today = dayInBrasilia(new Date())
    const count = { late: 0, today: 0, soon: 0 }
    for (const r of data || []) {
      const s = dueState(String(r.emit_on).slice(0, 10), today).state
      if (s === 'late') count.late++
      else if (s === 'today') count.today++
      else if (s === 'soon') count.soon++
    }
    const mail = nfseDigestMail(count)
    let sent = false
    if (mail) sent = await sendTeamNoticeFor('billing_team', mail.subject, mail.text, mail.html)
    return NextResponse.json({ success: true, ...count, sent })
  } catch (e: any) {
    console.error('[cron/nfse-due] erro:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
