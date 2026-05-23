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
      const { access_token, refresh_token } = data.session
      
      // Retornamos sempre este HTML. Ele verifica no lado do cliente
      // se foi aberto como popup (window.opener). Se sim, avisa a janela pai
      // e fecha. Se não, faz o redirecionamento normal.
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
      <p style="margin:0;font-size:13px;color:#666;">Redirecionando...</p>
    </div>
    <script>
      try {
        const isPopup = window.opener && !window.opener.closed && window.opener !== window;
        
        if (isPopup) {
          window.opener.postMessage(
            {
              type: 'SUPABASE_AUTH_SUCCESS',
              access_token: '${access_token}',
              refresh_token: '${refresh_token}',
              next: '${next}'
            },
            window.opener.location.origin || '*'
          );
          setTimeout(() => { window.close(); }, 100);
        } else {
          window.location.assign('${origin}${next}');
        }
      } catch (e) {
        console.error('Callback error:', e);
        window.location.assign('${origin}${next}');
      }
    </script>
  </body>
</html>`
      
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      })
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
