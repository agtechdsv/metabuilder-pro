import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// POST — Aplica migrações SQL e insere o caso de uso gerado na ui_views
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    session_id,
    project_id,
    use_case_name,
    use_case_slug,
    component_code,
    new_migrations,
    suggested_navigation,
    description,
    selected_tables,
    new_tables,
  } = await req.json()

  if (!project_id || !use_case_name || !use_case_slug || !component_code) {
    return NextResponse.json({ error: 'Campos obrigatórios: project_id, use_case_name, use_case_slug, component_code' }, { status: 400 })
  }

  // Verifica PRO
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_tier !== 'pro') {
    return NextResponse.json({ error: 'Este recurso é exclusivo do plano PRO.' }, { status: 403 })
  }

  // Garante slug único dentro do projeto
  const { data: existingView } = await supabase
    .from('ui_views')
    .select('id')
    .eq('project_id', project_id)
    .eq('slug', use_case_slug)
    .maybeSingle()

  const finalSlug = existingView
    ? `${use_case_slug}-${Date.now().toString(36)}`
    : use_case_slug

  // Monta o layout_config com a configuração de navegação
  const layout_config: Record<string, any> = {
    is_active: true,
    generated_by_ai: true,
    ai_session_id: session_id || null,
    description: description || null,
    navigation_type: suggested_navigation || 'menu_item',
    component_code,
  }

  // Insere na ui_views (o trigger enforce_freemium_use_cases_limit age aqui automaticamente)
  const { data: newView, error: insertError } = await supabase
    .from('ui_views')
    .insert({
      project_id,
      model_id: null,
      name: use_case_name,
      slug: finalSlug,
      logic_type: 'personalizado',
      view_type: 'advanced_use_case',
      tables_config: JSON.stringify([...(selected_tables || []), ...(new_tables || [])]),
      layout_config,
    })
    .select()
    .single()

  if (insertError) {
    // Verifica se é o trigger de limite freemium
    if (insertError.message?.includes('freemium') || insertError.code === 'P0001') {
      return NextResponse.json({
        error: 'Limite de casos de uso do plano Freemium atingido. Faça upgrade para PRO.',
        code: 'FREEMIUM_LIMIT'
      }, { status: 403 })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Atualiza status da sessão para 'applied'
  if (session_id) {
    await supabase
      .from('ai_builder_sessions')
      .update({ status: 'applied' })
      .eq('id', session_id)
  }

  return NextResponse.json({
    success: true,
    view: newView,
    slug: finalSlug,
    message: `Caso de uso "${use_case_name}" criado com sucesso!`
  })
}
