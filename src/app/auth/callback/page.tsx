'use client'

import { useEffect, Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

function CallbackHandler() {
  const { t } = useI18n()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/workspace'
  const errorDesc = searchParams.get('error_description') || searchParams.get('error')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(errorDesc)

  useEffect(() => {
    if (errorDesc) {
      setStatus('error')
      return
    }

    const supabase = createClient()
    let done = false

    const notifyAndClose = async (session: any) => {
      if (done) return
      done = true
      setStatus('success')

      // Registrar indicação se aplicável
      if (session?.user?.email) {
        try {
          const { registerReferral } = await import('@/app/actions/iclub')
          await registerReferral(session.user.email, session.user.id)
        } catch (e) {
          console.error('Erro ao registrar indicação:', e)
        }
      }

      const payload = { 
        type: 'SUPABASE_AUTH_SUCCESS', 
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        next 
      }

      // 1. Envia via BroadcastChannel
      try {
        const bc = new BroadcastChannel('supabase_auth_channel')
        bc.postMessage(payload)
        bc.close()
      } catch (_) {}

      // 2. Envia via window.opener
      let isPopup = false
      if (typeof window !== 'undefined' && window.opener && !window.opener.closed && window.opener !== window) {
        isPopup = true
        try {
          window.opener.postMessage(payload, window.location.origin)
        } catch (_) {}
      }

      if (isPopup) {
        // Força o fechamento do popup
        setTimeout(() => {
          try {
            window.close()
          } catch (_) {}
        }, 500)
      } else {
        // Se não for popup, simplesmente redireciona
        window.location.replace(next)
      }
    }

    // Ouve o evento de SIGNED_IN que acontece após a troca do code (PKCE) no client side
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        notifyAndClose(session)
      }
    })

    // Caso a sessão já tenha sido trocada antes do listener ativar
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        setErrorMessage(error.message)
        setStatus('error')
      } else if (session) {
        notifyAndClose(session)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [errorDesc, next])

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md w-full bg-neutral-900/50 border border-neutral-800 p-8 rounded-3xl shadow-2xl">
        {status === 'loading' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
            <h2 className="text-xl font-bold mb-2">{t('auth.callback.authenticating', 'Autenticando...')}</h2>
            <p className="text-neutral-400 text-sm">{t('auth.callback.connecting_securely', 'Conectando de forma segura à sua conta.')}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">{t('auth.callback.success', 'Sucesso!')}</h2>
            <p className="text-neutral-400 text-sm mb-6">{t('auth.callback.success_desc', 'Você já pode fechar esta janela caso ela não feche automaticamente.')}</p>
            <button 
              onClick={() => window.close()}
              className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm font-bold transition-colors"
            >
              {t('auth.callback.close_window', 'Fechar Janela')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">{t('auth.callback.auth_error_title', 'Erro na Autenticação')}</h2>
            <p className="text-neutral-400 text-sm mb-6">{errorMessage || t('auth.callback.auth_error_desc', 'Não foi possível concluir o login.')}</p>
            <button 
              onClick={() => window.close()}
              className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-sm font-bold transition-colors"
            >
              {t('auth.callback.close_try_again', 'Fechar e Tentar Novamente')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  )
}
