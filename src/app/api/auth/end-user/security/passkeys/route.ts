import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')
    const externalUserId = searchParams.get('externalUserId')
    const credentialID = searchParams.get('credentialID')

    if (!projectId || !externalUserId || !credentialID) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Precisamos primeiro buscar os passkeys atuais
    const { data: existing, error: fetchError } = await supabase
      .from('project_users_security')
      .select('passkeys')
      .eq('project_id', projectId)
      .eq('external_user_id', externalUserId)
      .single()

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    if (!existing || !existing.passkeys) {
      return NextResponse.json({ success: true }) // Já não existe
    }

    const updatedPasskeys = existing.passkeys.filter((pk: any) => pk.credentialID !== credentialID)

    const { error: updateError } = await supabase
      .from('project_users_security')
      .update({ passkeys: updatedPasskeys })
      .eq('project_id', projectId)
      .eq('external_user_id', externalUserId)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Erro ao remover Passkey:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
