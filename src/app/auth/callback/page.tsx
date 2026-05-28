'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

function CallbackHandler() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/workspace'

  useEffect(() => {
    const supabase = createClient()
    let done = false

    const notifyAndClose = async (session: any) => {
      if (done) return
      done = true

      // Registrar indicação se aplicável
      if (session?.user?.email) {
        try {
          const { registerReferral } = await import('@/app/actions/iclub')
          await registerReferral(session.user.email, session.user.id)
        } catch (e) {
          console.error('Erro ao registrar indicação:', e)
        }
      }

      // Canal principal: BroadcastChannel (funciona mesmo sem window.opener)
      try {
        const bc = new BroadcastChannel('supabase_auth_channel')
        bc.postMessage({ type: 'SUPABASE_AUTH_SUCCESS', next })
        bc.close()
      } catch (_) {}

      // Fallback: postMessage direto ao opener
      if (typeof window !== 'undefined' && window.opener && !window.opener.closed && window.opener !== window) {
        try {
          window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS', next }, window.location.origin)
        } catch (_) {}
      }

      // Fecha o popup após garantir entrega da mensagem
      setTimeout(() => {
        try {
          window.close()
        } catch (_) {
          // Se não conseguir fechar (não é popup), redireciona
          window.location.href = next
        }
      }, 400)
    }

    const handleError = () => {
      if (done) return
      done = true
      window.location.href = '/login?error=Could not authenticate user'
    }

    // O createBrowserClient com detectSessionInUrl=true já troca o code automaticamente.
    // Basta esperar o evento SIGNED_IN.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        notifyAndClose(session)
      }
    })

    // Verifica se a sessão já está disponível (race condition: detectSessionInUrl mais rápido que o listener)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe()
        clearTimeout(timeout)
        notifyAndClose(session)
      }
    })

    // Timeout de segurança: se em 12s não tiver sessão, redireciona para o erro
    const timeout = setTimeout(() => {
      subscription.unsubscribe()
      handleError()
    }, 12000)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [next])

  return (
    <html>
      <head>
        <title>Autenticando...</title>
        <style>{`
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
        `}</style>
      </head>
      <body>
        <div>
          <div className="loader" />
          <p className="title">Autenticação concluída!</p>
          <p className="subtitle">Redirecionando...</p>
        </div>
      </body>
    </html>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <html>
          <body style={{ background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <p>Autenticando...</p>
          </body>
        </html>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
