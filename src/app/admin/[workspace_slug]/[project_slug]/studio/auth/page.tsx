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
  Zap,
  Search,
  Mail,
  MoreHorizontal,
  UserPlus,
  Trash2
} from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Footer } from '@/components/layout/Footer'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'

export default function AuthSettingsPage() {
  const { t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const { workspace_slug, project_slug } = params as any

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [project, setProject] = useState<any>(null)
  const [workspace, setWorkspace] = useState<any>(null)
  const [models, setModels] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  
  const [legacyUsers, setLegacyUsers] = useState<any[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [roles, setRoles] = useState<any[]>([])
  const [userRoles, setUserRoles] = useState<any[]>([])
  const [uiViews, setUiViews] = useState<any[]>([])
  const [rolePermissions, setRolePermissions] = useState<any[]>([])
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  
  const [authConfig, setAuthConfig] = useState({
    auth_type: 'managed',
    db_table_name: '',
    db_email_column: '',
    db_password_column: '',
    db_password_hash_type: 'bcrypt',
    ldap_server_url: '',
    ldap_base_dn: '',
    allow_signup: false
  })
  
  const [visualConfig, setVisualConfig] = useState({
    logo_url: '',
    icon_svg: '', 
    primary_color: '#4f46e5',
    bg_color: '#ffffff',
    welcome_title: t('dashboard.projects.studio.auth.default_welcome_title'),
    welcome_desc: t('dashboard.projects.studio.auth.default_welcome_desc'),
    theme: 'light',
    button_text: t('dashboard.projects.studio.auth.default_button_text'),
    button_color: '#4f46e5',
    email_label: t('dashboard.projects.studio.auth.default_email_label'),
    password_label: t('dashboard.projects.studio.auth.default_pass_label'),
    email_placeholder: t('dashboard.projects.studio.auth.default_email_placeholder'),
    password_placeholder: t('dashboard.projects.studio.auth.default_pass_placeholder'),
    login_tooltip: t('dashboard.projects.studio.auth.default_tooltip')
  })

  const [activeTab, setActiveTab] = useState<'visual' | 'strategy' | 'users'>('strategy')
  const [usersSubTab, setUsersSubTab] = useState<'list' | 'permissions'>('list')

  const supabase = createClient()
  const { toast } = useToast()
  const { theme: globalTheme } = useTheme()

  const resolvedPreviewTheme = visualConfig.theme === 'auto' ? globalTheme : visualConfig.theme

  useEffect(() => {
    async function loadData() {
      // Resolve Workspace
      const { data: ws } = await supabase
        .from('workspaces')
        .select('*')
        .eq('slug', workspace_slug)
        .single()
      
      if (ws) setWorkspace(ws)

      // Resolve Project
      const { data: proj } = await supabase
        .from('projects')
        .select('*')
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
          setAuthConfig({
            ...config,
            allow_signup: config.ui_config?.allow_signup || false
          })
          if (config.ui_config) {
            setVisualConfig(prev => ({
              ...prev,
              ...config.ui_config
            }))
          }
        }

        // Load models for the "Database" option dropdowns
        const { data: modelsData } = await supabase
          .from('models')
          .select('*, fields(*)')
          .eq('project_id', proj.id)
        
        if (modelsData) setModels(modelsData)

        // Load UI Views for Permissions Mapping
        const { data: viewsData, error: viewsError } = await supabase.from('ui_views').select('id, name, slug').eq('project_id', proj.id)
        if (viewsError) console.error("Error fetching views:", viewsError)
        if (viewsData) setUiViews(viewsData)
      }

      // Fetch User & Profile for Navbar
      const { data: { user: userData } } = await supabase.auth.getUser()
      if (userData) {
        setUser(userData)
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userData.id)
          .single()
        if (profData) setProfile(profData)
      }

      setIsLoading(false)
    }

    loadData()
  }, [project_slug, workspace_slug, supabase])

  useEffect(() => {
    if (activeTab === 'users' && project && authConfig.db_table_name) {
      const loadLegacyUsers = async () => {
        setIsLoadingUsers(true)
        const queryId = crypto.randomUUID()
        const channelName = `tunnel:${project.id}`
        const channel = supabase.channel(channelName)
        let isFinished = false
        const cleanup = () => { isFinished = true; supabase.removeChannel(channel) }

        channel.on('broadcast', { event: `query_result_${queryId}` }, (payload: any) => {
          if (isFinished) return
          cleanup()
          const { success, data, error } = payload.payload
          if (success && data) {
            setLegacyUsers(data)
          } else {
            toast('Erro ao buscar usuários: ' + error, 'error')
          }
          setIsLoadingUsers(false)
        })

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast', event: 'sql_query',
              payload: { queryId, token: project.secret_token, action: 'get_users', config: authConfig, limit: 50, offset: 0 }
            })
          }
        })

        setTimeout(() => {
          if (!isFinished) {
            cleanup()
            setIsLoadingUsers(false)
            toast('Túnel CLI offline. Ligue o MetaBuilder CLI.', 'error')
          }
        }, 5000)

        // Carregar as roles criadas no Supabase para este projeto
        const { data: dbRoles } = await supabase.from('project_roles').select('*').eq('project_id', project.id)
        if (dbRoles) {
          setRoles(dbRoles)
          if (dbRoles.length > 0) {
            const { data: dbRolePerms } = await supabase.from('project_role_permissions').select('*').in('role_id', dbRoles.map(r => r.id))
            if (dbRolePerms) setRolePermissions(dbRolePerms)
          }
        }
        const { data: dbUserRoles } = await supabase.from('project_user_roles').select('*').eq('project_id', project.id)
        if (dbUserRoles) setUserRoles(dbUserRoles)
      }
      loadLegacyUsers()
    }
  }, [activeTab, project, authConfig, supabase, toast])

  const handleAssignRole = async (externalUserId: string, roleId: string) => {
    const { error } = await supabase
      .from('project_user_roles')
      .upsert({
        project_id: project.id,
        external_user_id: externalUserId.toString(),
        role_id: roleId
      }, { onConflict: 'project_id, external_user_id' })
      
    if (!error) {
      toast('Grupo atualizado com sucesso!', 'success')
      const { data: dbUserRoles } = await supabase.from('project_user_roles').select('*').eq('project_id', project.id)
      if (dbUserRoles) setUserRoles(dbUserRoles)
    } else {
      toast('Erro ao atualizar grupo: ' + error.message, 'error')
    }
  }

  const handleTogglePermission = async (roleId: string, viewId: string) => {
    const existing = rolePermissions.find(rp => rp.role_id === roleId && rp.view_id === viewId)
    
    if (existing) {
      // Toggle off (delete)
      const { error } = await supabase.from('project_role_permissions').delete().eq('id', existing.id)
      if (!error) setRolePermissions(prev => prev.filter(rp => rp.id !== existing.id))
    } else {
      // Toggle on (insert)
      const { data, error } = await supabase.from('project_role_permissions').insert({
        role_id: roleId,
        view_id: viewId,
        can_read: true
      }).select().single()
      if (!error && data) setRolePermissions(prev => [...prev, data])
    }
  }

  const handleCreateRole = async () => {
    if (!newRoleName) return
    const { error } = await supabase.from('project_roles').insert({
      project_id: project.id,
      name: newRoleName
    })
    if (!error) {
      toast('Grupo criado com sucesso!', 'success')
      setNewRoleName('')
      setIsCreatingRole(false)
      const { data: dbRoles } = await supabase.from('project_roles').select('*').eq('project_id', project.id)
      if (dbRoles) setRoles(dbRoles)
    } else {
      toast('Erro ao criar grupo: ' + error.message, 'error')
    }
  }

  const handleSave = async () => {
    if (!project) return
    setIsSaving(true)
    
    try {
      const { error } = await supabase
        .from('project_auth_config')
        .upsert({
          project_id: project.id,
          auth_type: authConfig.auth_type,
          db_table_name: authConfig.db_table_name,
          db_email_column: authConfig.db_email_column,
          db_password_column: authConfig.db_password_column,
          db_password_hash_type: authConfig.db_password_hash_type,
          ldap_server_url: authConfig.ldap_server_url,
          ldap_base_dn: authConfig.ldap_base_dn,
          ui_config: {
            ...visualConfig,
            allow_signup: authConfig.allow_signup
          }
        })

      if (error) throw error
      setIsSuccess(true)
      toast(t('common.success'), 'success')
      setTimeout(() => setIsSuccess(false), 2500)
    } catch (err: any) {
      console.error(err)
      toast(t('dashboard.projects.studio.toasts.error_status') + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-white dark:bg-[#050505] flex items-center justify-center text-neutral-900 dark:text-white">{t('common.loading')}...</div>

  // Helper to get fields of selected table
  const selectedModel = models.find(m => m.db_table_name === authConfig.db_table_name)
  const fields = selectedModel?.fields || []

  return (
    <>
      <Breadcrumbs 
        workspaceName={workspace?.name} 
        workspaceSlug={workspace_slug}
        projectName={project?.name}
        projectSlug={project_slug}
        viewName="Auth"
      />

      <main className="w-full px-10 pt-4 pb-4 space-y-6 flex-grow">
        
        <div className="sticky top-16 z-30 bg-white/80 dark:bg-[#080808]/80 backdrop-blur-xl -mx-10 px-10 py-4 border-b border-neutral-200 dark:border-neutral-800 space-y-4">
          <section className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white">
                  {t('dashboard.projects.studio.auth.title')}
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">{t('dashboard.projects.studio.auth.strategy_desc')}</p>
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-6 h-12 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                isSuccess 
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50'
              }`}
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSuccess ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? t('common.saving') : isSuccess ? t('common.saved') : t('common.save')}
            </button>
          </section>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900/50 p-1 rounded-[1.5rem] border border-neutral-200 dark:border-neutral-800 w-fit">
            <button 
              onClick={() => setActiveTab('strategy')}
              className={`flex items-center gap-2 px-6 py-2 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'strategy' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <Fingerprint className="w-4 h-4" /> {t('dashboard.projects.studio.auth.strategy_tab')}
            </button>
            <button 
              onClick={() => setActiveTab('visual')}
              className={`flex items-center gap-2 px-6 py-2 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'visual' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <Palette className="w-4 h-4" /> {t('dashboard.projects.studio.auth.visual_tab')}
            </button>
            <button 
              onClick={() => setActiveTab('users' as any)}
              className={`flex items-center gap-2 px-6 py-2 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-xl' : 'text-neutral-400 hover:text-neutral-600'}`}
            >
              <Users className="w-4 h-4" /> {t('dashboard.projects.studio.auth.users_tab') || 'Usuários'}
            </button>
          </div>
        </div>
        {activeTab === 'strategy' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                onClick={() => setAuthConfig({...authConfig, auth_type: 'managed'})}
                className={`p-6 border-2 rounded-[2rem] text-left transition-all group relative overflow-hidden ${authConfig.auth_type === 'managed' ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl shadow-indigo-500/10' : 'bg-white dark:bg-neutral-900/30 border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all shadow-sm ${authConfig.auth_type === 'managed' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.managed_title')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('dashboard.projects.studio.auth.managed_desc')}</p>
              </button>

              <button 
                onClick={() => setAuthConfig({...authConfig, auth_type: 'database'})}
                className={`p-6 border-2 rounded-[2rem] text-left transition-all group relative overflow-hidden ${authConfig.auth_type === 'database' ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl shadow-indigo-500/10' : 'bg-white dark:bg-neutral-900/30 border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all shadow-sm ${authConfig.auth_type === 'database' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                  <Database className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.database_title')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('dashboard.projects.studio.auth.database_desc')}</p>
              </button>

              <button 
                onClick={() => setAuthConfig({...authConfig, auth_type: 'ldap'})}
                className={`p-6 border-2 rounded-[2rem] text-left transition-all group relative overflow-hidden ${authConfig.auth_type === 'ldap' ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl shadow-indigo-500/10' : 'bg-white dark:bg-neutral-900/30 border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700'}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all shadow-sm ${authConfig.auth_type === 'ldap' ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}>
                  <Network className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.ldap_title')}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{t('dashboard.projects.studio.auth.ldap_desc')}</p>
              </button>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 p-6 rounded-[2rem] space-y-6">
              <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.allow_signup')}</h4>
                    <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{t('dashboard.projects.studio.auth.allow_signup_desc')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setAuthConfig({...authConfig, allow_signup: !authConfig.allow_signup})}
                  className={`w-12 h-6 rounded-full transition-all relative ${authConfig.allow_signup ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${authConfig.allow_signup ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

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
                <div className="space-y-6 animate-in fade-in duration-300">
                  <h3 className="text-lg font-bold border-b border-neutral-200 dark:border-neutral-800 pb-3 text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.table_mapping')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.user_table')}</label>
                      <select 
                        value={authConfig.db_table_name || ''}
                        onChange={(e) => setAuthConfig({...authConfig, db_table_name: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      >
                        <option value="">{t('dashboard.projects.studio.auth.select_table')}</option>
                        {models.map(m => (
                          <option key={m.id} value={m.db_table_name}>{m.db_table_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.email_column')}</label>
                      <select 
                        value={authConfig.db_email_column || ''}
                        onChange={(e) => setAuthConfig({...authConfig, db_email_column: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      >
                        <option value="">Selecione o campo...</option>
                        {fields.map((f: any) => (
                          <option key={f.id} value={f.name || f.db_column_name}>
                            {f.label || f.name || f.db_column_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.pass_column')}</label>
                      <select 
                        value={authConfig.db_password_column || ''}
                        onChange={(e) => setAuthConfig({...authConfig, db_password_column: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      >
                        <option value="">Selecione o campo...</option>
                        {fields.map((f: any) => (
                          <option key={f.id} value={f.name || f.db_column_name}>
                            {f.label || f.name || f.db_column_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.hash_format')}</label>
                      <select 
                        value={authConfig.db_password_hash_type || 'bcrypt'}
                        onChange={(e) => setAuthConfig({...authConfig, db_password_hash_type: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      >
                        <option value="bcrypt">{t('dashboard.projects.studio.auth.bcrypt')}</option>
                        <option value="md5">{t('dashboard.projects.studio.auth.md5')}</option>
                        <option value="sha256">{t('dashboard.projects.studio.auth.sha256')}</option>
                        <option value="plain">{t('dashboard.projects.studio.auth.plain')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {authConfig.auth_type === 'ldap' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <h3 className="text-lg font-bold border-b border-neutral-200 dark:border-neutral-800 pb-3 text-neutral-900 dark:text-white">{t('dashboard.projects.studio.auth.ldap_config')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.ldap_url')}</label>
                      <input 
                        type="text"
                        placeholder="ldap://servidor.empresa.local:389"
                        value={authConfig.ldap_server_url || ''}
                        onChange={(e) => setAuthConfig({...authConfig, ldap_server_url: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.base_dn')}</label>
                      <input 
                        type="text"
                        placeholder="dc=empresa,dc=local"
                        value={authConfig.ldap_base_dn || ''}
                        onChange={(e) => setAuthConfig({...authConfig, ldap_base_dn: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-sm font-bold shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'visual' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Coluna de Configurações (8/12) */}
            <div className="lg:col-span-7 space-y-4 pb-20">
              
              {/* Branding e Identidade */}
              <div className="space-y-4 p-6 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Layout className="w-4 h-4" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-[10px] text-neutral-400">{t('dashboard.projects.studio.auth.identity_logo')}</h3>
                </div>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.logo_url')}</label>
                      <input 
                        type="text"
                        value={visualConfig.logo_url || ''}
                        onChange={e => setVisualConfig({...visualConfig, logo_url: e.target.value})}
                        placeholder="https://..."
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.icon_svg')}</label>
                      <input 
                        type="text"
                        value={visualConfig.icon_svg || ''}
                        onChange={e => setVisualConfig({...visualConfig, icon_svg: e.target.value})}
                        placeholder={t('dashboard.projects.icon_placeholder')}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-[10px] font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.primary_color')}</label>
                      <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
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
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.default_theme')}</label>
                      <select 
                        value={visualConfig.theme || 'light'}
                        onChange={e => setVisualConfig({...visualConfig, theme: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                      >
                        <option value="light">{t('dashboard.projects.studio.auth.light_mode')}</option>
                        <option value="dark">{t('dashboard.projects.studio.auth.dark_mode')}</option>
                        <option value="auto">{t('dashboard.projects.studio.auth.auto_mode')}</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Messaging */}
              <div className="space-y-4 p-6 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Type className="w-4 h-4" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-[10px] text-neutral-400">{t('dashboard.projects.studio.auth.welcome_texts')}</h3>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.title_label')}</label>
                    <input 
                      type="text"
                      value={visualConfig.welcome_title || ''}
                      onChange={e => setVisualConfig({...visualConfig, welcome_title: e.target.value})}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.desc_label')}</label>
                    <textarea 
                      value={visualConfig.welcome_desc || ''}
                      onChange={e => setVisualConfig({...visualConfig, welcome_desc: e.target.value})}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold min-h-[60px] resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Form Fields & Tooltips */}
              <div className="space-y-4 p-6 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-[10px] text-neutral-400">{t('dashboard.projects.studio.auth.fields_tooltips')}</h3>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.email_label')}</label>
                      <input 
                        type="text"
                        value={visualConfig.email_label || ''}
                        onChange={e => setVisualConfig({...visualConfig, email_label: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.email_placeholder')}</label>
                      <input 
                        type="text"
                        value={visualConfig.email_placeholder || ''}
                        onChange={e => setVisualConfig({...visualConfig, email_placeholder: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.pass_label')}</label>
                      <input 
                        type="text"
                        value={visualConfig.password_label || ''}
                        onChange={e => setVisualConfig({...visualConfig, password_label: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.pass_placeholder')}</label>
                      <input 
                        type="text"
                        value={visualConfig.password_placeholder || ''}
                        onChange={e => setVisualConfig({...visualConfig, password_placeholder: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.help_message')}</label>
                  <input 
                    type="text"
                    value={visualConfig.login_tooltip || ''}
                    onChange={e => setVisualConfig({...visualConfig, login_tooltip: e.target.value})}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold"
                  />
                </div>
              </div>

              {/* Botão de Ação */}
              <div className="space-y-4 p-6 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h3 className="font-black uppercase tracking-widest text-[10px] text-neutral-400">{t('dashboard.projects.studio.auth.main_button')}</h3>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Texto do Botão</label>
                    <input 
                      type="text"
                      value={visualConfig.button_text || ''}
                      onChange={e => setVisualConfig({...visualConfig, button_text: e.target.value})}
                      className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 outline-none text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">{t('dashboard.projects.studio.auth.button_color')}</label>
                    <div className="flex items-center gap-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
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
              <div className="sticky top-[180px] space-y-4">
                <div className="flex items-center justify-between px-6">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('dashboard.projects.studio.auth.live_preview')}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-bold text-green-500 uppercase tracking-tighter">{t('dashboard.projects.studio.auth.synchronized')}</span>
                  </div>
                </div>

                {/* Card de Preview Simulando a Tela de Login */}
                <div className={`w-full min-h-[500px] rounded-[2.5rem] overflow-hidden border shadow-2xl relative flex flex-col transition-all duration-500 ${
                  resolvedPreviewTheme === 'dark' 
                    ? 'bg-[#050505] text-white border-neutral-800' 
                    : 'bg-white text-black border-neutral-200'
                }`}>
                  {/* Background sutil com gradiente da cor primária */}
                  <div className="absolute inset-0 opacity-[0.05]" style={{ background: `radial-gradient(circle at top right, ${visualConfig.primary_color}, transparent)` }}></div>
                  
                  <div className="relative z-10 p-8 flex-1 flex flex-col">
                    {/* Logo/Icon */}
                    <div className="mb-8 flex justify-center">
                      {visualConfig.logo_url ? (
                        <img src={visualConfig.logo_url} alt="Logo" className="max-h-16 w-auto object-contain" />
                      ) : visualConfig.icon_svg ? (
                        <div 
                          className="w-16 h-16 flex items-center justify-center transition-all" 
                          style={{ color: visualConfig.primary_color }}
                          dangerouslySetInnerHTML={{ __html: visualConfig.icon_svg }} 
                        />
                      ) : (
                        <div 
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl"
                          style={{ backgroundColor: visualConfig.primary_color }}
                        >
                          <ShieldCheck className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    <div className="text-center space-y-2 mb-6">
                      <h4 className="text-2xl font-black tracking-tight">{visualConfig.welcome_title}</h4>
                      <p className={`text-xs leading-relaxed px-4 ${resolvedPreviewTheme === 'dark' ? 'text-neutral-400' : 'text-neutral-500'}`}>{visualConfig.welcome_desc}</p>
                    </div>

                    <div className="w-full space-y-4 text-left">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{visualConfig.email_label}</label>
                        <div className={`w-full h-11 border rounded-xl px-4 flex items-center text-xs text-neutral-400 transition-colors ${
                          resolvedPreviewTheme === 'dark' 
                            ? 'bg-neutral-900 border-neutral-800' 
                            : 'bg-neutral-100 border-neutral-200'
                        }`}>
                          {visualConfig.email_placeholder}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">{visualConfig.password_label}</label>
                        <div className={`w-full h-11 border rounded-xl px-4 flex items-center text-xs text-neutral-400 transition-colors ${
                          resolvedPreviewTheme === 'dark' 
                            ? 'bg-neutral-900 border-neutral-800' 
                            : 'bg-neutral-100 border-neutral-200'
                        }`}>
                          {visualConfig.password_placeholder}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8">
                      <button 
                        className="w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-2xl transition-all hover:brightness-110 active:scale-[0.98]"
                        style={{ 
                          backgroundColor: visualConfig.button_color || visualConfig.primary_color,
                          boxShadow: `0 8px 25px -8px ${visualConfig.button_color || visualConfig.primary_color}66`
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
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-900/50 p-1 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <button 
                  onClick={() => setUsersSubTab('list')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${usersSubTab === 'list' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  Lista de Usuários
                </button>
                <button 
                  onClick={() => setUsersSubTab('permissions')}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${usersSubTab === 'permissions' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}
                >
                  Permissões de Telas
                </button>
              </div>

              {usersSubTab === 'list' && (
                <div className="flex gap-4 items-center w-full max-w-md justify-end">
                  <div className="relative w-full max-w-[240px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar..."
                      className="w-full h-11 pl-12 pr-4 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 outline-none focus:border-indigo-500 text-sm font-medium transition-all"
                    />
                  </div>
                  <button onClick={() => setIsCreatingRole(true)} className="flex items-center gap-2 px-6 h-11 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 whitespace-nowrap">
                    <ShieldCheck className="w-4 h-4" />
                    Criar Grupo
                  </button>
                </div>
              )}
            </div>

            {isCreatingRole && (
              <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] p-6 flex gap-4 items-end animate-in fade-in slide-in-from-top-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Nome do Grupo de Acesso</label>
                  <input 
                    type="text" 
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="Ex: Vendedores, Gerentes, Administradores..."
                    className="w-full h-12 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 outline-none focus:border-indigo-500 text-sm font-medium"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setIsCreatingRole(false)} className="px-6 h-12 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-xl text-xs font-bold hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">Cancelar</button>
                  <button onClick={handleCreateRole} className="px-6 h-12 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">Salvar Grupo</button>
                </div>
              </div>
            )}

            {usersSubTab === 'list' ? (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Usuário</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">E-mail</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Grupo</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {isLoadingUsers ? (
                        <tr><td colSpan={4} className="p-8 text-center"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" /></td></tr>
                      ) : legacyUsers.length > 0 ? (
                        legacyUsers.map((u, i) => (
                          <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold uppercase">
                                  {(u[authConfig.db_email_column] || 'US').substring(0, 2)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 transition-colors">{u.nome || u.name || 'Usuário ' + u.id}</p>
                                  <p className="text-[10px] text-neutral-500">ID Local: {u.id || '-'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                              {u[authConfig.db_email_column]}
                            </td>
                            <td className="px-6 py-4">
                              <select 
                                value={userRoles.find(ur => ur.external_user_id === u.id?.toString())?.role_id || ''}
                                onChange={(e) => handleAssignRole(u.id, e.target.value)}
                                className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 outline-none w-36"
                              >
                                <option value="" disabled>Selecione um grupo</option>
                                {roles.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                                <MoreHorizontal className="w-4 h-4 text-neutral-400" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-12 text-center">
                            <Users className="w-12 h-12 text-neutral-200 dark:text-neutral-800 mx-auto mb-4" />
                            <p className="text-sm font-medium text-neutral-500">Nenhum usuário encontrado no banco legado ou CLI offline.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Permissões de Telas por Grupo</h3>
                    <p className="text-[10px] text-neutral-500">Marque quais telas cada grupo pode visualizar no menu lateral do sistema.</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-x-auto shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 min-w-[200px]">Tela / View</th>
                        {roles.map(role => (
                          <th key={role.id} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-center min-w-[120px]">
                            {role.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {uiViews.length > 0 ? uiViews.map(view => (
                        <tr key={view.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-neutral-900 dark:text-white">{view.name}</p>
                            <p className="text-[10px] text-neutral-500">/{view.slug}</p>
                          </td>
                          {roles.map(role => {
                            const hasAccess = rolePermissions.some(rp => rp.role_id === role.id && rp.view_id === view.id)
                            return (
                              <td key={role.id} className="px-6 py-4 text-center">
                                <button 
                                  onClick={() => handleTogglePermission(role.id, view.id)}
                                  className={`w-12 h-6 rounded-full transition-all relative inline-block align-middle ${hasAccess ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-800'}`}
                                >
                                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${hasAccess ? 'left-7' : 'left-1'}`} />
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={roles.length + 1} className="p-8 text-center text-sm font-medium text-neutral-500">
                            Nenhuma tela (UI View) encontrada no projeto.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </>
  )
}
