'use client'

import { useState, useEffect } from 'react'
import {
  Building2,
  Plus,
  ChevronRight,
  Pencil,
  Trash2,
  AlertCircle,
  Activity,
  Users,
  Shield,
  Mail,
  UserPlus,
  X,
  Lock,
  Send,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  ArrowUpRight,
  Monitor,
  Download,
  Network
} from 'lucide-react'
import { usePreview } from '@/contexts/PreviewContext'
import Link from 'next/link'
import { DesktopAppGeneratorModal } from '@/components/workspace/DesktopAppGeneratorModal'
import { WorkspaceTunnelControl } from '@/components/workspace/WorkspaceTunnelControl'
import { createClient } from '@/utils/supabase/client'
import { isTauri } from '@/utils/tauriUtils'
import { useToast } from '@/components/ui/Toast'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { useUpgradeModal } from '@/context/UpgradeModalContext'

interface Workspace {
  id: string
  name: string
  slug: string
  owner_id?: string
  projects?: { count: number }[]
  can_edit?: boolean
  can_delete?: boolean
  theme_config?: any
}

interface Guest {
  id: string
  user_id: string
  access_level: 'global' | 'granular'
  created_at: string
  full_name: string | null
  email: string | null
  workspaces: { workspace_id: string; user_id: string; role: string; can_create?: boolean; can_edit?: boolean; can_delete?: boolean }[]
  projects: { workspace_id: string; user_id: string; project_id: string; can_create?: boolean; can_edit?: boolean; can_deactivate?: boolean; can_delete?: boolean }[]
}

import { CheckoutClient } from '@/components/checkout/CheckoutClient'
import { TeamDrawer } from './TeamDrawer'

interface WorkspaceManagerProps {
  initialWorkspaces: Workspace[]
  userName: string
  teamData?: any | null
  rules?: any
  user?: any
  profile?: any
  isGuest?: boolean
  initialGuestAccessLevel?: 'global' | 'granular' | null
}

export function WorkspaceManager({
  initialWorkspaces,
  userName,
  teamData,
  rules,
  user,
  profile,
  isGuest = false,
  initialGuestAccessLevel = null
}: WorkspaceManagerProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [formData, setFormData] = useState({ name: '', slug: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [navigatingSlug, setNavigatingSlug] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'workspaces' | 'tunnel'>('workspaces')

  // Team management states
  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showDesktopModal, setShowDesktopModal] = useState(false)
  const [selectedDesktopWorkspace, setSelectedDesktopWorkspace] = useState<Workspace | null>(null)
  const [exportingWorkspaceId, setExportingWorkspaceId] = useState<string | null>(null)
  const { openPreview } = usePreview()

  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { t } = useI18n()

  const canCreateWorkspace = !isGuest || initialGuestAccessLevel === 'global'
  const { openUpgrade } = useUpgradeModal()

  // Free tier: subscription_tier is computed column on profiles
  const tier = profile?.subscription_tier as 'pro' | 'free' | undefined
  const isFreeTier = !tier || tier === 'free'

  const handleNewWorkspace = () => {
    // If free tier and already has at least 1 workspace → show upgrade modal
    if (isFreeTier && workspaces.length >= 1) {
      openUpgrade('Novo Workspace')
      return
    }
    openDrawer()
  }

  useEffect(() => {
    if (searchParams.get('tab') === 'team') {
      setIsTeamDrawerOpen(true)
    } else if (searchParams.get('tab') === 'tunnel') {
      setActiveTab('tunnel')
    }
    if (searchParams.get('action') === 'new' && canCreateWorkspace) {
      openDrawer()
      const newUrl = pathname
      window.history.replaceState({}, '', newUrl)
    }
    // Reset loading state when page has loaded (in case we come back)
    setNavigatingSlug(null)
  }, [searchParams, pathname, canCreateWorkspace])





  const openDrawer = (workspace: Workspace | null = null) => {
    setSelectedWorkspace(workspace)
    setFormData(workspace ? { name: workspace.name, slug: workspace.slug } : { name: '', slug: '' })
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setSelectedWorkspace(null)
    setFormData({ name: '', slug: '' })
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')

      if (selectedWorkspace) {
        // Edit
        const { error } = await supabase
          .from('workspaces')
          .update({ name: formData.name, slug: formData.slug.toLowerCase() })
          .eq('id', selectedWorkspace.id)

        if (error) throw error
      } else {
        // Create
        const { error } = await supabase
          .from('workspaces')
          .insert({
            name: formData.name,
            slug: formData.slug.toLowerCase(),
            owner_id: user.id
          })

        if (error) throw error
      }

      // Refresh data
      const { data } = await supabase
        .from('workspaces')
        .select('*, projects(count)')
        .order('created_at', { ascending: false })

      setWorkspaces(data || [])
      closeDrawer()
      router.refresh()
    } catch (err: any) {
      // RLS blocked the insert — free tier limit reached
      if (!selectedWorkspace && err?.code === '42501') {
        openUpgrade('Novo Workspace')
        closeDrawer()
      } else {
        toast(err.message, 'error')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteModal = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setIsDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedWorkspace) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', selectedWorkspace.id)

      toast(t('dashboard.toasts.workspace_deleted'), 'success')
      setWorkspaces(workspaces.filter(w => w.id !== selectedWorkspace.id))
      setIsDeleteModalOpen(false)
      setSelectedWorkspace(null)
    } catch (err: any) {
      toast(err.message || t('dashboard.toasts.delete_error'), 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportWorkspace = async (e: React.MouseEvent, workspace: Workspace) => {
    e.preventDefault()
    e.stopPropagation()
    setExportingWorkspaceId(workspace.id)
    
    try {
      const response = await fetch('/api/export-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: workspace.id })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Erro ao exportar workspace')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${workspace.slug || 'workspace'}-full-source.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast('Workspace exportado com sucesso!', 'success')
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao exportar workspace', 'error')
    } finally {
      setExportingWorkspaceId(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Banner de Boas Vindas */}
      <div className="relative py-6 px-12 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden group shadow-sm dark:shadow-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-600/10 transition-all duration-700"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
              {t('dashboard.admin_panel')}
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight text-neutral-900 dark:text-white">
              {t('dashboard.welcome')}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400 dark:from-white dark:to-neutral-500">{userName}</span>
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed">
              {t('dashboard.manage_workspaces')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Só exibe para owner ou convidado com Acesso Global */}
            {teamData && (!isGuest || initialGuestAccessLevel === 'global') && (
              <button
                onClick={() => setIsTeamDrawerOpen(true)}
                className="flex items-center gap-2 px-7 py-3 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all shadow-sm text-sm border border-neutral-200 dark:border-neutral-700 whitespace-nowrap active:scale-95"
              >
                <Users className="w-5 h-5" /> Gerenciar Equipe
              </button>
            )}
            {canCreateWorkspace && (
              <button
                onClick={handleNewWorkspace}
                className="flex items-center gap-2 px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] whitespace-nowrap text-sm active:scale-95"
              >
                <Plus className="w-5 h-5" /> {t('dashboard.new_workspace')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: t('dashboard.stats.active_workspaces'), value: workspaces.length, icon: Building2, color: 'blue' },
          { label: t('dashboard.stats.total_projects'), value: workspaces.reduce((acc, w) => acc + (w.projects?.[0]?.count || 0), 0), icon: Activity, color: 'indigo' },
          { label: t('dashboard.stats.bandwidth'), value: '1.2 GB', icon: Activity, color: 'green' }
        ].map((stat, i) => (
          <div key={i} className="p-4 bg-white dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between shadow-sm dark:shadow-none">
            <div>
              <p className="text-neutral-500 text-[11px] font-medium uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black mt-0.5 text-neutral-900 dark:text-white">{stat.value}</p>
            </div>
            <div className={`p-3.5 rounded-xl border ${stat.color === 'blue' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
              stat.color === 'indigo' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' :
                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      <section className="space-y-6">
        {isTauri() && (
          <div className="flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 px-2 mt-4">
            <button
              onClick={() => setActiveTab('workspaces')}
              className={cn(
                "px-4 py-3 text-sm font-bold transition-all border-b-2",
                activeTab === 'workspaces' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400" 
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              )}
            >
              Seus Workspaces
            </button>
            <button
              onClick={() => setActiveTab('tunnel')}
              className={cn(
                "px-4 py-3 text-sm font-bold transition-all border-b-2",
                activeTab === 'tunnel' 
                  ? "border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400" 
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              )}
            >
              Gerenciador do Túnel
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-3">
            {activeTab === 'workspaces' ? (
              <>
                <Building2 className="w-6 h-6 text-indigo-500" />
                {t('dashboard.your_workspaces')}
              </>
            ) : (
              <>
                <Network className="w-6 h-6 text-indigo-500" />
                Gerenciador do Túnel
              </>
            )}
          </h3>
          {activeTab === 'workspaces' && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors group"
              title="Atualizar"
            >
              <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 ease-out", isRefreshing ? "animate-spin" : "group-hover:rotate-180")} />
            </button>
          )}
        </div>

        {activeTab === 'tunnel' && isTauri() ? (
        <WorkspaceTunnelControl workspaceSlug="global" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {workspaces.map((workspace) => {
            const isNavigating = navigatingSlug === workspace.slug;
            return (
              <div
                key={workspace.id}
                className={cn(
                  "group relative bg-white dark:bg-neutral-950 border rounded-[2.5rem] transition-all duration-500 overflow-hidden shadow-sm hover:shadow-xl dark:shadow-none",
                  isNavigating
                    ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/20 shadow-lg scale-[0.98] pointer-events-none"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50"
                )}
              >
                {/* Efeito de Glow no Hover */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 blur-[60px] group-hover:bg-indigo-600/20 transition-all"></div>

                <div className="p-6 h-full flex flex-col justify-between gap-6 relative z-10">
                  <div className="flex justify-between items-start">
                    <Link
                      href={`/admin/${workspace.slug}`}
                      onClick={() => setNavigatingSlug(workspace.slug)}
                      className="flex flex-col gap-4 flex-1 min-w-0"
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center border transition-all shrink-0",
                        isNavigating
                          ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-500"
                          : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20"
                      )}>
                        {isNavigating ? (
                          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                        ) : (
                          <Building2 className="w-6 h-6 text-neutral-400 group-hover:text-indigo-400" />
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 w-full min-w-0">
                        <h4 className="text-lg font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-white transition-colors truncate">{workspace.name}</h4>
                        <p className="text-xs text-neutral-500 font-mono truncate">/{workspace.slug}</p>
                      </div>
                    </Link>

                    {/* Exibe para quem tem permissão de editar ou excluir, ou se portal estiver habilitado */}
                    {!isNavigating && (workspace.can_edit || workspace.can_delete || workspace.theme_config?.portal_enabled) && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {workspace.theme_config?.portal_enabled && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                openPreview(`${window.location.origin}/${workspace.slug}`, `Portal: ${workspace.name}`)
                              }}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-indigo-500 hover:text-indigo-400"
                              title="Acessar Portal"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDesktopWorkspace(workspace);
                                setShowDesktopModal(true);
                              }}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-emerald-500 hover:text-emerald-400"
                              title="Gerar App Desktop Nativo"
                            >
                              <Monitor className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {workspace.can_edit && (
                          <>
                            <button
                              onClick={(e) => handleExportWorkspace(e, workspace)}
                              disabled={exportingWorkspaceId === workspace.id}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-indigo-500 disabled:opacity-50"
                              title="Exportar Código Fonte (Next.js)"
                            >
                              {exportingWorkspaceId === workspace.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                openDrawer(workspace)
                              }}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-indigo-400"
                              title={t('dashboard.edit_workspace')}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {workspace.can_delete && (
                          <button
                            onClick={() => openDeleteModal(workspace)}
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-red-400"
                            title={t('dashboard.delete_workspace')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/admin/${workspace.slug}`}
                    onClick={() => setNavigatingSlug(workspace.slug)}
                    className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800/50"
                  >
                    <span className="text-xs font-bold text-neutral-500 tracking-tighter">
                      {workspace.projects?.[0]?.count || 0} {t('dashboard.projects_count')}
                    </span>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      isNavigating
                        ? "bg-indigo-600 animate-pulse"
                        : "bg-neutral-100 dark:bg-neutral-800 group-hover:bg-indigo-600"
                    )}>
                      {isNavigating ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white" />
                      )}
                    </div>
                  </Link>
                </div>
              </div>
            );
          })}


          {/* Add New Card */}
          {canCreateWorkspace && (
            <button
              onClick={handleNewWorkspace}
              className="group p-8 bg-neutral-50 dark:bg-neutral-950 border border-dashed border-neutral-300 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:bg-white dark:hover:bg-neutral-800 hover:border-indigo-500/30 transition-all min-h-[280px] shadow-inner dark:shadow-none"
            >
              <div className="w-16 h-16 bg-white dark:bg-neutral-950 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm dark:shadow-none">
                <Plus className="w-8 h-8 text-neutral-400 group-hover:text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="font-bold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">{t('dashboard.new_workspace')}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">{t('dashboard.create_environment')}</p>
              </div>
            </button>
          )}
        </div>
        </>
      )}
      </section>

      {/* Drawer para Criar/Editar */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={selectedWorkspace ? t('dashboard.edit_workspace') : t('dashboard.new_workspace')}
      >
        <form onSubmit={handleSave} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.workspace_name')}</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value, slug: selectedWorkspace ? formData.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                placeholder="Ex: Minha Empresa"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.slug_url')}</label>
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                <span className="text-neutral-400 dark:text-neutral-600 text-sm">/</span>
                <input
                  required
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                  placeholder="minha-empresa"
                  className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none text-neutral-900 dark:text-white"
                />
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-600">{t('dashboard.slug_hint')}</p>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-900">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
            >
              {isSaving ? t('common.loading') : selectedWorkspace ? t('common.save') : t('dashboard.new_workspace')}
            </button>
          </div>
        </form>
      </Drawer>

      {/* Modal de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('dashboard.confirm_delete')}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-500">{t('dashboard.confirm_delete')}</p>
              <p className="text-xs text-neutral-500 mt-1">{t('dashboard.delete_desc')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
            >
              {isDeleting ? t('common.loading') : t('dashboard.yes_delete')}
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </Modal>

      <TeamDrawer 
        isOpen={isTeamDrawerOpen} 
        onClose={() => setIsTeamDrawerOpen(false)}
        onRequestSubscriptionUpdate={() => setIsCheckoutModalOpen(true)}
      />

      {/* Modal de Checkout / Assinaturas */}
      {isCheckoutModalOpen && rules && (
        <Modal
          isOpen={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          title="Assinatura MetaBuilder PRO"
          size="4xl"
        >
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <CheckoutClient
              rules={rules}
              user={user}
              profile={profile}
            />
          </div>
        </Modal>
      )}

      {/* Modal Desktop App */}
      {selectedDesktopWorkspace && (
        <DesktopAppGeneratorModal
          isOpen={showDesktopModal}
          onClose={() => {
            setShowDesktopModal(false)
            setSelectedDesktopWorkspace(null)
          }}
          contextType="workspace"
          contextId={selectedDesktopWorkspace.id}
          defaultName={selectedDesktopWorkspace.name}
          defaultDescription="Portal de Aplicações do Workspace"
          defaultTunnelUrl={typeof window !== 'undefined' ? `${window.location.origin}/${selectedDesktopWorkspace.slug}` : ''}
        />
      )}
    </div>
  )
}
