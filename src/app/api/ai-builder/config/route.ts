import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

// GET — Busca a config de IA do workspace (sem retornar a chave)
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  // Verify that the user has access to the workspace via normal RLS
  const { data: workspaceAccess } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .maybeSingle()

  if (!workspaceAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use admin client to bypass ai_builder_configs RLS which might restrict non-owners from reading
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('ai_builder_configs')
    .select('id, provider, model, base_url, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ config: data })
}

// POST — Salva/atualiza a config de IA do workspace
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { workspace_id, provider, api_key, model, base_url } = await req.json()
  if (!workspace_id || !provider || !api_key) {
    return NextResponse.json({ error: 'workspace_id, provider e api_key são obrigatórios' }, { status: 400 })
  }

  // Verifica que o usuário é owner do workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspace_id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verifica a assinatura PRO
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_tier !== 'pro') {
    return NextResponse.json({ error: 'Este recurso é exclusivo do plano PRO.' }, { status: 403 })
  }

  // Upsert da configuração (chave armazenada como texto — criptografia via Supabase Vault é extensão paga;
  // aqui usamos a proteção via RLS + service role. A chave nunca é exposta no GET.)
  const { data, error } = await supabase
    .from('ai_builder_configs')
    .upsert(
      {
        workspace_id,
        provider,
        api_key_enc: api_key,
        model: model || null,
        base_url: base_url || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' }
    )
    .select('id, provider, model, base_url')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, config: data })
}

// DELETE — Exclui a config de IA do workspace
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  // Verifica que o usuário é owner do workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('ai_builder_configs')
    .delete()
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
