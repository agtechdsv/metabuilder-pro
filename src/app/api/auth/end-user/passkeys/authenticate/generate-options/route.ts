import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const host = request.headers.get('host') || 'localhost'
    const rpID = host.split(':')[0]

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      // Discoverable Credentials enable passkey login without typing email
    })

    const cookieStore = await cookies()
    cookieStore.set('enduser_webauthn_auth_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300 // 5 minutos
    })

    return NextResponse.json(options)
  } catch (error: any) {
    console.error('Auth options error (end-user):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
