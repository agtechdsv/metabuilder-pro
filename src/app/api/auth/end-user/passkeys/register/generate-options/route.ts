import { NextResponse } from 'next/server'
import { generateRegistrationOptions } from '@simplewebauthn/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { projectId, externalUserId, userEmail } = await request.json()

    if (!projectId || !externalUserId) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes' }, { status: 400 })
    }

    const host = request.headers.get('host') || 'localhost'
    const rpID = host.split(':')[0]
    
    // Configurações do app
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single()
    const rpName = project?.name || 'MetaBuilder App'
    const accountName = userEmail || externalUserId

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(externalUserId, 'utf8'), // O SimpleWebAuthn precisa de um ID do usuário. Usamos o ID externo.
      userName: accountName,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required', // Necessário para Discoverable Credentials (login sem digitar email)
        userVerification: 'preferred',
      },
    })

    const cookieStore = await cookies()
    cookieStore.set('enduser_webauthn_register_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300
    })

    return NextResponse.json(options)
  } catch (error: any) {
    console.error('Registration options error (end-user):', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
