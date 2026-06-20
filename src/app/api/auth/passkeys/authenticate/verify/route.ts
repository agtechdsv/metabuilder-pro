import { NextResponse } from 'next/server'
import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Retrieve expected challenge from cookie
    const cookieStore = require('next/headers').cookies()
    const expectedChallenge = cookieStore.get('webauthn_auth_challenge')?.value

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Nenhum desafio encontrado para verificação de login' }, { status: 400 })
    }

    // Find the credential in DB
    const { data: credentialData, error: credError } = await supabase
      .from('passkey_credentials')
      .select('*, profiles(email)')
      .eq('credential_id', body.id)
      .single()

    if (credError || !credentialData) {
      return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 404 })
    }

    const host = request.headers.get('host') || 'localhost'
    const rpID = host.split(':')[0]
    
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const expectedOrigin = `${protocol}://${host}`

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: credentialData.credential_id, // string base64url
        publicKey: Buffer.from(credentialData.public_key.replace(/^\\x/, ''), 'hex'),
        counter: Number(credentialData.counter),
        transports: credentialData.transports,
      },
    })

    const { verified, authenticationInfo } = verification

    if (verified && authenticationInfo) {
      // Update counter
      await supabase
        .from('passkey_credentials')
        .update({
          counter: authenticationInfo.newCounter,
          last_used_at: new Date().toISOString()
        })
        .eq('credential_id', credentialData.credential_id)

      // ** SUPABASE LOGIN HACK **
      // Supabase does not have `logInAsUser(id)`. The most secure way to do this backend-side 
      // is to use Admin API to generate an OTP or Magic Link, then verify it.
      // Or we can just use generateLink and extract the hashed token. 
      // Actually, since we are in the App Router, we can't easily set the session directly without the token.
      
      const adminAuth = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      ).auth.admin;

      // Generate a magic link
      const { data: linkData, error: linkError } = await adminAuth.generateLink({
        type: 'magiclink',
        email: credentialData.profiles.email,
      })

      if (linkError || !linkData?.properties?.action_link) {
        throw new Error('Falha ao gerar sessão: ' + (linkError?.message || 'unknown'))
      }

      // We return the magic link URL to the frontend, and the frontend will just route to it!
      // The magic link has the format `.../auth/v1/verify?token=...&type=magiclink`
      // So the frontend can just redirect to this link, and Supabase will set the cookies and redirect to `/`.
      
      // Limpar cookie de challenge
      cookieStore.delete('webauthn_auth_challenge')

      return NextResponse.json({ verified: true, loginUrl: linkData.properties.action_link })
    }

    return NextResponse.json({ error: 'Falha na verificação da biometria' }, { status: 400 })

  } catch (error: any) {
    console.error('Authentication verify error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
