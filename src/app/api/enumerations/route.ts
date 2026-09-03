import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const idOrName = searchParams.get('id') || searchParams.get('name')

  if (!idOrName) {
    return NextResponse.json({ error: 'Missing id or name parameter' }, { status: 400 })
  }

  try {
    const supabaseAdmin = createAdminClient()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName)

    let query = supabaseAdmin
      .from('project_enumerations')
      .select('id, name, values')

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
      const { data: ilikeData, error: ilikeErr } = await supabaseAdmin
        .from('project_enumerations')
        .select('id, name, values')
        .ilike('name', idOrName)
        .limit(1)
        .maybeSingle()

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
