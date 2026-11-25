import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { RateLimiter } from '@/lib/tunnel/relayPolicy'

export const dynamic = 'force-dynamic'

// Tentativas com token errado, por origem: impede adivinhar o token do projeto
const failedAuth = new RateLimiter(10, 60_000)
// Consultas por projeto (o motor só consulta ao ligar e ao publicar um fluxo)
const perMinute = new RateLimiter(30, 60_000)

const originOf = (req: NextRequest) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'ip'

/**
 * POST /api/automations/workflows — o Agente CLI pede os fluxos ATIVOS (publicados) e os modelos do projeto.
 * Autenticado pelo secret_token. Existe porque bpm_workflows e models têm RLS fechado para a chave anon do CLI
 * (sem esta rota o motor subia com 0 fluxos).
 */
export async function POST(req: NextRequest) {
  try {
    const origin = originOf(req)
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    let body: any
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
    const { project_id, token } = body || {}
    if (!project_id || !token || typeof project_id !== 'string' || typeof token !== 'string') {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios.' }, { status: 400 })
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('secret_token', token)
      .maybeSingle()
    if (projectError || !project) {
      if (!failedAuth.allow(origin)) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um instante.' }, { status: 429 })
      return NextResponse.json({ error: 'Credenciais inválidas (secret_token).' }, { status: 401 })
    }

    if (!perMinute.allow(project_id)) return NextResponse.json({ error: 'Muitas consultas. Tente novamente em instantes.' }, { status: 429 })

    const [wf, models] = await Promise.all([
      supabase.from('bpm_workflows').select('id, name, flow_data').eq('project_id', project_id).eq('is_active', true).not('flow_data', 'is', null),
      supabase.from('models').select('id, db_table_name, display_name').eq('project_id', project_id),
    ])
    if (wf.error || models.error) {
      console.error('[automations/workflows] falha ao ler:', wf.error?.message || models.error?.message)
      return NextResponse.json({ error: 'Não foi possível ler os fluxos.' }, { status: 500 })
    }

    return NextResponse.json({ workflows: wf.data || [], models: models.data || [] })
  } catch (error: any) {
    console.error('[automations/workflows] erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
