'use client'

import { login, signup, verifyMfaPolicy, signOut } from '@/app/auth/actions'
import { Mail, Lock, Layers, Eye, EyeOff, User, ArrowRight, CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthModal } from '@/components/auth/AuthModal'
import { SetPasswordForm } from '@/components/auth/SetPasswordForm'
import { useI18n } from '@/i18n/I18nContext'
import { startAuthentication } from '@simplewebauthn/browser'
import { isTauri, openExternalUrl } from '@/utils/tauriUtils'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'
interface LoginFormProps {
  error?: string
  className?: string
}

export function LoginForm({ error: serverError, className }: LoginFormProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clientError, setClientError] = useState<string | null>(serverError || null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false)
  const [showExpiredModal, setShowExpiredModal] = useState(false)
  const [expiredModalDesc, setExpiredModalDesc] = useState('')
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false)

  const emailInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleCloseModal = async () => {
    setShowSetPasswordModal(false)
    try {
      await signOut()
    } catch (err) {
      console.error('Erro ao deslogar no fechamento do modal:', err)
    } finally {
      if (typeof window !== 'undefined') {
        window.location.hash = ''
        window.location.search = ''
        window.location.href = '/'
      }
    }
  }

  const handleCloseExpiredModal = () => {
    setShowExpiredModal(false)
    if (typeof window !== 'undefined') {
      window.location.hash = ''
      window.location.search = ''
      window.location.href = '/'
    }
  }

  const handlePasskeyLogin = async () => {
    setClientError(null)
    setIsPasskeyLoading(true)
    try {
      // 1. Gera opções do servidor
      const resp = await fetch('/api/auth/passkeys/authenticate/generate-options', { method: 'POST' })
      if (!resp.ok) throw new Error('Falha ao inicializar biometria.')
      const options = await resp.json()

      // 2. Chama a biometria nativa do SO
      const asseResp = await startAuthentication(options)

      // 3. Envia o resultado para verificar
      const verificationResp = await fetch('/api/auth/passkeys/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(asseResp),
      })

      const verificationJSON = await verificationResp.json()

      if (verificationJSON.verified && verificationJSON.loginUrl) {
        setSuccessMessage('Biometria verificada! Entrando...')
        // Redireciona para o magic link gerado para consolidar a sessão
        window.location.href = verificationJSON.loginUrl
      } else {
        throw new Error(verificationJSON.error || 'Falha na verificação da biometria')
      }
    } catch (error: any) {
      console.error(error)
      if (error.name === 'NotAllowedError' || error.message?.includes('timed out or was not allowed')) {
        setClientError('Operação cancelada ou nenhuma biometria encontrada neste aparelho.')
      } else {
        setClientError(error.message || 'Erro ao processar login biométrico.')
      }
    } finally {
      setIsPasskeyLoading(false)
    }
  }

  // Listener para capturar o Magic Link / Convite na URL (Hash Fragment) ou sessão já existente
  useEffect(() => {
    const supabase = createClient()
    
    const navigateToDashboard = async (userId: string) => {
      let redirectTo = ''
      if (typeof window !== 'undefined') {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const searchParams = new URLSearchParams(window.location.search)
        const redirectParam = hashParams.get('redirect_to') || searchParams.get('redirect_to')
        if (redirectParam) {
          try {
            // Garante que pegamos só o pathname para navegação interna
            redirectTo = new URL(redirectParam).pathname
          } catch {
            redirectTo = redirectParam.startsWith('/') ? redirectParam : ''
          }
        }
      }
      if (!redirectTo) {
        try {
          const { getPostLoginRedirectPath } = await import('@/app/auth/actions')
          redirectTo = await getPostLoginRedirectPath(userId)
        } catch (err) {
          console.error('Error getting dynamic redirect path:', err)
          redirectTo = '/workspace'
        }
      }
      
      try {
        const mfaRes = await verifyMfaPolicy()
        if (mfaRes.mfaSetupRequired) {
          window.location.href = '/login/mfa/setup'
          return
        } else if (mfaRes.mfaChallengeRequired) {
          window.location.href = `/login/mfa?factorId=${mfaRes.factorId}`
          return
        }
      } catch (e) {
        console.error('MFA Policy check failed:', e)
      }

      // Usar window.location.href em vez de router.push garante um "hard reload"
      // Isso força o navegador a enviar os cookies (recém-criados pelo Supabase)
      // para o servidor. Se usarmos router.push, o Next.js pode fazer um soft-navigation
      // antes do cookie estar pronto, causando um redirect fantasma de volta pro /login.
      window.location.href = redirectTo
    }

    // Tauri: Escuta deep links (metabuilder://) para capturar o login
    if (isTauri()) {
      let unlisten: (() => void) | undefined;
      onOpenUrl((urls) => {
        try {
          const urlStr = urls[0];
          if (urlStr) {
            // Converte metabuilder://auth/callback?code=... para /auth/callback?code=...
            const validUrlString = urlStr.replace(/^metabuilder:\/\//, window.location.origin + '/');
            const urlObj = new URL(validUrlString);
            
            // Redireciona a janela atual da IDE para a rota de callback do Next.js
            window.location.href = urlObj.pathname + urlObj.search + urlObj.hash;
          }
        } catch (e) {
          console.error('Error handling deep link:', e);
        }
      }).then(fn => {
        unlisten = fn;
      }).catch(console.error);

      return () => {
        if (unlisten) unlisten();
      }
    }

    // Abre o modal imediatamente se detectar o hash de convite
    if (typeof window !== 'undefined') {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const searchParams = new URLSearchParams(window.location.search)
      
      const errorCode = hashParams.get('error_code') || searchParams.get('error_code')
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description') || searchParams.get('error')
      
      if (errorCode === 'otp_expired' || window.location.hash.includes('otp_expired') || window.location.search.includes('otp_expired')) {
        setExpiredModalDesc(errorDesc || t('auth.login.errors.otp_expired', 'O link de e-mail é inválido ou expirou.'))
        setShowExpiredModal(true)
      } else {
        const type = hashParams.get('type')
        if (type === 'invite' || type === 'recovery') {
          setShowSetPasswordModal(true)
        }
      }
    }

    // Verifica imediatamente se já tem sessão VÁLIDA (ex: refresh na página)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        let isInviteOrRecovery = false
        if (typeof window !== 'undefined') {
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const type = hashParams.get('type')
          if (type === 'invite' || type === 'recovery') {
            isInviteOrRecovery = true
          }
        }
        if (user.user_metadata?.need_password_setup === true) {
          isInviteOrRecovery = true
        }

        if (isInviteOrRecovery) {
          setShowSetPasswordModal(true)
        } else {
          navigateToDashboard(user.id)
        }
      }
    })

    // Se o Supabase falhar em ler o Hash automaticamente, nós forçamos:
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      const type = hashParams.get('type')
      
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (!error && data.session) {
            if (type === 'invite' || type === 'recovery' || data.session.user?.user_metadata?.need_password_setup === true) {
              setShowSetPasswordModal(true)
            } else {
              navigateToDashboard(data.session.user.id)
            }
          }
        })
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Tratamos apenas hash-based flows (Magic Link, convite, recuperação de senha).
      // NÃO navegamos no evento SIGNED_IN para OAuth na Web ou Tauri — o /auth/callback já cuida disso.
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION')) {
        const user = session.user
        if (user) {
          let isInviteOrRecovery = false
          if (typeof window !== 'undefined') {
            const hashParams = new URLSearchParams(window.location.hash.substring(1))
            const type = hashParams.get('type')
            if (type === 'invite' || type === 'recovery') {
              isInviteOrRecovery = true
            }
          }
          if (event === 'PASSWORD_RECOVERY' || user.user_metadata?.need_password_setup === true) {
            isInviteOrRecovery = true
          }

          if (isInviteOrRecovery) {
            setShowSetPasswordModal(true)
          }
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    if (serverError) {
      setClientError(serverError)
    }
  }, [serverError])

  // Listener para capturar os tokens vindos do popup de login do Google
  // Usa BroadcastChannel (principal) + postMessage (fallback)
  // O BroadcastChannel é necessário pois o COOP do Google pode cortar window.opener em produção
  useEffect(() => {
    const supabase = createClient();

    const processAuthSuccess = async (access_token: string, refresh_token: string, next: string) => {
      setIsLoading(true);
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (!error) {
        try {
          const mfaRes = await verifyMfaPolicy()
          if (mfaRes.mfaSetupRequired) {
            window.location.href = '/login/mfa/setup'
            return
          } else if (mfaRes.mfaChallengeRequired) {
            window.location.href = `/login/mfa?factorId=${mfaRes.factorId}`
            return
          }
        } catch (e) {
          console.error('MFA Policy check failed:', e)
        }

        let redirectTo = next
        if (!redirectTo || redirectTo === '/workspace') {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            try {
              const { getPostLoginRedirectPath } = await import('@/app/auth/actions')
              redirectTo = await getPostLoginRedirectPath(user.id)
            } catch (err) {
              console.error('Error in OAuth redirect:', err)
              redirectTo = '/workspace'
            }
          } else {
            redirectTo = '/workspace'
          }
        }
        window.location.href = redirectTo;
      } else {
        setClientError(t('auth.login.errors.auth_error', 'Erro ao processar autenticação.'));
        setIsLoading(false);
      }
    };

    // Canal principal: BroadcastChannel (não depende de window.opener)
    const bc = new BroadcastChannel('supabase_auth_channel');
    bc.onmessage = async (event) => {
      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        const { access_token, refresh_token, next } = event.data;
        await processAuthSuccess(access_token, refresh_token, next);
      }
    };

    // Canal secundário: postMessage clássico (para browsers sem BroadcastChannel)
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        const { access_token, refresh_token, next } = event.data;
        await processAuthSuccess(access_token, refresh_token, next);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      bc.close();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mode === 'login') emailInputRef.current?.focus()
      else nameInputRef.current?.focus()
    }, 400)
    return () => clearTimeout(timer)
  }, [mode])

  const passwordCriteria = useMemo(() => ({
    minChar: password.length >= 8,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }), [password])

  const strengthScore = useMemo(() => {
    return Object.values(passwordCriteria).filter(Boolean).length
  }, [passwordCriteria])

  const handleEmailAction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setClientError(null)
    setSuccessMessage(null)

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setClientError(t('auth.login.errors.passwords_dont_match', 'As senhas não coincidem.'))
        return
      }
      if (strengthScore < 3) {
        setClientError(t('auth.login.errors.password_too_weak', 'A senha é muito fraca.'))
        return
      }
    }

    setIsLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      if (mode === 'login') {
        const res = await login(formData)
        if (res && 'error' in res && res.error) {
          setClientError(res.error)
          setIsLoading(false)
        } else if (res && 'mfaSetupRequired' in res && res.mfaSetupRequired) {
          // O Owner exige MFA e o usuário não tem.
          window.location.href = '/login/mfa/setup'
        } else if (res && 'mfaChallengeRequired' in res && res.mfaChallengeRequired) {
          // O usuário tem MFA. Ir para desafio.
          window.location.href = `/login/mfa?factorId=${res.factorId}`
        } else {
          let redirectTo = ''
          if (typeof window !== 'undefined') {
            const hashParams = new URLSearchParams(window.location.hash.substring(1))
            const searchParams = new URLSearchParams(window.location.search)
            const redirectParam = hashParams.get('redirect_to') || searchParams.get('redirect_to')
            if (redirectParam) {
              try {
                redirectTo = new URL(redirectParam).pathname
              } catch {
                redirectTo = redirectParam.startsWith('/') ? redirectParam : ''
              }
            }
          }
          if (!redirectTo) {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              const { getPostLoginRedirectPath } = await import('@/app/auth/actions')
              redirectTo = await getPostLoginRedirectPath(user.id)
            } else {
              redirectTo = '/workspace'
            }
          }
          window.location.href = redirectTo
        }
      } else {
        const res = await signup(formData)
        if (res && 'error' in res && res.error) {
          setClientError(res.error)
          setIsLoading(false)
        } else {
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session) {
            let redirectTo = ''
            if (typeof window !== 'undefined') {
              const hashParams = new URLSearchParams(window.location.hash.substring(1))
              const searchParams = new URLSearchParams(window.location.search)
              const redirectParam = hashParams.get('redirect_to') || searchParams.get('redirect_to')
              if (redirectParam) {
                try {
                  redirectTo = new URL(redirectParam).pathname
                } catch {
                  redirectTo = redirectParam.startsWith('/') ? redirectParam : ''
                }
              }
            }
            if (!redirectTo) {
              const { getPostLoginRedirectPath } = await import('@/app/auth/actions')
              redirectTo = await getPostLoginRedirectPath(session.user.id)
            }
            window.location.href = redirectTo
          } else {
            setSuccessMessage(t('auth.login.success.signup_done', 'Cadastro realizado! Verifique seu e-mail para confirmar a conta.'))
            setIsLoading(false)
          }
        }
      }
    } catch (err: any) {
      if (err.message?.includes('NEXT_REDIRECT')) return
      setClientError(err.message || t('auth.login.errors.auth_error', 'Erro ao processar autenticação'))
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    setIsLoading(true)
    setClientError(null)

    // Tática anti-popup blocker: abrir a janela de forma síncrona, ANTES do await.
    let popup: Window | null = null;
    if (!isTauri() && typeof window !== 'undefined') {
      try {
        const width = 500
        const height = 650
        const left = window.screenX + (window.outerWidth - width) / 2
        const top = window.screenY + (window.outerHeight - height) / 2
        popup = window.open(
          '',
          'google-login',
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
        )
        if (popup) {
          popup.document.write('<div style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">Aguarde, conectando ao Google...</div>');
        }
      } catch (err) {
        console.warn('Erro ao preparar popup (bloqueado pelo navegador):', err);
      }
    }
    
    // Para Tauri: usa a mesma callbackUrl do browser (HTTPS), pois a WebView
    // navega internamente pelo fluxo OAuth sem precisar abrir browser externo.
    // Para browser: usa a callbackUrl normal com suporte ao redirect_to param.
    let callbackUrl = `${window.location.origin}/auth/callback`
    if (isTauri()) {
      // Mantém HTTPS — a WebView vai navegar para o Google e voltar para cá
      callbackUrl = 'https://metabuilderpro.com/auth/callback'
    } else if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const redirectParam = searchParams.get('redirect_to')
      if (redirectParam) {
        callbackUrl += `?next=${encodeURIComponent(redirectParam)}`
      }
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        }
      },
    })

    if (error) {
      if (popup) popup.close();
      setClientError(error.message)
      setIsLoading(false)
      return
    }

    if (data?.url) {
      if (isTauri()) {
        // Redirecionamento tela-cheia (In-App Browser). 
        // 100% estável e imune aos bloqueios de popup do Tauri.
        window.location.href = data.url;
      } else {
        if (popup) {
          popup.location.href = data.url
        } else {
          // Se o popup blocker foi MUITO agressivo e bloqueou até a chamada síncrona
          window.location.href = data.url
        }
      }
    }
  }

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      {/* Header Section with Animated Gradient Icon */}
      <div className="text-center mb-10">
        <div className="inline-flex relative group mb-8">
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
          <div className="relative p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xl group-hover:scale-110 transition-all duration-500">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Layers className="w-6 h-6 animate-pulse" />
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight mb-2">
          {mode === 'login' ? 'MetaBuilder' : t('auth.login.join_title', 'Junte-se ao')} <span className="text-indigo-600">PRO</span>
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium px-4">
          {mode === 'login'
            ? t('auth.login.subtitle', 'Acesse seu ecossistema de dados de alta performance')
            : t('auth.login.signup_subtitle', 'Comece a construir sua aplicação de nível empresarial hoje')}
        </p>
      </div>

      {clientError && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-500/80 font-bold leading-relaxed">
            {clientError}
          </p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-500/80 font-bold leading-relaxed">
            {successMessage}
          </p>
        </div>
      )}

      {/* Social Login - Premium Style */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full bg-neutral-100 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 hover:bg-white dark:hover:bg-neutral-800 text-neutral-900 dark:text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-sm mb-8 group"
      >
        <div className="p-1.5 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm group-hover:rotate-12 transition-transform">
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.3-4.74 3.3-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>
        {mode === 'login' ? t('auth.login.google_signin', 'Entrar com Google') : t('auth.login.google_signup', 'Cadastrar com Google')}
      </button>

      {/* Passkey Login - Premium Style */}
      {mode === 'login' && (
        <button
          type="button"
          onClick={handlePasskeyLogin}
          disabled={isPasskeyLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 mb-8 group disabled:opacity-70"
        >
          {isPasskeyLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <div className="p-1.5 bg-white/20 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10s10-4.48 10-10A10 10 0 0 0 12 2z"></path>
                <path d="M12 6a6 6 0 1 0 6 6"></path>
                <path d="M12 10a2 2 0 1 0 2 2"></path>
              </svg>
            </div>
          )}
          {isPasskeyLoading ? 'Verificando...' : 'Entrar com Biometria'}
        </button>
      )}

      <div className="relative flex items-center py-2 mb-8">
        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800/50"></div>
        <span className="flex-shrink mx-6 text-[10px] text-neutral-400 dark:text-neutral-600 font-black uppercase tracking-[0.2em]">{t('auth.login.or_use_email', 'ou use seu e-mail')}</span>
        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800/50"></div>
      </div>

      <form onSubmit={handleEmailAction} className="space-y-5">
        {mode === 'signup' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-2">{t('auth.login.display_name', 'Nome de Exibição')}</label>
            <div className="relative group">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
              <input
                name="display_name"
                type="text"
                required
                ref={nameInputRef}
                placeholder={t('auth.login.display_name_placeholder', 'Como quer ser chamado?')}
                className="w-full bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 rounded-2xl py-4 pl-14 pr-6 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all outline-none"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-2">{t('auth.login.email_label', 'E-mail Corporativo')}</label>
          <div className="relative group">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
            <input
              name="email"
              type="email"
              required
              ref={emailInputRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.login.email_placeholder', 'seu@trabalho.com')}
              className="w-full bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 rounded-2xl py-4 pl-14 pr-6 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-2">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">{t('auth.login.password_label', 'Senha de Acesso')}</label>
            {mode === 'login' && (
              <button type="button" className="text-[10px] font-black text-indigo-500 hover:text-indigo-400 transition-colors uppercase tracking-widest">{t('auth.login.forgot_password', 'Esqueceu?')}</button>
            )}
          </div>
          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 rounded-2xl py-4 pl-14 pr-14 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-indigo-500 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {mode === 'signup' && password.length > 0 && (
            <div className="space-y-3 mt-4 px-2">
              <div className="flex gap-1.5 h-1.5">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={cn(
                      "flex-1 rounded-full transition-all duration-700",
                      step <= strengthScore
                        ? (strengthScore <= 2 ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : strengthScore === 3 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]")
                        : "bg-neutral-200 dark:bg-neutral-800"
                    )}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <PasswordCheck label={t('auth.login.criteria.min_char', '8+ caracteres')} met={passwordCriteria.minChar} />
                <PasswordCheck label={t('auth.login.criteria.uppercase', 'Maiúscula')} met={passwordCriteria.upper} />
                <PasswordCheck label={t('auth.login.criteria.number', 'Número')} met={passwordCriteria.number} />
                <PasswordCheck label={t('auth.login.criteria.symbol', 'Símbolo')} met={passwordCriteria.symbol} />
              </div>
            </div>
          )}
        </div>

        {mode === 'signup' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-2">{t('auth.login.confirm_password', 'Confirmar Senha')}</label>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
              <input
                name="confirm_password"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.login.confirm_password_placeholder', 'Repita sua senha')}
                className={cn(
                  "w-full bg-neutral-100/50 dark:bg-neutral-900/50 border rounded-2xl py-4 pl-14 pr-6 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all outline-none",
                  confirmPassword && (password === confirmPassword ? "border-emerald-500/50 focus:border-emerald-500" : "border-red-500/50 focus:border-red-500"),
                  !confirmPassword && "border-neutral-200 dark:border-neutral-800 focus:border-indigo-500"
                )}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-8 shadow-[0_20px_50px_rgba(79,70,229,0.3)] group relative overflow-hidden"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
              <span className="relative z-10">{mode === 'login' ? t('auth.login.submit_btn', 'Acessar Plataforma') : t('auth.login.submit_signup_btn', 'Criar Conta PRO')}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
            </>
          )}
        </button>
      </form>

      <div className="mt-10 text-center">
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
          {mode === 'login' ? t('auth.login.new_here', 'Novo por aqui?') : t('auth.login.already_have_account', 'Já possui acesso?')}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setClientError(null)
              setSuccessMessage(null)
            }}
            className="ml-2 text-indigo-500 hover:text-indigo-400 transition-colors"
          >
            {mode === 'login' ? t('auth.login.create_account', 'Crie sua conta') : t('auth.login.do_login', 'Fazer Login')}
          </button>
        </p>
      </div>

      {/* AuthModal com SetPasswordForm */}
      <AuthModal isOpen={showSetPasswordModal} onClose={handleCloseModal} hideCloseButton={true}>
        <SetPasswordForm />
      </AuthModal>

      {/* Modal de Link Expirado */}
      <AuthModal isOpen={showExpiredModal} onClose={handleCloseExpiredModal} hideCloseButton={false}>
        <div className="space-y-6 text-center py-2">
          <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-500">
            <AlertCircle className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t('auth.login.expired_modal.title', 'Link Expirado ou Inválido')}</h3>
            <p className="text-xs text-neutral-550 dark:text-neutral-400 leading-relaxed">
              {t('auth.login.expired_modal.desc', 'Por motivos de segurança, os links de convite e redefinição de senha expiram em pouco tempo ou após o primeiro clique. Solicite um novo convite ou tente realizar o processo novamente.')}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCloseExpiredModal}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 text-xs font-black uppercase tracking-widest cursor-pointer"
          >
            {t('auth.login.expired_modal.back_home', 'Ir para a Página Inicial')}
          </button>
        </div>
      </AuthModal>
    </div>
  )
}

function PasswordCheck({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <CheckCircle2 className="w-3 h-3 text-green-500" />
      ) : (
        <Circle className="w-3 h-3 text-neutral-700" />
      )}
      <span className={cn("text-[10px] font-medium transition-colors", met ? "text-green-500/80" : "text-neutral-600")}>
        {label}
      </span>
    </div>
  )
}
