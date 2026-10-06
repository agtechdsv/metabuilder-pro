import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'
import { authorizeProjectActor } from '@/lib/tunnel/authorize'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const idOrName = searchParams.get('id') || searchParams.get('name')
  const projectId = searchParams.get('project_id')

  if (!idOrName) {
    return NextResponse.json({ error: 'Missing id or name parameter' }, { status: 400 })
  }

  try {
    // Usa admin apenas para lookup, mas filtra por project_id quando fornecido
    const supabaseAdmin = createAdminClient()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName)

    let query = supabaseAdmin
      .from('project_enumerations')
      .select('id, name, values, project_id')

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
        .select('id, name, values, project_id')
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

    // Quem pede precisa ter acesso AO PROJETO DONO da enumeração: membro (regra de acesso do banco) ou usuário final
    // com a sessão assinada do projeto (as listas de opções dos formulários do app publicado).
    const actor = await authorizeProjectActor(request, (data as any).project_id)
    if (!actor) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { project_id: _omit, ...enumeration } = data as any
    return NextResponse.json({ data: enumeration })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
