import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verify } from 'otplib'

export async function POST(req: NextRequest) {
  try {
    const { projectId, externalUserId, code, isSetup } = await req.json()

    if (!projectId || !externalUserId || !code) {
      return NextResponse.json({ error: 'Faltam parâmetros obrigatórios' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Busca o segredo do cofre
    const { data: userSec } = await supabase
      .from('project_users_security')
      .select('*')
      .eq('project_id', projectId)
      .eq('external_user_id', externalUserId)
      .single()

    if (!userSec || !userSec.totp_secret) {
      return NextResponse.json({ error: 'MFA não configurado para este usuário' }, { status: 400 })
    }

    // 2. Valida o código
    const result = await verify({
      token: code,
      secret: userSec.totp_secret
    })

    if (!result.valid) {
      return NextResponse.json({ error: 'Código inválido ou expirado' }, { status: 400 })
    }

    // 3. Se for a primeira vez configurando (isSetup = true), marcamos mfa_enabled = true
    if (isSetup && !userSec.mfa_enabled) {
      await supabase
        .from('project_users_security')
        .update({ mfa_enabled: true })
        .eq('id', userSec.id)
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Erro na verificação de MFA (end-user):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
