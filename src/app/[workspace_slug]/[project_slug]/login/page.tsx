import { createClient } from '@/utils/supabase/server'
import { LayoutTemplate, AlertCircle, ShieldAlert } from 'lucide-react'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { getLocale } from '@/i18n/get-locale'
import { getTranslations } from '@/i18n/get-translations'
import { LoginPortalThemeWrapper } from '@/components/auth/LoginPortalThemeWrapper'
import { TranslationProvider } from '@/i18n/TranslationProvider'

export default async function LoginPage({ params }: any) {
  const { workspace_slug, project_slug } = await params
  const locale = await getLocale()
  const t = await getTranslations(locale)
  
  const supabase = await createClient()

  // 1. Verificar se o projeto existe e está ativo
  const { data: project } = await supabase
    .from('projects')
    .select('*, workspaces!inner(*)')
    .eq('slug', project_slug)
    .eq('workspaces.slug', workspace_slug)
    .single()

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-100 dark:bg-[#050505] p-6">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-[2.5rem] p-12 text-center shadow-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">Projeto não encontrado</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Verifique a URL ou entre em contato com o administrador.</p>
        </div>
      </div>
    )
  }

  // 2. Buscar configurações de visual
  const { data: config } = await supabase
    .from('project_auth_config')
    .select('*')
    .eq('project_id', project.id)
    .single()

  const visual = config?.ui_config as any || {}
  const auth = config as any || {}
  const allowSignup = visual.allow_signup || false
  
  // 3. Verificar se o projeto está inativo
  if (!project.is_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-100 dark:bg-[#050505] p-6">
        <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-[2.5rem] p-12 text-center shadow-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
            <ShieldAlert className="w-10 h-10 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold mb-4 text-neutral-900 dark:text-white">{t('app.project_inactive')}</h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            {t('app.project_inactive_desc')}
          </p>
        </div>
      </div>
    )
  }

  const theme = visual.theme || 'dark'
  const title = visual.welcome_title || `Acessar ${project.name}`
  const subtitle = visual.welcome_desc || 'Insira suas credenciais para continuar.'
  const userLabel = visual.email_label || 'Usuário'
  const userPlaceholder = visual.email_placeholder || 'seu@email.com'
  const passLabel = visual.password_label || 'Senha'
  const passPlaceholder = visual.password_placeholder || '••••••••'
  const buttonText = visual.button_text || 'Entrar no Sistema'
  const buttonColor = visual.button_color || '#4F46E5'

  return (
    <TranslationProvider locale={locale}>
      <LoginPortalThemeWrapper theme={theme}>
        <div className="min-h-screen flex flex-col transition-colors duration-500 bg-neutral-50 dark:bg-[#050505]">
          <header className="p-6 flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors overflow-hidden bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                {visual.brand_icon || visual.icon_svg ? (
                  <div dangerouslySetInnerHTML={{ __html: visual.brand_icon || visual.icon_svg }} className="w-6 h-6" />
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
                  {visual.brand_icon || visual.icon_svg ? (
                    <div dangerouslySetInnerHTML={{ __html: visual.brand_icon || visual.icon_svg }} className="w-10 h-10 [&>svg]:w-full [&>svg]:h-full" />
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

              <form className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    {userLabel}
                  </label>
                  <input 
                    type="email" 
                    placeholder={userPlaceholder}
                    className="w-full h-12 px-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-sm font-medium"
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
                  <input 
                    type="password" 
                    placeholder={passPlaceholder}
                    className="w-full h-12 px-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-sm font-medium"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full h-14 rounded-2xl text-white text-xs font-bold uppercase tracking-widest transition-all hover:brightness-110 active:scale-[0.98] shadow-xl"
                  style={{ 
                    backgroundColor: buttonColor,
                    boxShadow: `0 10px 30px -10px ${buttonColor}66`
                  }}
                >
                  {buttonText}
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
