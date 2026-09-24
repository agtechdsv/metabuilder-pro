import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const idOrName = searchParams.get('id') || searchParams.get('name')
  const projectId = searchParams.get('project_id')

  if (!idOrName) {
    return NextResponse.json({ error: 'Missing id or name parameter' }, { status: 400 })
  }

  try {
    // Requer sessão autenticada
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Usa admin apenas para lookup, mas filtra por project_id quando fornecido
    const supabaseAdmin = createAdminClient()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName)

    let query = supabaseAdmin
      .from('project_enumerations')
      .select('id, name, values')

    // Sempre filtra por project_id quando fornecido (impede cross-project access)
    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (isUuid) {
      query = query.or(`id.eq.${idOrName},name.eq.${idOrName}`)
    } else {
      query = query.eq('name', idOrName)
    }

    let { data, error } = await query.limit(1).maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Se não encontrou de forma exata, tenta busca case-insensitive por nome
    if (!data) {
      let ilikeQuery = supabaseAdmin
        .from('project_enumerations')
        .select('id, name, values')
        .ilike('name', idOrName)
        .limit(1)
      if (projectId) {
        ilikeQuery = ilikeQuery.eq('project_id', projectId)
      }
      const { data: ilikeData, error: ilikeErr } = await ilikeQuery.maybeSingle()
      if (!ilikeErr && ilikeData) {
        data = ilikeData
      }
    }

    if (!data) {
      return NextResponse.json({ data: { values: [] } })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

