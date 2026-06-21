import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const externalUserId = searchParams.get('externalUserId')

    if (!projectId || !externalUserId) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('project_users_security')
      .update({ mfa_enabled: false, totp_secret: null })
      .eq('project_id', projectId)
      .eq('external_user_id', externalUserId)

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Erro ao remover MFA:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
