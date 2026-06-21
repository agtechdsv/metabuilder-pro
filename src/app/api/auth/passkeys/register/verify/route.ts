import { NextResponse } from 'next/server'
import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Retrieve expected challenge
    const cookieStore = await cookies()
    const expectedChallenge = cookieStore.get('webauthn_challenge')?.value

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Nenhum desafio encontrado para verificação' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost'
    const rpID = host.split(':')[0]
    
    // In production, you might want to specify exactly the expected origin (e.g. https://domain.com)
    // For local dev, http://localhost:3000
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const expectedOrigin = request.headers.get('origin') || `${protocol}://${host}`

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    })

    const { verified, registrationInfo } = verification

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo

      // Save the credential
      const { error: insertError } = await supabase.from('passkey_credentials').insert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: '\\x' + Buffer.from(credential.publicKey).toString('hex'),
        counter: credential.counter,
        transports: body.response.transports || [],
        device_type: credentialDeviceType,
        backed_up: credentialBackedUp,
      })

      if (insertError) {
        console.error('Failed to save credential', insertError)
        return NextResponse.json({ error: 'Erro ao salvar credencial biométrica' }, { status: 500 })
      }

      // Clear the challenge
      const cookieStoreToClear = await cookies()
      cookieStoreToClear.delete('webauthn_challenge')

      return NextResponse.json({ verified: true })
    }

    return NextResponse.json({ error: 'Falha na verificação da biometria' }, { status: 400 })

  } catch (error: any) {
    console.error('Registration verify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
