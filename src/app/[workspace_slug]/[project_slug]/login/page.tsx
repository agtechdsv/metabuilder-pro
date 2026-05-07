import { createClient } from '@/utils/supabase/server'
import { LayoutTemplate, AlertCircle, ShieldAlert } from 'lucide-react'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { getLocale } from '@/i18n/get-locale'
import { getTranslations } from '@/i18n/get-translations'
import { LoginPortalThemeWrapper } from '@/components/auth/LoginPortalThemeWrapper'

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

  const ui = config?.ui_config as any || {}
  
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

  const theme = ui.theme || 'dark'
  const title = ui.title || `Acessar ${project.name}`
  const subtitle = ui.subtitle || 'Insira suas credenciais para continuar.'
  const userLabel = ui.usertitle || 'Usuário'
  const userPlaceholder = ui.userplaceholder || 'seu@email.com'
  const passLabel = ui.passtitle || 'Senha'
  const passPlaceholder = ui.passplaceholder || '••••••••'
  const buttonText = ui.button_text || 'Entrar no Sistema'
  const buttonColor = ui.button_color || '#4F46E5'
  const isDark = theme === 'dark'

  return (
    <LoginPortalThemeWrapper theme={theme as 'light' | 'dark'}>
      <div className={`min-h-screen flex flex-col transition-colors duration-500 ${isDark ? 'dark bg-[#050505]' : 'bg-neutral-100'}`}>
        <header className="p-6 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors overflow-hidden ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-200'}`}>
              {ui.brand_icon ? (
                <div dangerouslySetInnerHTML={{ __html: ui.brand_icon }} className="w-6 h-6" />
              ) : (
                <LayoutTemplate className={`w-6 h-6 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`} />
              )}
            </div>
            <span className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-neutral-900'}`}>
              {project.name}
            </span>
          </div>

          <HeaderActions hideUser />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
          {/* Background effects */}
          {isDark && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full" />
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full" />
            </div>
          )}

          <div className={`w-full max-w-sm rounded-[2.5rem] p-10 md:p-12 shadow-2xl transition-all duration-500 border relative z-10 ${isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'}`}>
            <div className="mb-10">
              <h2 className={`text-3xl font-bold mb-3 tracking-tight transition-colors ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                {title}
              </h2>
              <p className={`text-sm leading-relaxed transition-colors ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
                {subtitle}
              </p>
            </div>

            <form className="space-y-5">
              <div className="space-y-2">
                <label className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
                  {userLabel}
                </label>
                <input 
                  type="text" 
                  placeholder={userPlaceholder}
                  className={`w-full h-12 rounded-xl border transition-all outline-none px-4 text-sm ${isDark ? 'bg-neutral-950 border-neutral-800 text-white focus:border-neutral-600' : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-neutral-400'}`}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isDark ? 'text-neutral-500' : 'text-neutral-600'}`}>
                    {passLabel}
                  </label>
                  <button type="button" className={`text-[10px] font-bold uppercase tracking-widest transition-colors hover:underline ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    {t('app.forgot_password')}
                  </button>
                </div>
                <input 
                  type="password" 
                  placeholder={passPlaceholder}
                  className={`w-full h-12 rounded-xl border transition-all outline-none px-4 text-sm ${isDark ? 'bg-neutral-950 border-neutral-800 text-white focus:border-neutral-600' : 'bg-neutral-50 border-neutral-200 text-neutral-900 focus:border-neutral-400'}`}
                />
              </div>

              <button 
                type="submit"
                className="w-full h-14 rounded-xl text-white text-sm font-bold mt-4 transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
                style={{ 
                  backgroundColor: buttonColor,
                  boxShadow: `0 10px 25px -5px ${buttonColor}40`
                }}
              >
                {buttonText}
              </button>
            </form>

            <div className="mt-12 text-center">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-neutral-700' : 'text-neutral-300'}`}>
                {t('app.powered_by')}
              </p>
            </div>
          </div>
        </main>

        <footer className="p-8 text-center">
          <p className={`text-xs ${isDark ? 'text-neutral-700' : 'text-neutral-400'}`}>
            &copy; {new Date().getFullYear()} AGTech Innovation Lab. All rights reserved.
          </p>
        </footer>
      </div>
    </LoginPortalThemeWrapper>
  )
}
