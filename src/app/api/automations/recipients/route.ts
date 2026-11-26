import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { RateLimiter } from '@/lib/tunnel/relayPolicy'

export const dynamic = 'force-dynamic'

// Tentativas com token errado, por origem: impede adivinhar o token do projeto
const failedAuth = new RateLimiter(10, 60_000)
// Consultas por projeto (uma por e-mail com destinatário "usuários e grupos")
const perMinute = new RateLimiter(60, 60_000)

const originOf = (req: NextRequest) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'ip'

/**
 * POST /api/automations/recipients — o Agente CLI pede a configuração para resolver "usuários e grupos do sistema" de um e-mail
 * do fluxo: tabelas de login/grupos do projeto e perfis da plataforma. Autenticado pelo secret_token.
 * Existe porque essas tabelas têm RLS fechado para a chave anon do CLI (sem esta rota o grupo resolvia vazio, em silêncio).
 * Devolve só o necessário (nunca a configuração visual do login nem senhas).
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

    const [cfg, roles, userRoles] = await Promise.all([
      supabase.from('project_auth_config').select('db_table_name, db_email_column, ui_config').eq('project_id', project_id).maybeSingle(),
      supabase.from('project_roles').select('id, name').eq('project_id', project_id),
      supabase.from('project_user_roles').select('role_id, external_user_id').eq('project_id', project_id),
    ])
    if (cfg.error || roles.error || userRoles.error) {
      console.error('[automations/recipients] falha ao ler:', cfg.error?.message || roles.error?.message || userRoles.error?.message)
      return NextResponse.json({ error: 'Não foi possível ler a configuração.' }, { status: 500 })
    }

    const ui: any = (cfg.data as any)?.ui_config || {}
    return NextResponse.json({
      auth: {
        db_table_name: (cfg.data as any)?.db_table_name || null,
        db_email_column: (cfg.data as any)?.db_email_column || null,
        sync_legacy_groups: !!ui.sync_legacy_groups,
        user_groups_type: ui.db_user_groups_type || null,
        user_role_column: ui.db_user_role_column || null,
        groups_table: ui.db_groups_table || null,
        groups_name_column: ui.db_groups_name_column || null,
        user_roles_table: ui.db_user_roles_table || null,
        user_roles_user_col: ui.db_user_roles_user_id_column || null,
        user_roles_role_col: ui.db_user_roles_role_id_column || null,
      },
      roles: roles.data || [],
      userRoles: userRoles.data || [],
    })
  } catch (error: any) {
    console.error('[automations/recipients] erro:', error)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
