import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * GET /api/runtime/analytics-config?viewId=xxx
 *
 * Retorna o layout_config de uma ui_view para o runtime do BI/Analytics.
 * Substitui a chamada direta ao Supabase client no browser feita por useAnalyticsRuntime.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const viewId = searchParams.get('viewId')

    if (!viewId) {
      return NextResponse.json({ error: 'viewId é obrigatório' }, { status: 400 })
    }

    const supabase = await createClient()

    // Valida sessão do usuário
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // RLS garante que o usuário só vê views dos seus projetos
    const { data: viewData, error } = await supabase
      .from('ui_views')
      .select('layout_config')
      .eq('id', viewId)
      .single()

    if (error || !viewData) {
      return NextResponse.json({ error: 'View não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ layout_config: viewData.layout_config })
  } catch (error: any) {
    console.error('[analytics-config GET] Erro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * PATCH /api/runtime/analytics-config
 *
 * Atualiza o layout_config (e opcionalmente tables_config) de uma ui_view.
 * Substitui as escritas diretas ao Supabase client no browser feitas por useAnalyticsRuntime.
 *
 * Body: { viewId: string, layoutConfig: any, tablesConfig?: string[] }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { viewId, layoutConfig, tablesConfig } = body

    if (!viewId || layoutConfig === undefined) {
      return NextResponse.json({ error: 'viewId e layoutConfig são obrigatórios' }, { status: 400 })
    }

    const supabase = await createClient()

    // Valida sessão do usuário
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Monta o payload de update
    const updatePayload: Record<string, any> = { layout_config: layoutConfig }
    if (tablesConfig !== undefined) {
      updatePayload.tables_config = tablesConfig
    }

    // RLS garante que o usuário só atualiza views dos seus projetos
    const { error } = await supabase
      .from('ui_views')
      .update(updatePayload)
      .eq('id', viewId)

    if (error) {
      console.error('[analytics-config PATCH] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[analytics-config PATCH] Erro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
