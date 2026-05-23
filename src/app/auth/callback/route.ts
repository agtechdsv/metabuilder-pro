import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/workspace'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Redirect simples servidor-side — os cookies de sessão são definidos
      // nos headers desta resposta, garantindo que a próxima requisição
      // para /workspace já os encontre prontos.
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Em caso de erro
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
