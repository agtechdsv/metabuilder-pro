'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { 
  ArrowLeft, 
  ShieldCheck, 
  Database, 
  Users, 
  Save, 
  Network,
  Fingerprint,
  Palette,
  Layout,
  Type,
  Image as ImageIcon,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'

export default function AuthSettingsPage() {
  const { t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const { workspace_slug, project_slug } = params

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [project, setProject] = useState<any>(null)
  const [models, setModels] = useState<any[]>([])
  
  const [authConfig, setAuthConfig] = useState({
    auth_type: 'managed',
    db_table_name: '',
    db_email_column: '',
    db_password_column: '',
    db_password_hash_type: 'bcrypt',
    ldap_server_url: '',
    ldap_base_dn: ''
  })
  
  const [visualConfig, setVisualConfig] = useState({
    logo_url: '',
    icon_svg: '', 
    primary_color: '#4f46e5',
    bg_color: '#ffffff',
    welcome_title: 'Bem-vindo de volta!',
    welcome_desc: 'Entre com suas credenciais para acessar o portal.',
    theme: 'light',
    button_text: 'Entrar no Sistema',
    button_color: '#4f46e5',
    email_label: 'E-mail',
    password_label: 'Senha',
    email_placeholder: 'exemplo@empresa.com',
    password_placeholder: 'Sua senha secreta',
    login_tooltip: 'Use suas credenciais de acesso'
  })

  const [activeTab, setActiveTab] = useState<'visual' | 'strategy'>('strategy')

  const supabase = createClient()
  const { toast } = useToast()
  const { theme: globalTheme } = useTheme()

  const resolvedPreviewTheme = visualConfig.theme === 'auto' ? globalTheme : visualConfig.theme

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
          .select('*')
          .eq('project_id', proj.id)
          .single()

        if (config) {
          setAuthConfig(config)
          if (config.visual_config) {
            setVisualConfig(config.visual_config)
          }
        }

        // Load models for the "Database" option dropdowns
        const { data: modelsData } = await supabase
          .from('models')
          .select('*, fields(*)')
          .eq('project_id', proj.id)
        
        if (modelsData) setModels(modelsData)
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
          ...authConfig,
          visual_config: visualConfig
        })

      if (error) throw error
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 2500)
    } catch (err: any) {
      console.error(err)
      toast('Erro ao salvar: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-white dark:bg-[#050505] flex items-center justify-center text-neutral-900 dark:text-white">{t('common.loading')}...</div>

  // Helper to get fields of selected table
  const selectedModel = models.find(m => m.db_table_name === authConfig.db_table_name)
  const fields = selectedModel?.fields || []

  return (
    <div className="min-h-screen bg-white dark:bg-[#080808] text-neutral-900 dark:text-white transition-colors duration-300">
      
      <nav className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio`} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-indigo-600 dark:hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 mx-1"></div>
          <div>
            <h1 className="text-sm font-bold text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.title')}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleSave}
            disabled={isSaving || isSuccess}
            className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all ${isSuccess ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]'}`}
          >
            {isSaving ? t('dashboard.projects.studio.config.saving') : isSuccess ? t('dashboard.projects.studio.config.saved_success') : <><Save className="w-4 h-4" /> {t('dashboard.projects.studio.auth.save_settings')}</>}
          </button>
          <HeaderActions />
        </div>
      </nav>

      <main className="max-w-[1600px] mx-auto p-10 space-y-12">
        
        <div className="sticky top-16 z-30 bg-white/80 dark:bg-[#080808]/80 backdrop-blur-xl -mx-10 px-10 py-6 border-b border-neutral-200 dark:border-neutral-800 space-y-6">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
                  Configurar <span className="text-indigo-600 dark:text-indigo-500">Login</span>
                </h2>
                <p className="text-neutral-500 dark:text-neutral-400 font-medium">{t('dashboard.projects.studio.auth.strategy_desc')}</p>
              </div>
            </div>
          </section>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900/50 p-1.5 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 w-fit">
            <button 
              onClick={() => setActiveTab('strategy')}
              className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'strategy' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <Fingerprint className="w-4 h-4" /> Estratégia de Autenticação
            </button>
            <button 
              onClick={() => setActiveTab('visual')}
              className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'visual' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <Palette className="w-4 h-4" /> Personalização Visual
            </button>
          </div>
        </div>

        {activeTab === 'strategy' ? (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <button 
                onClick={() => setAuthConfig({...authConfig, auth_type: 'managed'})}
                className={`p-10 border-2 rounded-[3rem] text-left transition-all group relative overflow-hidden ${authConfig.auth_type === 'managed' ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl shadow-indigo-500/10' : 'bg-white dark:bg-neutral-900/30 border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700'}`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all shadow-sm ${authConfig.auth_type === 'managed' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-xl mb-3 text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.managed_title')}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('dashboard.projects.studio.auth.managed_desc')}</p>
              </button>

              <button 
                onClick={() => setAuthConfig({...authConfig, auth_type: 'database'})}
                className={`p-10 border-2 rounded-[3rem] text-left transition-all group relative overflow-hidden ${authConfig.auth_type === 'database' ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl shadow-indigo-500/10' : 'bg-white dark:bg-neutral-900/30 border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700'}`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all shadow-sm ${authConfig.auth_type === 'database' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                  <Database className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-xl mb-3 text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.database_title')}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('dashboard.projects.studio.auth.database_desc')}</p>
              </button>

              <button 
                onClick={() => setAuthConfig({...authConfig, auth_type: 'ldap'})}
                className={`p-10 border-2 rounded-[3rem] text-left transition-all group relative overflow-hidden ${authConfig.auth_type === 'ldap' ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl shadow-indigo-500/10' : 'bg-white dark:bg-neutral-900/30 border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700'}`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all shadow-sm ${authConfig.auth_type === 'ldap' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                  <Network className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-xl mb-3 text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.ldap_title')}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('dashboard.projects.studio.auth.ldap_desc')}</p>
              </button>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 p-10 rounded-[3rem]">
              {authConfig.auth_type === 'managed' && (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
                  <ShieldCheck className="w-20 h-20 text-indigo-500/30" />
                  <div>
                    <h3 className="text-2xl font-black text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.managed_ready')}</h3>
                    <p className="text-neutral-500 dark:text-neutral-400 max-w-md mt-2">{t('dashboard.projects.studio.auth.managed_ready_desc')}</p>
                  </div>
                </div>
              )}

              {authConfig.auth_type === 'database' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <h3 className="text-xl font-bold border-b border-neutral-200 dark:border-neutral-800 pb-4 text-neutral-900 dark:text-white">Mapeamento de Tabelas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Tabela de Usuários</label>
                      <select 
                        value={authConfig.db_table_name || ''}
                        onChange={(e) => setAuthConfig({...authConfig, db_table_name: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      >
                        <option value="">Selecione a tabela...</option>
                        {models.map(m => (
                          <option key={m.id} value={m.db_table_name}>{m.db_table_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Coluna de E-mail/Login</label>
                      <select 
                        value={authConfig.db_email_column || ''}
                        onChange={(e) => setAuthConfig({...authConfig, db_email_column: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      >
                        <option value="">Selecione o campo...</option>
                        {fields.map((f: any) => (
                          <option key={f.id} value={f.db_column_name}>{f.db_column_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Coluna de Senha</label>
                      <select 
                        value={authConfig.db_password_column || ''}
                        onChange={(e) => setAuthConfig({...authConfig, db_password_column: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      >
                        <option value="">Selecione o campo...</option>
                        {fields.map((f: any) => (
                          <option key={f.id} value={f.db_column_name}>{f.db_column_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Formato do Hash</label>
                      <select 
                        value={authConfig.db_password_hash_type || 'bcrypt'}
                        onChange={(e) => setAuthConfig({...authConfig, db_password_hash_type: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      >
                        <option value="bcrypt">Bcrypt (Recomendado)</option>
                        <option value="md5">MD5 (Legado)</option>
                        <option value="sha256">SHA-256</option>
                        <option value="plain">Texto Plano</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {authConfig.auth_type === 'ldap' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <h3 className="text-xl font-bold border-b border-neutral-200 dark:border-neutral-800 pb-4 text-neutral-900 dark:text-white">Conexão LDAP / Active Directory</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Servidor LDAP (URL)</label>
                      <input 
                        type="text"
                        placeholder="ldap://servidor.empresa.local:389"
                        value={authConfig.ldap_server_url || ''}
                        onChange={(e) => setAuthConfig({...authConfig, ldap_server_url: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Base DN</label>
                      <input 
                        type="text"
                        placeholder="dc=empresa,dc=local"
                        value={authConfig.ldap_base_dn || ''}
                        onChange={(e) => setAuthConfig({...authConfig, ldap_base_dn: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Coluna de Configurações (8/12) */}
            <div className="lg:col-span-7 space-y-8 pb-20">
              
              {/* Branding e Identidade */}
              <div className="space-y-8 p-10 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[3rem]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Layout className="w-5 h-5" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-xs text-neutral-400">Identidade e Logo</h3>
                </div>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">URL do Logo</label>
                      <input 
                        type="text"
                        value={visualConfig.logo_url}
                        onChange={e => setVisualConfig({...visualConfig, logo_url: e.target.value})}
                        placeholder="https://..."
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Ícone SVG (Opcional)</label>
                      <input 
                        type="text"
                        value={visualConfig.icon_svg}
                        onChange={e => setVisualConfig({...visualConfig, icon_svg: e.target.value})}
                        placeholder="<svg>...</svg>"
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-[10px] font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Cor Primária</label>
                      <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4">
                        <input 
                          type="color"
                          value={visualConfig.primary_color}
                          onChange={e => setVisualConfig({...visualConfig, primary_color: e.target.value})}
                          className="w-6 h-6 rounded-md cursor-pointer bg-transparent"
                        />
                        <span className="text-xs font-mono font-bold uppercase">{visualConfig.primary_color}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Tema Padrão</label>
                      <select 
                        value={visualConfig.theme}
                        onChange={e => setVisualConfig({...visualConfig, theme: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 text-sm font-bold outline-none"
                      >
                        <option value="light">Light Mode</option>
                        <option value="dark">Dark Mode</option>
                        <option value="auto">Automático (Sistema)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messaging */}
              <div className="space-y-8 p-10 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[3rem]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Type className="w-5 h-5" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-xs text-neutral-400">Textos e Boas-vindas</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Título</label>
                    <input 
                      type="text"
                      value={visualConfig.welcome_title}
                      onChange={e => setVisualConfig({...visualConfig, welcome_title: e.target.value})}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Descrição</label>
                    <textarea 
                      value={visualConfig.welcome_desc}
                      onChange={e => setVisualConfig({...visualConfig, welcome_desc: e.target.value})}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold min-h-[80px] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Form Fields & Tooltips */}
              <div className="space-y-8 p-10 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[3rem]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-xs text-neutral-400">Campos e Tooltips</h3>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Label E-mail</label>
                      <input 
                        type="text"
                        value={visualConfig.email_label}
                        onChange={e => setVisualConfig({...visualConfig, email_label: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Placeholder E-mail</label>
                      <input 
                        type="text"
                        value={visualConfig.email_placeholder}
                        onChange={e => setVisualConfig({...visualConfig, email_placeholder: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Label Senha</label>
                      <input 
                        type="text"
                        value={visualConfig.password_label}
                        onChange={e => setVisualConfig({...visualConfig, password_label: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Placeholder Senha</label>
                      <input 
                        type="text"
                        value={visualConfig.password_placeholder}
                        onChange={e => setVisualConfig({...visualConfig, password_placeholder: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Mensagem de Ajuda (Tooltip)</label>
                  <input 
                    type="text"
                    value={visualConfig.login_tooltip}
                    onChange={e => setVisualConfig({...visualConfig, login_tooltip: e.target.value})}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                  />
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="space-y-8 p-10 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[3rem]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-xs text-neutral-400">Botão Principal</h3>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Texto do Botão</label>
                    <input 
                      type="text"
                      value={visualConfig.button_text}
                      onChange={e => setVisualConfig({...visualConfig, button_text: e.target.value})}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 outline-none text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Cor do Botão</label>
                    <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4">
                      <input 
                        type="color"
                        value={visualConfig.button_color}
                        onChange={e => setVisualConfig({...visualConfig, button_color: e.target.value})}
                        className="w-6 h-6 rounded-md cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono font-bold uppercase">{visualConfig.button_color}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Coluna de Preview (5/12) */}
            <div className="lg:col-span-5 relative">
              <div className="sticky top-[260px] space-y-6">
                <div className="flex items-center justify-between px-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">Live Preview</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-bold text-green-500 uppercase tracking-tighter">Sincronizado</span>
                  </div>
                </div>

                {/* Card de Preview Simulando a Tela de Login */}
                <div className={`w-full min-h-[600px] rounded-[3.5rem] overflow-hidden border shadow-2xl relative flex flex-col transition-all duration-500 ${
                  resolvedPreviewTheme === 'dark' 
                    ? 'bg-[#050505] text-white border-neutral-800' 
                    : 'bg-white text-black border-neutral-200'
                }`}>
                  {/* Background sutil com gradiente da cor primária */}
                  <div className="absolute inset-0 opacity-[0.05]" style={{ background: `radial-gradient(circle at top right, ${visualConfig.primary_color}, transparent)` }}></div>
                  
                  <div className="relative z-10 p-12 flex-1 flex flex-col">
                    {/* Logo/Icon */}
                    <div className="mb-12 flex justify-center">
                      {visualConfig.logo_url ? (
                        <img src={visualConfig.logo_url} alt="Logo" className="max-h-20 w-auto object-contain" />
                      ) : visualConfig.icon_svg ? (
                        <div 
                          className="w-20 h-20 flex items-center justify-center transition-all" 
                          style={{ color: visualConfig.primary_color }}
                          dangerouslySetInnerHTML={{ __html: visualConfig.icon_svg }} 
                        />
                      ) : (
                        <div 
                          className="w-20 h-20 rounded-3xl flex items-center justify-center text-white shadow-xl"
                          style={{ backgroundColor: visualConfig.primary_color }}
                        >
                          <ShieldCheck className="w-10 h-10" />
                        </div>
                      )}
                    </div>

                    <div className="text-center space-y-3 mb-10">
                      <h4 className="text-3xl font-black tracking-tight">{visualConfig.welcome_title}</h4>
                      <p className={`text-sm leading-relaxed px-4 ${resolvedPreviewTheme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>{visualConfig.welcome_desc}</p>
                    </div>

                    <div className="w-full space-y-5 text-left">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{visualConfig.email_label}</label>
                        <div className={`w-full h-14 border rounded-2xl px-6 flex items-center text-sm text-neutral-400 transition-colors ${
                          resolvedPreviewTheme === 'dark' 
                            ? 'bg-neutral-900 border-neutral-800' 
                            : 'bg-neutral-100 border-neutral-200'
                        }`}>
                          {visualConfig.email_placeholder}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{visualConfig.password_label}</label>
                        <div className={`w-full h-14 border rounded-2xl px-6 flex items-center text-sm text-neutral-400 transition-colors ${
                          resolvedPreviewTheme === 'dark' 
                            ? 'bg-neutral-900 border-neutral-800' 
                            : 'bg-neutral-100 border-neutral-200'
                        }`}>
                          {visualConfig.password_placeholder}
                        </div>
                      </div>
                    </div>

                    <div className="mt-10">
                      <button 
                        className="w-full py-5 rounded-2xl text-xs font-black uppercase tracking-widest text-white shadow-2xl transition-all hover:brightness-110 active:scale-[0.98]"
                        style={{ 
                          backgroundColor: visualConfig.button_color || visualConfig.primary_color,
                          boxShadow: `0 10px 30px -10px ${visualConfig.button_color || visualConfig.primary_color}66`
                        }}
                      >
                        {visualConfig.button_text}
                      </button>

                      <div className="mt-8 flex justify-center items-center gap-2">
                        <div className={`w-8 h-px ${resolvedPreviewTheme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`}></div>
                        <p className="text-[10px] font-black uppercase tracking-tighter text-neutral-400">
                          {visualConfig.login_tooltip}
                        </p>
                        <div className={`w-8 h-px ${resolvedPreviewTheme === 'dark' ? 'bg-neutral-800' : 'bg-neutral-200'}`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
