import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID ausente' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const expectedChallenge = cookieStore.get('enduser_webauthn_auth_challenge')?.value

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Sessão de login expirada ou desafio não encontrado' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const credentialId = body.id

    // Precisamos achar qual usuário tem esse passkey
    // Para end-users, armazenamos o jsonb no campo passkeys.
    // Usamos o operador de JSON path do Postgres para achar quem tem a credencial.
    const { data: users, error } = await supabase
      .from('project_users_security')
      .select('*')
      .eq('project_id', projectId)

    if (error || !users) {
      return NextResponse.json({ error: 'Erro ao buscar dados de segurança' }, { status: 500 })
    }

    // Procura o usuário que tem esse credential ID
    let matchedUser: any = null
    let matchedCredential: any = null

    for (const user of users) {
      const passkeys = Array.isArray(user.passkeys) ? user.passkeys : []
      const found = passkeys.find((pk: any) => pk.credentialID === credentialId)
      if (found) {
        matchedUser = user
        matchedCredential = found
        break
      }
    }

    if (!matchedUser || !matchedCredential) {
      return NextResponse.json({ error: 'Credencial não registrada para nenhum usuário' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost'
    const rpID = host.split(':')[0]
    const origin = process.env.NEXT_PUBLIC_SITE_URL || `https://${host}`

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin.startsWith('http') ? origin : `https://${origin}`,
      expectedRPID: rpID,
      credential: {
        id: matchedCredential.credentialID,
        publicKey: new Uint8Array(Buffer.from(matchedCredential.credentialPublicKey, 'base64')),
        counter: matchedCredential.counter || 0,
        transports: matchedCredential.transports,
      },
    })

    if (!verification.verified) {
      return NextResponse.json({ error: 'Falha na verificação da biometria' }, { status: 400 })
    }

    // Atualiza o contador de uso
    const updatedPasskeys = matchedUser.passkeys.map((pk: any) => {
      if (pk.credentialID === matchedCredential.credentialID) {
        return { ...pk, counter: verification.authenticationInfo.newCounter }
      }
      return pk
    })

    await supabase
      .from('project_users_security')
      .update({ passkeys: updatedPasskeys })
      .eq('id', matchedUser.id)

    // Clear challenge
    cookieStore.delete('enduser_webauthn_auth_challenge')

    return NextResponse.json({ 
      success: true, 
      externalUserId: matchedUser.external_user_id 
    })
  } catch (error: any) {
    console.error('Auth verification error (end-user):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
