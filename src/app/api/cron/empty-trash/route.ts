import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { clampTrashHours, DEFAULT_TRASH_HOURS } from '@/lib/trash/trash'

export const dynamic = 'force-dynamic'

/**
 * Cron diário (vercel.json): apaga de vez, da lixeira, o que passou do prazo. O prazo é o ajuste global "trash_retention_hours"
 * (platform_settings), que só o SuperAdmin muda; sem ajuste, 48 horas. O que venceu já não podia ser restaurado (a restauração confere o
 * prazo); esta rota só libera o espaço, para todos os projetos de uma vez.
 */
export async function GET(req: Request) {
  try {
    if (process.env.NODE_ENV === 'production' && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'Missing Supabase service credentials' }, { status: 500 })
    const supabase = createClient(url, key)

    const { data: setting } = await supabase.from('platform_settings').select('value').eq('key', 'trash_retention_hours').maybeSingle()
    const hours = setting?.value && (setting.value as any).hours != null ? clampTrashHours((setting.value as any).hours) : DEFAULT_TRASH_HOURS
    const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString()

    const { data, error } = await supabase.from('mb_trash').delete().lt('deleted_at', cutoff).select('id')
    if (error) {
      console.error('[cron/empty-trash] falha ao esvaziar a lixeira:', error.message)
      return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 })
    }
    return NextResponse.json({ success: true, hours, deleted: data?.length || 0 })
  } catch (e: any) {
    console.error('[cron/empty-trash] erro:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
