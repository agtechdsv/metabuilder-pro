'use client'

import { login, signup } from '@/app/auth/actions'
import { Mail, Lock, Layers, Eye, EyeOff, User, ArrowRight, CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface LoginFormProps {
  error?: string
  className?: string
}

export function LoginForm({ error: serverError, className }: LoginFormProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clientError, setClientError] = useState<string | null>(null)

  const emailInputRef = useRef<HTMLInputElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Listener para capturar o Magic Link / Convite na URL (Hash Fragment) ou sessão já existente
  useEffect(() => {
    const supabase = createClient()
    
    const navigateToDashboard = () => {
      let redirectTo = '/workspace'
      if (typeof window !== 'undefined') {
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const searchParams = new URLSearchParams(window.location.search)
        const redirectParam = hashParams.get('redirect_to') || searchParams.get('redirect_to')
        if (redirectParam) {
          try {
            // Garante que pegamos só o pathname para navegação interna
            redirectTo = new URL(redirectParam).pathname
          } catch {
            redirectTo = redirectParam.startsWith('/') ? redirectParam : '/workspace'
          }
        }
      }
      // Usar window.location.href em vez de router.push garante um "hard reload"
      // Isso força o navegador a enviar os cookies (recém-criados pelo Supabase)
      // para o servidor. Se usarmos router.push, o Next.js pode fazer um soft-navigation
      // antes do cookie estar pronto, causando um redirect fantasma de volta pro /login.
      window.location.href = redirectTo
    }

    // Verifica imediatamente se já tem sessão (ex: refresh na página)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigateToDashboard()
      }
    })

    // Se o Supabase falhar em ler o Hash automaticamente, nós forçamos:
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (!error && data.session) {
            navigateToDashboard()
          }
        })
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Usamos apenas "if (session)" porque links de convite ou magic links podem
      // disparar eventos como 'PASSWORD_RECOVERY' ou apenas 'INITIAL_SESSION'.
      if (session) {
        navigateToDashboard()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

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

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setClientError('As senhas não coincidem.')
        return
      }
      if (strengthScore < 3) {
        setClientError('A senha é muito fraca.')
        return
      }
    }

    setIsLoading(true)
    const formData = new FormData(e.currentTarget)

    try {
      if (mode === 'login') {
        await login(formData)
      } else {
        await signup(formData)
      }
      // O redirect acontece via Server Action. 
      // Se der o erro "unexpected response", o Next.js costuma redirecionar mesmo assim.
    } catch (err: any) {
      if (err.message?.includes('NEXT_REDIRECT')) return
      setClientError(err.message || 'Erro ao processar autenticação')
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?popup=true`,
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        }
      },
    })

    if (error) {
      setClientError(error.message)
      return
    }

    if (data?.url) {
      const width = 500
      const height = 650
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      window.open(
        data.url,
        'google-login',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
      )
    }
  }

  return (
    <div className={cn("w-full max-w-sm mx-auto", className)}>
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
          {mode === 'login' ? 'MetaBuilder' : 'Junte-se ao'} <span className="text-indigo-600">PRO</span>
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium px-4">
          {mode === 'login'
            ? 'Acesse seu ecossistema de dados de alta performance'
            : 'Comece a construir sua aplicação de nível empresarial hoje'}
        </p>
      </div>

      {(clientError || serverError) && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-500/80 font-bold leading-relaxed">
            {clientError || serverError}
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
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>
        {mode === 'login' ? 'Entrar com Google' : 'Cadastrar com Google'}
      </button>

      <div className="relative flex items-center py-2 mb-8">
        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800/50"></div>
        <span className="flex-shrink mx-6 text-[10px] text-neutral-400 dark:text-neutral-600 font-black uppercase tracking-[0.2em]">ou use seu e-mail</span>
        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800/50"></div>
      </div>

      <form onSubmit={handleEmailAction} className="space-y-5">
        {mode === 'signup' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-2">Nome de Exibição</label>
            <div className="relative group">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
              <input
                name="display_name"
                type="text"
                required
                ref={nameInputRef}
                placeholder="Como quer ser chamado?"
                className="w-full bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 rounded-2xl py-4 pl-14 pr-6 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all outline-none"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-2">E-mail Corporativo</label>
          <div className="relative group">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
            <input
              name="email"
              type="email"
              required
              ref={emailInputRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@trabalho.com"
              className="w-full bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500 focus:bg-white dark:focus:bg-neutral-900 rounded-2xl py-4 pl-14 pr-6 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 transition-all outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-2">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Senha de Acesso</label>
            {mode === 'login' && (
              <button type="button" className="text-[10px] font-black text-indigo-500 hover:text-indigo-400 transition-colors uppercase tracking-widest">Esqueceu?</button>
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
                <PasswordCheck label="8+ caracteres" met={passwordCriteria.minChar} />
                <PasswordCheck label="Maiúscula" met={passwordCriteria.upper} />
                <PasswordCheck label="Número" met={passwordCriteria.number} />
                <PasswordCheck label="Símbolo" met={passwordCriteria.symbol} />
              </div>
            </div>
          )}
        </div>

        {mode === 'signup' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-2">Confirmar Senha</label>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-indigo-500 transition-colors" />
              <input
                name="confirm_password"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita sua senha"
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
              <span className="relative z-10">{mode === 'login' ? 'Acessar Plataforma' : 'Criar Conta PRO'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
            </>
          )}
        </button>
      </form>

      <div className="mt-10 text-center">
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
          {mode === 'login' ? 'Novo por aqui?' : 'Já possui acesso?'}
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setClientError(null)
            }}
            className="ml-2 text-indigo-500 hover:text-indigo-400 transition-colors"
          >
            {mode === 'login' ? 'Crie sua conta' : 'Fazer Login'}
          </button>
        </p>
      </div>
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
