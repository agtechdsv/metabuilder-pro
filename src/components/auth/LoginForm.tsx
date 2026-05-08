'use client'

import { login, signup } from '@/app/auth/actions'
import { Mail, Lock, Layers, Eye, EyeOff, User, ArrowRight, CheckCircle2, Circle, AlertCircle, Loader2 } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/utils/supabase/client'

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
    <div className={cn("space-y-6 w-full max-w-sm mx-auto", className)}>
      {/* Header Section */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <Layers className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
          {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">
          {mode === 'login' 
            ? 'Acesse seu ecossistema metadata PRO' 
            : 'Comece a construir sua aplicação hoje'}
        </p>
      </div>

      {(clientError || serverError) && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 font-medium leading-relaxed">
            {clientError || serverError}
          </p>
        </div>
      )}

      {/* Social Login */}
      <button 
        type="button"
        onClick={handleGoogleLogin}
        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {mode === 'login' ? 'Entrar com Google' : 'Cadastrar com Google'}
      </button>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800/50"></div>
        <span className="flex-shrink mx-4 text-[10px] text-neutral-400 dark:text-neutral-600 font-black uppercase tracking-widest">OU USE E-MAIL</span>
        <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800/50"></div>
      </div>

      <form onSubmit={handleEmailAction} className="space-y-4">
        {mode === 'signup' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-1">Nome de Exibição</label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                name="display_name"
                type="text"
                required
                ref={nameInputRef}
                placeholder="Seu nome ou apelido"
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 transition-all outline-none"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-1">E-mail</label>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              name="email"
              type="email"
              required
              ref={emailInputRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 transition-all outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Senha</label>
            {mode === 'login' && (
              <button type="button" className="text-[10px] font-bold text-blue-500 hover:text-blue-400 transition-colors uppercase tracking-wider">Esqueceu?</button>
            )}
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl py-3 pl-12 pr-12 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 transition-all outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          {mode === 'signup' && password.length > 0 && (
            <div className="space-y-2 mt-3 px-1">
              <div className="flex gap-1 h-1">
                {[1, 2, 3, 4].map((step) => (
                  <div 
                    key={step}
                    className={cn(
                      "flex-1 rounded-full transition-all duration-500",
                      step <= strengthScore 
                        ? (strengthScore <= 2 ? "bg-red-500" : strengthScore === 3 ? "bg-yellow-500" : "bg-green-500")
                        : "bg-neutral-200 dark:bg-neutral-800"
                    )}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
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
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest px-1">Confirmar Senha</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                name="confirm_password"
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(
                  "w-full bg-neutral-50 dark:bg-neutral-900 border rounded-xl py-3 pl-12 pr-4 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-600 transition-all outline-none",
                  confirmPassword && (password === confirmPassword ? "border-green-500/50 focus:border-green-500" : "border-red-500/50 focus:border-red-500"),
                  !confirmPassword && "border-neutral-200 dark:border-neutral-800 focus:border-blue-500/50"
                )}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-6 shadow-xl shadow-blue-600/20"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {mode === 'login' ? 'ACESSAR PLATAFORMA' : 'CRIAR MINHA CONTA'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-neutral-500">
        {mode === 'login' ? 'Não tem conta?' : 'Já tem uma conta?'}
        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setClientError(null)
          }}
          className="ml-2 text-blue-500 font-bold hover:text-blue-400 transition-colors"
        >
          {mode === 'login' ? 'Cadastre-se' : 'Faça login'}
        </button>
      </p>
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
