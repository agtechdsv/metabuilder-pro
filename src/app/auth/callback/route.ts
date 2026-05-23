import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/workspace'
  const isPopup = searchParams.get('popup') === 'true'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      if (isPopup) {
        // Fluxo popup: enviamos os tokens para a janela pai via postMessage.
        // A janela pai chama setSession() — o que seta os cookies no contexto DELA —
        // e só então navega para /workspace. Isso evita a race condition de cookies.
        const { access_token, refresh_token } = data.session
        const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Autenticando...</title>
    <style>
      body {
        margin: 0;
        background: #0a0a0a;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
      }
      .loader {
        border: 3px solid rgba(255,255,255,0.1);
        border-radius: 50%;
        border-top: 3px solid #6366f1;
        width: 28px;
        height: 28px;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div style="text-align:center;">
      <div class="loader"></div>
      <p style="margin:0 0 6px;font-weight:600;">Autenticação concluída!</p>
      <p style="margin:0;font-size:13px;color:#666;">Fechando...</p>
    </div>
    <script>
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: 'SUPABASE_AUTH_SUCCESS',
              access_token: '${access_token}',
              refresh_token: '${refresh_token}',
              next: '${next}'
            },
            window.opener.location.origin
          );
        }
      } catch (e) {
        console.error('postMessage failed:', e);
      }
      window.close();
    </script>
  </body>
</html>`
        return new NextResponse(html, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Fluxo redirect normal (não-popup): redirect servidor-side simples
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
