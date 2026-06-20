import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', user.id).single()

    // Para evitar conflito de origem no Next.js (dev localhost vs prod)
    const host = request.headers.get('host') || 'localhost'
    const rpName = 'MetaBuilderPRO'
    const rpID = host.split(':')[0] // strip port

    // Pega as chaves já existentes do usuário para evitar registrar o mesmo aparelho duas vezes
    const { data: credentials } = await supabase
      .from('passkey_credentials')
      .select('credential_id')
      .eq('user_id', user.id)

    const excludeCredentials = (credentials || []).map(cred => ({
      id: cred.credential_id, // string base64url
      type: 'public-key' as const,
    }))

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user.id, 'utf-8'),
      userName: profile?.email || user.email || user.id,
      userDisplayName: profile?.full_name || 'Usuário MetaBuilder',
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    })

    const cookieStore = await cookies()
    cookieStore.set('webauthn_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300 // 5 minutos
    })

    return NextResponse.json(options)
  } catch (error: any) {
    console.error('Registration options error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
