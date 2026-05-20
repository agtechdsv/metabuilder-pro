'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { LayoutTemplate, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { LoginPortalThemeWrapper } from '@/components/auth/LoginPortalThemeWrapper'
import { TranslationProvider } from '@/i18n/TranslationProvider'
import { useI18n } from '@/i18n/I18nContext'

interface LoginPortalClientProps {
  project: any
  authConfig: any
  visualConfig: any
  locale: string
  workspaceSlug: string
  projectSlug: string
}

export function LoginPortalClient({
  project,
  authConfig,
  visualConfig,
  locale,
  workspaceSlug,
  projectSlug
}: LoginPortalClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { t } = useI18n()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Pre-load theme styles
  const theme = visualConfig.theme || 'dark'
  const title = visualConfig.welcome_title || `Acessar ${project.name}`
  const subtitle = visualConfig.welcome_desc || 'Insira suas credenciais para continuar.'
  const userLabel = visualConfig.email_label || 'Usuário'
  const userPlaceholder = visualConfig.email_placeholder || 'seu@email.com'
  const passLabel = visualConfig.password_label || 'Senha'
  const passPlaceholder = visualConfig.password_placeholder || '••••••••'
  const buttonText = visualConfig.button_text || 'Entrar no Sistema'
  const buttonColor = visualConfig.button_color || '#4F46E5'
  const allowSignup = visualConfig.allow_signup || false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    setErrorMsg(null)

    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    let timeoutId: any
    let isFinished = false

    const cleanup = () => {
      isFinished = true
      clearTimeout(timeoutId)
      supabase.removeChannel(channel)
    }

    try {
      // 1. Escuta o resultado do login no canal
      channel.on('broadcast', { event: `query_result_${queryId}` }, (payload: any) => {
        if (isFinished) return
        cleanup()

        const { success, data, error } = payload.payload
        if (success && data && data.length > 0) {
          const user = data[0]
          // Salva o cookie de sessão para o projeto
          const cookieName = `client_session_${project.id}`
          document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=86400; SameSite=Lax`
          
          // Redireciona para o portal principal
          window.location.href = `/${workspaceSlug}/${projectSlug}`
        } else {
          setErrorMsg(error || 'Credenciais inválidas.')
          setIsLoading(false)
        }
      })

      // 2. Inscreve-se e envia o comando de autenticação
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Envia a solicitação de login
          await channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload: {
              queryId,
              token: project.secret_token,
              action: 'validate_login',
              config: {
                db_table_name: authConfig.db_table_name,
                db_email_column: authConfig.db_email_column,
                db_password_column: authConfig.db_password_column,
                db_password_hash_type: authConfig.db_password_hash_type
              },
              credentials: {
                email,
                password
              }
            }
          })
        }
      })

      // 3. Define timeout para evitar espera infinita (ex: se o CLI estiver offline)
      timeoutId = setTimeout(() => {
        if (!isFinished) {
          cleanup()
          setErrorMsg('O túnel seguro com o banco local está offline. Por favor, inicie o CLI do MetaBuilder PRO.')
          setIsLoading(false)
        }
      }, 9000)

    } catch (err: any) {
      cleanup()
      setErrorMsg(err.message || 'Erro inesperado ao realizar autenticação.')
      setIsLoading(false)
    }
  }

  return (
    <TranslationProvider locale={locale}>
      <LoginPortalThemeWrapper theme={theme}>
        <div className="min-h-screen flex flex-col transition-colors duration-500 bg-neutral-50 dark:bg-[#050505]">
          <header className="p-6 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors overflow-hidden bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                {visualConfig.brand_icon || visualConfig.icon_svg ? (
                  <div dangerouslySetInnerHTML={{ __html: visualConfig.brand_icon || visualConfig.icon_svg }} className="w-6 h-6 flex items-center justify-center" />
                ) : (
                  <LayoutTemplate className="w-6 h-6 text-neutral-400 dark:text-neutral-500" />
                )}
              </div>
              <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                {project.name}
              </span>
            </div>

            <HeaderActions hideUser hideTheme={theme !== 'auto'} />
          </header>

          <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
            {/* Background effects - Visible only in dark mode via CSS */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 dark:opacity-100 transition-opacity duration-1000">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-sm rounded-[2.5rem] p-10 md:p-12 shadow-2xl transition-all duration-500 border relative z-10 bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800">
              {/* Icon inside the card */}
              <div className="mb-8 flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-500/10 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  {visualConfig.brand_icon || visualConfig.icon_svg ? (
                    <div dangerouslySetInnerHTML={{ __html: visualConfig.brand_icon || visualConfig.icon_svg }} className="w-10 h-10 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" />
                  ) : (
                    <LayoutTemplate className="w-8 h-8" />
                  )}
                </div>
              </div>

              <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold mb-3 tracking-tight transition-colors text-neutral-900 dark:text-white">
                  {title}
                </h2>
                <p className="text-sm leading-relaxed transition-colors text-neutral-600 dark:text-neutral-500">
                  {subtitle}
                </p>
              </div>

              {errorMsg && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-500/80 font-bold leading-relaxed">
                    {errorMsg}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    {userLabel}
                  </label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={userPlaceholder}
                    className="w-full h-12 px-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-sm font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      {passLabel}
                    </label>
                    <a href="#" className="text-[9px] font-bold text-indigo-600 hover:text-indigo-500 uppercase tracking-tighter">
                      Esqueceu a senha?
                    </a>
                  </div>
                  <div className="relative group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={passPlaceholder}
                      className="w-full h-12 pl-5 pr-12 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-sm font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-indigo-500 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 rounded-2xl text-white text-xs font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-[0.98] shadow-xl flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: buttonColor,
                    boxShadow: `0 10px 30px -10px ${buttonColor}66`
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    buttonText
                  )}
                </button>
              </form>

              {allowSignup && (
                <div className="mt-8 text-center">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    Não tem uma conta? <a href="#" className="text-indigo-600 hover:underline">Criar conta</a>
                  </p>
                </div>
              )}

              <div className="mt-10 flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-px bg-neutral-100 dark:bg-neutral-800" />
                  <span className="text-[9px] font-black text-neutral-300 dark:text-neutral-700 uppercase tracking-widest">
                    Powered by MetaBuilder
                  </span>
                  <div className="w-8 h-px bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            </div>
          </main>

          <footer className="p-8 text-center">
            <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-600">
              © 2026 AGTech Innovation Lab. All rights reserved.
            </p>
          </footer>
        </div>
      </LoginPortalThemeWrapper>
    </TranslationProvider>
  )
}
