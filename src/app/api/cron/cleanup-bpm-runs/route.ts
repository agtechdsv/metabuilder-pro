import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { retentionDays, retentionCutoff } from '@/lib/automations/runReport'

export const dynamic = 'force-dynamic'

/**
 * Cron diário (vercel.json): apaga as execuções de BPM mais antigas que a "Retenção de logs" de cada projeto
 * (módulo Automações no Studio). Projetos com "Para sempre" (0) não são tocados; sem ajuste salvo, vale 30 dias.
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

    // projetos com execuções registradas + o ajuste de retenção de cada um
    const { data: projects, error } = await supabase.from('bpm_runs').select('project_id').limit(100000)
    if (error) return NextResponse.json({ error: 'Failed to list runs' }, { status: 500 })
    const projectIds = Array.from(new Set((projects || []).map((r: any) => r.project_id as string)))
    if (projectIds.length === 0) return NextResponse.json({ success: true, deleted: 0 })

    const { data: configs } = await supabase.from('ui_views').select('project_id, layout_config').eq('slug', 'automations').in('project_id', projectIds)
    const byProject = new Map<string, any>((configs || []).map((c: any) => [c.project_id as string, c.layout_config]))

    let deleted = 0
    for (const projectId of projectIds) {
      const cutoff = retentionCutoff(retentionDays(byProject.get(projectId)))
      if (!cutoff) continue
      const { data, error: delError } = await supabase.from('bpm_runs').delete().eq('project_id', projectId).lt('started_at', cutoff.toISOString()).select('id')
      if (delError) console.error('[cron/cleanup-bpm-runs] falha no projeto', projectId, delError.message)
      else deleted += data?.length || 0
    }
    return NextResponse.json({ success: true, deleted })
  } catch (e: any) {
    console.error('[cron/cleanup-bpm-runs] erro:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
