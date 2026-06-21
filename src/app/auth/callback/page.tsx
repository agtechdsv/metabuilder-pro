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

      // Registrar indicação se aplicável
      if (session?.user?.email) {
        try {
          const { registerReferral } = await import('@/app/actions/iclub')
          await registerReferral(session.user.email, session.user.id)
        } catch (e) {
          console.error('Erro ao registrar indicação:', e)
        }
      }

      // 0. Determina o redirect_to dinâmico se a URL não forneceu um explícito
      let finalRedirect = next
      if (typeof window !== 'undefined') {
        const searchParams = new URLSearchParams(window.location.search)
        if (!searchParams.get('next') && session?.user?.id) {
          try {
            const { getPostLoginRedirectPath } = await import('@/app/auth/actions')
            finalRedirect = await getPostLoginRedirectPath(session.user.id)
          } catch (e) {
            console.error('Erro ao determinar redirecionamento dinâmico:', e)
          }
        }
      }

      const payload = { 
        type: 'SUPABASE_AUTH_SUCCESS', 
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        next: finalRedirect 
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
        setStatus('success')
        // Força o fechamento do popup
        setTimeout(() => {
          try {
            window.close()
          } catch (_) {}
        }, 500)
      } else {
        // Se não for popup, precisamos verificar o MFA antes do redirect
        try {
          const { verifyMfaPolicy } = await import('@/app/auth/actions')
          const mfaRes = await verifyMfaPolicy()
          if (mfaRes.mfaSetupRequired) {
            window.location.replace('/login/mfa/setup')
            return
          } else if (mfaRes.mfaChallengeRequired) {
            window.location.replace(`/login/mfa?factorId=${mfaRes.factorId}`)
            return
          }
        } catch (e) {
          console.error('MFA Policy check failed in callback:', e)
        }

        // Se passou pela verificação, continua o redirecionamento
        setStatus('redirecting' as any) // Gambiarra segura pro tipo local
        window.location.replace(finalRedirect)
      }
    }

    // Extrai tokens manualmente do hash caso o Supabase não tenha feito o parse automático (comum em navegações client-side)
    const hash = window.location.hash
    if (hash && hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(hash.substring(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      
      if (access_token && refresh_token) {
        // Limpa o hash da URL por segurança
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (error) {
            setErrorMessage(error.message)
            setStatus('error')
          } else if (data.session) {
            notifyAndClose(data.session)
          }
        })
        return
      }
    }

    // Ouve o evento de SIGNED_IN que acontece após a troca do code (PKCE) no client side ou parse automático
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
    <div className="min-h-screen bg-neutral-50 dark:bg-[#050505] text-neutral-900 dark:text-white flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 p-8 rounded-3xl shadow-2xl">
        {status === 'loading' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-500 animate-spin mb-6" />
            <h2 className="text-xl font-bold mb-2 text-neutral-900 dark:text-white">{t('auth.callback.authenticating', 'Autenticando...')}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('auth.callback.connecting_securely', 'Conectando de forma segura à sua conta.')}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-neutral-900 dark:text-white">{t('auth.callback.success', 'Sucesso!')}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">{t('auth.callback.success_desc', 'Você já pode fechar esta janela caso ela não feche automaticamente.')}</p>
            <button 
              onClick={() => window.close()}
              className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl text-sm font-bold transition-colors"
            >
              {t('auth.callback.close_window', 'Fechar Janela')}
            </button>
          </div>
        )}

        {status === ('redirecting' as any) && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-500 animate-spin mb-6" />
            <h2 className="text-xl font-bold mb-2 text-neutral-900 dark:text-white">Redirecionando...</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">Preparando seu ambiente de trabalho.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-neutral-900 dark:text-white">{t('auth.callback.auth_error_title', 'Erro na Autenticação')}</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6">{errorMessage || t('auth.callback.auth_error_desc', 'Não foi possível concluir o login.')}</p>
            <button 
              onClick={() => window.close()}
              className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-white rounded-xl text-sm font-bold transition-colors"
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
