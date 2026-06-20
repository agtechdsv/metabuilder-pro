import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, externalUserId } = body

    if (!projectId || !externalUserId) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const expectedChallenge = cookieStore.get('enduser_webauthn_register_challenge')?.value

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Sessão expirada. Tente registrar novamente.' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost'
    const rpID = host.split(':')[0]
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `https://${host}`

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin.startsWith('http') ? origin : `https://${origin}`,
      expectedRPID: rpID,
      requireUserVerification: true,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Falha na verificação da biometria' }, { status: 400 })
    }

    const { credential } = verification.registrationInfo

    // Cria ou atualiza o cofre do usuário final
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: existingSec } = await supabase
      .from('project_users_security')
      .select('*')
      .eq('project_id', projectId)
      .eq('external_user_id', externalUserId)
      .single()

    const newPasskey = {
      credentialID: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: body.response.transports || [],
      registered_at: new Date().toISOString()
    }

    let passkeys: any[] = []
    if (existingSec && Array.isArray(existingSec.passkeys)) {
      passkeys = [...existingSec.passkeys]
    }
    passkeys.push(newPasskey)

    const { error } = await supabase
      .from('project_users_security')
      .upsert({
        project_id: projectId,
        external_user_id: externalUserId,
        passkeys,
        mfa_enabled: existingSec?.mfa_enabled || false
      }, { onConflict: 'project_id,external_user_id' })

    if (error) {
      throw new Error('Erro ao salvar credencial de segurança: ' + error.message)
    }

    cookieStore.delete('enduser_webauthn_register_challenge')

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Registration verification error (end-user):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
