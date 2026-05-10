'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Save, 
  Palette,
  LayoutTemplate,
  Monitor,
  Type
} from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'

import { HeaderActions } from '@/components/layout/HeaderActions'

export default function LoginVisualConfigurator() {
  const params = useParams()
  const router = useRouter()
  const { workspace_slug, project_slug } = params
  const { t } = useI18n()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [project, setProject] = useState<any>(null)
  
  const [uiConfig, setUiConfig] = useState({
    title: t('dashboard.projects.studio.auth.default_welcome_title'),
    subtitle: t('dashboard.projects.studio.auth.default_welcome_desc'),
    button_color: '#4f46e5',
    button_text: t('dashboard.projects.studio.auth.default_button_text'),
    theme: 'dark',
    iconesvg: '',
    usertitle: t('dashboard.projects.studio.auth.default_email_label'),
    userplaceholder: t('dashboard.projects.studio.auth.default_email_placeholder'),
    passtitle: t('dashboard.projects.studio.auth.default_pass_label'),
    passplaceholder: t('dashboard.projects.studio.auth.default_pass_placeholder')
  })

  const supabase = createClient()
  const { toast } = useToast()

  useEffect(() => {
    async function loadData() {
      // Resolve Project
      const { data: proj } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', project_slug)
        .single()
      
      if (proj) {
        setProject(proj)

        // Load existing config
        const { data: config } = await supabase
          .from('project_auth_config')
          .select('ui_config')
          .eq('project_id', proj.id)
          .single()

        if (config && config.ui_config) {
          setUiConfig({ ...uiConfig, ...config.ui_config })
        }
      }
      setIsLoading(false)
    }

    loadData()
  }, [project_slug, supabase])

  const handleSave = async () => {
    if (!project) return
    setIsSaving(true)
    
    try {
      const { error } = await supabase
        .from('project_auth_config')
        .upsert({
          project_id: project.id,
          ui_config: uiConfig
        }, { onConflict: 'project_id' })

      if (error) throw error
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 2500)
    } catch (err: any) {
      console.error(err)
      toast(t('common.error_save') + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center text-black dark:text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold uppercase tracking-widest animate-pulse">{t('common.loading')}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white dark:bg-[#080808] text-black dark:text-white transition-colors duration-300">
      
      <nav className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio`} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 mx-1"></div>
          <div>
            <h1 className="text-sm font-bold text-neutral-900 dark:text-white">{t('dashboard.projects.studio.login.title')}</h1>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">{t('dashboard.projects.studio.login.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <HeaderActions hideUser={true} />
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 mx-1"></div>
          
          <Link 
            href={`/${workspace_slug}/${project_slug}/login`}
            target="_blank"
            className="px-4 py-2 rounded-full text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            {t('dashboard.projects.studio.login.view_portal')}
          </Link>

          <button 
            onClick={handleSave}
            disabled={isSaving || isSuccess}
            className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all ${isSuccess ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]'}`}
          >
            {isSaving ? t('dashboard.projects.studio.config.saving') : isSuccess ? t('dashboard.projects.studio.config.saved_success') : <><Save className="w-4 h-4" /> {t('dashboard.projects.studio.login.publish')}</>}
          </button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-64px)]">
        
        {/* Painel de Propriedades (Esquerda) */}
        <aside className="border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/20 p-10 space-y-10 overflow-y-auto">
          
          <div className="space-y-6">
            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Type className="w-4 h-4" /> {t('dashboard.projects.studio.login.main_texts')}
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.page_title')}</label>
                <input 
                  type="text" 
                  value={uiConfig.title}
                  onChange={e => setUiConfig({...uiConfig, title: e.target.value})}
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
                  placeholder={t('dashboard.projects.studio.login.page_title_placeholder') || 'Ex: Área do Cliente'}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.page_subtitle')}</label>
                <input 
                  type="text" 
                  value={uiConfig.subtitle}
                  onChange={e => setUiConfig({...uiConfig, subtitle: e.target.value})}
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.brand_icon')}</label>
                <textarea 
                  value={uiConfig.iconesvg}
                  onChange={e => setUiConfig({...uiConfig, iconesvg: e.target.value})}
                  className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono focus:border-indigo-500 outline-none transition-all h-24 text-neutral-900 dark:text-white"
                  placeholder={t('dashboard.projects.icon_placeholder')}
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4" /> {t('dashboard.projects.studio.login.field_config')}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.user_label')}</label>
                  <input 
                    type="text" 
                    value={uiConfig.usertitle}
                    onChange={e => setUiConfig({...uiConfig, usertitle: e.target.value})}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.user_placeholder')}</label>
                  <input 
                    type="text" 
                    value={uiConfig.userplaceholder}
                    onChange={e => setUiConfig({...uiConfig, userplaceholder: e.target.value})}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.pass_label')}</label>
                  <input 
                    type="text" 
                    value={uiConfig.passtitle}
                    onChange={e => setUiConfig({...uiConfig, passtitle: e.target.value})}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.pass_placeholder')}</label>
                  <input 
                    type="text" 
                    value={uiConfig.passplaceholder}
                    onChange={e => setUiConfig({...uiConfig, passplaceholder: e.target.value})}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Palette className="w-4 h-4" /> {t('dashboard.projects.studio.login.styles_colors')}
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.button_color')}</label>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg border border-neutral-200 dark:border-neutral-700" style={{ backgroundColor: uiConfig.button_color }}></div>
                    <input 
                      type="text" 
                      value={uiConfig.button_color}
                      onChange={e => setUiConfig({...uiConfig, button_color: e.target.value})}
                      className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none font-mono text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.button_text')}</label>
                  <input 
                    type="text" 
                    value={uiConfig.button_text}
                    onChange={e => setUiConfig({...uiConfig, button_text: e.target.value})}
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none text-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase">{t('dashboard.projects.studio.login.container_theme')}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setUiConfig({...uiConfig, theme: 'dark'})}
                    className={`p-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${uiConfig.theme === 'dark' ? 'bg-indigo-600/5 dark:bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-white' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'}`}
                  >
                    Dark Mode
                  </button>
                  <button 
                    onClick={() => setUiConfig({...uiConfig, theme: 'light'})}
                    className={`p-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${uiConfig.theme === 'light' ? 'bg-indigo-600/5 dark:bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-white font-bold' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'}`}
                  >
                    Light Mode
                  </button>
                </div>
              </div>
            </div>
          </div>

        </aside>

        {/* Live Preview (Direita) */}
        <main className={`p-10 flex flex-col items-center justify-center relative transition-all duration-500 ${uiConfig.theme === 'dark' ? 'bg-[#050505]' : 'bg-neutral-100'}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05),transparent)] pointer-events-none"></div>
          <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-900 rounded-full border border-neutral-200 dark:border-neutral-800 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest shadow-sm dark:shadow-none">
            <Monitor className="w-3 h-3" /> {t('dashboard.projects.studio.login.live_preview')}
          </div>

          {/* O Preview da Tela de Login */}
          <div className={`w-full max-w-sm rounded-[2rem] p-10 shadow-2xl transition-all duration-500 border ${uiConfig.theme === 'dark' ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'}`}>
            <div className={`w-12 h-12 rounded-xl mb-8 flex items-center justify-center border transition-colors overflow-hidden ${uiConfig.theme === 'dark' ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-100 border-neutral-200'}`}>
              {uiConfig.iconesvg ? (
                <div className="w-full h-full p-2 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: uiConfig.iconesvg }} />
              ) : (
                <LayoutTemplate className={`w-6 h-6 ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`} />
              )}
            </div>
            
            <h2 className={`text-2xl font-bold mb-2 transition-colors ${uiConfig.theme === 'dark' ? 'text-white' : 'text-neutral-900'}`}>
              {uiConfig.title}
            </h2>
            <p className={`text-sm mb-8 transition-colors ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>
              {uiConfig.subtitle}
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase transition-colors ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{uiConfig.usertitle}</label>
                <div className={`w-full h-10 rounded-lg border transition-colors flex items-center px-3 text-[10px] ${uiConfig.theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-600' : 'bg-neutral-50 border-neutral-200 text-neutral-400'}`}>
                  {uiConfig.userplaceholder}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase transition-colors ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-600'}`}>{uiConfig.passtitle}</label>
                <div className={`w-full h-10 rounded-lg border transition-colors flex items-center px-3 text-[10px] ${uiConfig.theme === 'dark' ? 'bg-neutral-900 border-neutral-800 text-neutral-600' : 'bg-neutral-50 border-neutral-200 text-neutral-400'}`}>
                  {uiConfig.passplaceholder}
                </div>
              </div>
              
              <button 
                className="w-full py-3 rounded-xl text-white text-sm font-bold mt-4 transition-all hover:opacity-90"
                style={{ backgroundColor: uiConfig.button_color, boxShadow: `0 10px 20px -10px ${uiConfig.button_color}` }}
              >
                {uiConfig.button_text}
              </button>

              <div className="flex justify-center pt-2">
                <span className="text-[10px] font-bold hover:underline cursor-pointer" style={{ color: uiConfig.button_color }}>
                  {t('app.forgot_password')}
                </span>
              </div>

              <div className={`mt-8 text-center border-t pt-6 ${uiConfig.theme === 'dark' ? 'border-neutral-800' : 'border-neutral-100'}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${uiConfig.theme === 'dark' ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  {t('app.powered_by')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-8">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${uiConfig.theme === 'dark' ? 'bg-indigo-500' : 'bg-indigo-600'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Theme: {uiConfig.theme}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: uiConfig.button_color }} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${uiConfig.theme === 'dark' ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Primary: {uiConfig.button_color}
              </span>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
