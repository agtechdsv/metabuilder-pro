import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const externalUserId = searchParams.get('externalUserId')

    if (!projectId || !externalUserId) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Bypass RLS para End-Users sem sessão
    )

    const { data, error } = await supabase
      .from('project_users_security')
      .select('*')
      .eq('project_id', projectId)
      .eq('external_user_id', externalUserId)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message)
    }

    return NextResponse.json({
      data: data || null
    })

  } catch (error: any) {
    console.error('Erro ao buscar dados de segurança:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
