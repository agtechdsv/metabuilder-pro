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
    view_id,          // opcional — se presente, edita em vez de criar
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

  // ── MODO EDIÇÃO: atualiza view existente ────────────────────────────────────
  if (view_id) {
    // Busca a view existente para verificar o slug atual
    const { data: existingView } = await supabase
      .from('ui_views')
      .select('id, slug, layout_config')
      .eq('id', view_id)
      .eq('project_id', project_id)
      .single()

    if (!existingView) {
      return NextResponse.json({ error: 'Caso de uso não encontrado.' }, { status: 404 })
    }

    const oldSlug = existingView.slug
    const finalSlug = use_case_slug

    // Monta layout_config preservando campos existentes
    const layout_config: Record<string, any> = {
      ...(existingView.layout_config || {}),
      is_active: true,
      generated_by_ai: true,
      description: description || null,
      navigation_type: suggested_navigation || 'menu_item',
      component_code,
    }

    const { data: updatedView, error: updateError } = await supabase
      .from('ui_views')
      .update({
        name: use_case_name,
        slug: finalSlug,
        tables_config: JSON.stringify([...(selected_tables || []), ...(new_tables || [])]),
        layout_config,
      })
      .eq('id', view_id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Atualiza o menu de navegação se o slug mudou
    if (oldSlug !== finalSlug) {
      const { data: proj } = await supabase
        .from('projects').select('navigation').eq('id', project_id).single()
      if (proj?.navigation) {
        const updatedNav = proj.navigation.map((item: any) =>
          item.type === 'view' && item.target === oldSlug
            ? { ...item, target: finalSlug, label: use_case_name }
            : item
        )
        await supabase.from('projects').update({ navigation: updatedNav }).eq('id', project_id)
      }
    } else {
      // Mesmo slug — apenas atualiza o label no menu se existir
      const { data: proj } = await supabase
        .from('projects').select('navigation').eq('id', project_id).single()
      if (proj?.navigation) {
        const updatedNav = proj.navigation.map((item: any) =>
          item.type === 'view' && item.target === finalSlug
            ? { ...item, label: use_case_name }
            : item
        )
        await supabase.from('projects').update({ navigation: updatedNav }).eq('id', project_id)
      }
    }

    // Garante que o item está no menu se solicitado
    if (suggested_navigation === 'menu_item') {
      const { data: proj } = await supabase
        .from('projects').select('navigation').eq('id', project_id).single()
      if (proj) {
        const currentMenu = proj.navigation || []
        if (!currentMenu.some((item: any) => item.type === 'view' && item.target === finalSlug)) {
          const newItem = {
            id: crypto.randomUUID(), label: use_case_name, description: '',
            icon: 'Layout', type: 'view', target: finalSlug, show_dashboard: true
          }
          await supabase.from('projects')
            .update({ navigation: [...currentMenu, newItem] }).eq('id', project_id)
        }
      }
    }

    return NextResponse.json({
      success: true,
      view: updatedView,
      slug: finalSlug,
      message: `Caso de uso "${use_case_name}" atualizado com sucesso!`
    })
  }

  // ── MODO CRIAÇÃO: insere nova view ──────────────────────────────────────────

  // Garante slug único dentro do projeto
  const { data: existingBySlug } = await supabase
    .from('ui_views')
    .select('id')
    .eq('project_id', project_id)
    .eq('slug', use_case_slug)
    .maybeSingle()

  const finalSlug = existingBySlug
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

  // Se o usuário selecionou 'Item de Menu Lateral', adiciona à navegação do projeto
  if (suggested_navigation === 'menu_item') {
    const { data: project } = await supabase
      .from('projects')
      .select('navigation')
      .eq('id', project_id)
      .single()
      
    if (project) {
      const currentMenu = project.navigation || []
      // Verifica se já não existe no menu
      if (!currentMenu.some((item: any) => item.type === 'view' && item.target === finalSlug)) {
        const newItem = {
          id: crypto.randomUUID(),
          label: use_case_name,
          description: '',
          icon: 'Layout',
          type: 'view',
          target: finalSlug,
          show_dashboard: true
        }
        await supabase
          .from('projects')
          .update({ navigation: [...currentMenu, newItem] })
          .eq('id', project_id)
      }
    }
  }

  return NextResponse.json({
    success: true,
    view: newView,
    slug: finalSlug,
    message: `Caso de uso "${use_case_name}" criado com sucesso!`
  })
}
