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
      return new NextResponse(
        `<html>
          <head>
            <title>Autenticação - MetaBuilderPRO</title>
            <style>
              body {
                background: #0a0a0a;
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              }
              .loader {
                border: 3px solid rgba(255,255,255,0.1);
                border-radius: 50%;
                border-top: 3px solid #6366f1;
                width: 24px;
                height: 24px;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div style="text-align: center;">
              <div class="loader"></div>
              <p style="margin: 0 0 8px; font-weight: 600; font-size: 15px;">Autenticação concluída!</p>
              <p style="margin: 0; font-size: 13px; color: #a3a3a3;">Sincronizando plataforma...</p>
            </div>
            <script>
              const isPopup = (window.opener && window.opener !== window) || window.name === 'google-login';
              
              if (isPopup) {
                // Aguarda 200ms para garantir que o navegador salvou os cookies na máquina do usuário.
                // Isso evita o "redirecionamento fantasma" da janela pai de volta para o /login.
                setTimeout(() => {
                  try {
                    if (window.opener && !window.opener.closed) {
                      window.opener.location.assign('${origin}${next}');
                    }
                  } catch (e) {
                    console.error('Erro ao redirecionar janela pai:', e);
                  }
                  try {
                    window.close();
                  } catch (e) {
                    console.error('Erro ao fechar popup:', e);
                    window.location.assign('${origin}${next}');
                  }
                }, 200);
              } else {
                window.location.assign('${origin}${next}');
              }
            </script>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      )
    }
  }

  // Em caso de erro
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
