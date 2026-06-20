import { NextResponse } from 'next/server'
import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const host = request.headers.get('host') || 'localhost'
    const rpID = host.split(':')[0]

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      // Não passamos allowCredentials para permitir Discoverable Credentials (usuário escolhe a conta no popup do SO)
    })

    // Salvar challenge em um cookie HTTPOnly já que o usuário ainda não está logado
    const { cookies } = require('next/headers')
    const cookieStore = await cookies()
    cookieStore.set('webauthn_auth_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300 // 5 minutos
    })

    return NextResponse.json(options)
  } catch (error: any) {
    console.error('Authentication options error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
