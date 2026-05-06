import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const isPopup = searchParams.get('popup') === 'true'
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      if (isPopup) {
        return new NextResponse(
          `<html>
            <body style="background: #000; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
              <div style="text-align: center;">
                <p style="margin-bottom: 10px;">Autenticação concluída!</p>
                <p style="font-size: 12px; color: #666;">Sincronizando plataforma...</p>
              </div>
              <script>
                if (window.opener) {
                  // Avisa a janela pai para ir para o destino final
                  window.opener.location.assign('${origin}${next}');
                  // Fecha esta janela
                  window.close();
                } else {
                  window.location.assign('${origin}${next}');
                }
              </script>
            </body>
          </html>`,
          { headers: { 'Content-Type': 'text/html' } }
        )
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Em caso de erro
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
