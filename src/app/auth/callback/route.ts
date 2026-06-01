import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { registerReferral } from '@/app/actions/iclub'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/workspace'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      // Registrar indicação se aplicável (assíncrono em background ou awaited)
      if (data.session.user?.email) {
        try {
          await registerReferral(data.session.user.email, data.session.user.id)
        } catch (e) {
          console.error('Erro ao registrar indicação:', e)
        }
      }

      // Retorna uma página HTML que notifica o popup a se fechar
      // e avisa a janela pai que a autenticação ocorreu com sucesso
      const htmlResponse = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Autenticando...</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: #0a0a0a;
              color: #fff;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              text-align: center;
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
            .title { font-weight: 600; margin-bottom: 6px; }
            .subtitle { font-size: 13px; color: #666; }
          </style>
        </head>
        <body>
          <div>
            <div class="loader"></div>
            <p class="title">Autenticação concluída!</p>
            <p class="subtitle">Redirecionando...</p>
          </div>
          <script>
            try {
              const bc = new BroadcastChannel('supabase_auth_channel');
              bc.postMessage({ 
                type: 'SUPABASE_AUTH_SUCCESS', 
                access_token: '${data.session.access_token}',
                refresh_token: '${data.session.refresh_token}',
                next: '${next}' 
              });
              bc.close();
            } catch (e) {}

            if (window.opener && !window.opener.closed && window.opener !== window) {
              try {
                window.opener.postMessage({ 
                  type: 'SUPABASE_AUTH_SUCCESS', 
                  access_token: '${data.session.access_token}',
                  refresh_token: '${data.session.refresh_token}',
                  next: '${next}' 
                }, window.location.origin);
              } catch (e) {}
            }

            // Fecha o popup
            setTimeout(() => {
              try {
                window.close();
              } catch (e) {
                window.location.href = '${next}';
              }
            }, 400);
          </script>
        </body>
        </html>
      `
      return new NextResponse(htmlResponse, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }
  }

  // Falha na autenticação ou não enviou o código
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
