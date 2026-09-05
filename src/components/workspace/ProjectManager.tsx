'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Settings,
  RefreshCw,
  Layers,
  Bot
} from 'lucide-react'
import { AIBuilderSettings } from './AIBuilderSettings'
import { createClient } from '@/utils/supabase/client'
import { usePreview } from '@/contexts/PreviewContext'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { useIDE } from '@/contexts/IDESyncContext'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { isTauri } from '@/utils/tauriUtils'
import { DesktopAppGeneratorModal } from '@/components/workspace/DesktopAppGeneratorModal'
import { useUpgradeModal } from '@/context/UpgradeModalContext'
import { WorkspaceTunnelControl } from '@/components/workspace/WorkspaceTunnelControl'
import { WorkspaceSyncedDatabases } from '@/components/workspace/WorkspaceSyncedDatabases'

import { Project } from './project-manager/types'
import { ProjectCard } from './project-manager/ProjectCard'
import { ProjectFormDrawer, ProjectFormData } from './project-manager/ProjectFormDrawer'
import { ProjectDeleteModal } from './project-manager/ProjectDeleteModal'
import { WorkspacePortalModal } from './project-manager/WorkspacePortalModal'
import { ProjectExportModal } from './project-manager/ProjectExportModal'
import { useProjectExport } from './project-manager/useProjectExport'

interface ProjectManagerProps {
  initialProjects: Project[]
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
  canCreate?: boolean
  canDelete?: boolean
  /** Exibe o botão "Equipe & Configurações". Falso para convidados com Acesso Granular. */
  showTeamSettings?: boolean
  workspaceThemeConfig?: any
  workspaceCustomDomain?: string
  tier?: 'pro' | 'free' | string
  isOwner?: boolean
}

export function ProjectManager({
  initialProjects,
  workspaceId,
  workspaceSlug,
  workspaceName,
  canCreate = true,
  canDelete = true,
  showTeamSettings = true,
  workspaceThemeConfig = {},
  workspaceCustomDomain = '',
  tier = 'free',
  isOwner = false
}: ProjectManagerProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)

  // Sync state when Server Component re-renders with fresh data after router.refresh()
  useEffect(() => {
    setProjects(initialProjects)
  }, [initialProjects])

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    slug: '',
    description: '',
    icon: '',
    is_active: true,
    show_in_portal: false,
    login_logo_url: '',
    login_banner_url: ''
  })

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [navigatingSlug, setNavigatingSlug] = useState<string | null>(null)
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)

  const [showDesktopModal, setShowDesktopModal] = useState(false)
  const [selectedDesktopProject, setSelectedDesktopProject] = useState<Project | null>(null)

  const [isWorkspaceSettingsModalOpen, setIsWorkspaceSettingsModalOpen] = useState(false)
  const [workspaceFormData, setWorkspaceFormData] = useState({
    portal_logo_url: workspaceThemeConfig?.portal_logo_url || '',
    portal_banner_url: workspaceThemeConfig?.portal_banner_url || ''
  })
  const [isSavingWorkspaceSettings, setIsSavingWorkspaceSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'projects' | 'tunnel' | 'synced-dbs'>('projects')

  const { openUpgrade } = useUpgradeModal()
  const { downloadModal, setDownloadModal, exportModels, openExportModal, handleStartExport } = useProjectExport()

  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { openPreview } = usePreview()
  const { openIDE } = useIDE()
  const pathname = usePathname()
  const { t } = useI18n()
  const { toast } = useToast()

  const handleNewProject = () => {
    if (tier === 'free' && projects.length >= 1) {
      openUpgrade('Novo Projeto')
      return
    }
    openDrawer()
  }

  useEffect(() => {
    setNavigatingSlug(null)
    if (searchParams.get('action') === 'new' && canCreate) {
      openDrawer()
      const newUrl = pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams, pathname, canCreate])

  const openDrawer = (project: Project | null = null) => {
    setSelectedProject(project)
    setFormData(
      project
        ? {
            name: project.name,
            slug: project.slug,
            description: project.description || '',
            icon: project.icon || '',
            is_active: project.is_active,
            show_in_portal: project.theme_config?.show_in_portal || false,
            login_logo_url: project.theme_config?.login_logo_url || '',
            login_banner_url: project.theme_config?.login_banner_url || ''
          }
        : {
            name: '',
            slug: '',
            description: '',
            icon: '',
            is_active: true,
            show_in_portal: false,
            login_logo_url: '',
            login_banner_url: ''
          }
    )
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setSelectedProject(null)
    setFormData({
      name: '',
      slug: '',
      description: '',
      icon: '',
      is_active: true,
      show_in_portal: false,
      login_logo_url: '',
      login_banner_url: ''
    })
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
      if (selectedProject) {
        // Edit
        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            slug: formData.slug.toLowerCase(),
            description: formData.description,
            icon: formData.icon,
            is_active: formData.is_active,
            theme_config: {
              ...(selectedProject ? selectedProject.theme_config : { enable_downloads: true }),
              show_in_portal: formData.show_in_portal,
              login_logo_url: formData.login_logo_url,
              login_banner_url: formData.login_banner_url
            }
          })
          .eq('id', selectedProject.id)

        if (error) throw error
      } else {
        // Create
        const { data: newProject, error } = await supabase
          .from('projects')
          .insert({
            name: formData.name,
            slug: formData.slug.toLowerCase(),
            description: formData.description,
            icon: formData.icon,
            workspace_id: workspaceId,
            is_active: true,
            theme_config: {
              enable_downloads: true,
              show_in_portal: formData.show_in_portal,
              login_logo_url: formData.login_logo_url,
              login_banner_url: formData.login_banner_url
            }
          })
          .select('id')
          .single()

        if (error) throw error

        if (newProject) {
          const { error: viewError } = await supabase
            .from('ui_views')
            .upsert(
              {
                project_id: newProject.id,
                model_id: null,
                name: 'Central de Downloads',
                slug: 'downloads',
                logic_type: 'personalizado',
                view_type: 'advanced_use_case',
                layout_config: { is_active: true }
              },
              { onConflict: 'project_id, slug' }
            )
          if (viewError) {
            console.error('Error inserting default downloads view:', viewError)
          }
        }
      }

      closeDrawer()
      router.refresh()
    } catch (err: any) {
      console.error(err)
      if (!selectedProject && err?.code === '42501') {
        openUpgrade('Novo Projeto')
        closeDrawer()
      } else {
        toast(err.message || 'Erro ao salvar o projeto', 'error')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const openDeleteModal = (project: Project) => {
    setSelectedProject(project)
    setIsDeleteModalOpen(true)
  }

  const handleDelete = async () => {
    if (!selectedProject) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', selectedProject.id)

      if (error) throw error

      setProjects(projects.filter(p => p.id !== selectedProject.id))
      setIsDeleteModalOpen(false)
      setSelectedProject(null)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao excluir o projeto', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const saveWorkspaceSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingWorkspaceSettings(true)

    const newThemeConfig = {
      ...(workspaceThemeConfig || {}),
      portal_logo_url: workspaceFormData.portal_logo_url,
      portal_banner_url: workspaceFormData.portal_banner_url
    }

    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          theme_config: newThemeConfig
        })
        .eq('id', workspaceId)

      if (error) throw error

      toast('Configurações do Workspace salvas com sucesso', 'success')
      setIsWorkspaceSettingsModalOpen(false)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao salvar configurações', 'error')
    } finally {
      setIsSavingWorkspaceSettings(false)
    }
  }

  const toggleProjectPortal = async (project: Project) => {
    const newStatus = !project.theme_config?.show_in_portal
    const newThemeConfig = { ...(project.theme_config || {}), show_in_portal: newStatus }
    try {
      const { error } = await supabase
        .from('projects')
        .update({ theme_config: newThemeConfig })
        .eq('id', project.id)

      if (error) throw error
      setProjects(projects.map(p => (p.id === project.id ? { ...p, theme_config: newThemeConfig } : p)))
      toast(newStatus ? 'Projeto adicionado ao Portal' : 'Projeto removido do Portal', 'success')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao atualizar projeto', 'error')
    }
  }

  const toggleActive = async (project: Project) => {
    const newStatus = !project.is_active

    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: newStatus })
        .eq('id', project.id)

      if (error) throw error

      setProjects(projects.map(p => (p.id === project.id ? { ...p, is_active: newStatus } : p)))
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao alterar status do projeto', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner de Boas Vindas */}
      <div className="relative py-6 px-12 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] overflow-hidden group shadow-sm dark:shadow-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-600/10 transition-all duration-700" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
              {t('dashboard.active_environment')}
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight text-neutral-900 dark:text-white">
              {t('dashboard.projects.title')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400 dark:from-white dark:to-neutral-500">
                {workspaceName}
              </span>
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-base leading-relaxed">
              {t('dashboard.projects.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isOwner && tier === 'pro' && (
              <button
                onClick={() => setIsAIModalOpen(true)}
                className="flex items-center justify-center w-12 h-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 rounded-2xl transition-all shadow-sm group relative"
                title="Configurações AI Builder"
              >
                <Bot className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            )}
            {canCreate && (
              <button
                onClick={handleNewProject}
                className="flex items-center gap-2 px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_30px_rgba(79,70,229,0.3)] whitespace-nowrap text-sm"
              >
                <Plus className="w-5 h-5" /> {t('dashboard.projects.new_project')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-neutral-200 dark:border-neutral-800 px-2 pt-2">
        <button
          onClick={() => setActiveTab('projects')}
          className={cn(
            'pb-3 text-sm font-bold transition-all relative',
            activeTab === 'projects'
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
          )}
        >
          {t('workspace_components.tabs_your_workspaces', 'Projetos do Ecossistema')}
          {activeTab === 'projects' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.5)]" />
          )}
        </button>
        {isTauri() && (
          <>
            <button
              onClick={() => setActiveTab('tunnel')}
              className={cn(
                'pb-3 text-sm font-bold transition-all relative',
                activeTab === 'tunnel'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              )}
            >
              {t('workspace_components.tabs_tunnel_manager', 'Gerenciador do Túnel')}
              {activeTab === 'tunnel' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.5)]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('synced-dbs')}
              className={cn(
                'pb-3 text-sm font-bold transition-all relative',
                activeTab === 'synced-dbs'
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
              )}
            >
              {t('workspace_components.tabs_synced_dbs', 'Bancos Sincronizados')}
              {activeTab === 'synced-dbs' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.5)]" />
              )}
            </button>
          </>
        )}
      </div>

      {/* Grade de Projetos */}
      {activeTab === 'projects' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-3">
              <Layers className="w-6 h-6 text-indigo-500" />
              {t('dashboard.projects.your_projects')}
            </h3>
            <div className="flex items-center gap-4">
              {canCreate && projects.some(p => p.theme_config?.show_in_portal) && (
                <div className="flex items-center mr-4 border-r dark:border-neutral-800 pr-4">
                  <button
                    onClick={() => setIsWorkspaceSettingsModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-neutral-500 hover:text-indigo-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg uppercase tracking-widest transition-colors"
                    title={t('workspace_components.portal_modal.title', 'Configurações do Portal')}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {t('workspace_components.portal_modal.customize_portal_btn', 'Personalizar Portal')}
                    </span>
                  </button>
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors group"
                title={t('workspace_components.refresh_tooltip', 'Atualizar')}
              >
                <RefreshCw
                  className={cn(
                    'w-4 h-4 transition-transform duration-500 ease-out',
                    isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'
                  )}
                />
              </button>
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                {projects.length} {t('dashboard.projects.found')}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                workspaceSlug={workspaceSlug}
                tier={tier}
                isNavigating={navigatingSlug === project.slug}
                onNavigate={slug => setNavigatingSlug(slug)}
                onOpenPreview={(url, title) => openPreview(url, title)}
                onOpenDesktopModal={p => {
                  setSelectedDesktopProject(p)
                  setShowDesktopModal(true)
                }}
                onOpenIDE={p => openIDE({ type: 'project', id: p.id, name: p.name, slug: p.slug })}
                onOpenExportModal={p => openExportModal(p)}
                onTogglePortal={p => toggleProjectPortal(p)}
                onToggleActive={p => toggleActive(p)}
                onEdit={p => openDrawer(p)}
                onDelete={p => openDeleteModal(p)}
              />
            ))}

            {/* Add New Card */}
            {canCreate && (
              <button
                onClick={handleNewProject}
                className="p-8 bg-neutral-50 dark:bg-neutral-950 border-2 border-dashed border-neutral-300 dark:border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:bg-white dark:hover:bg-neutral-800 hover:border-indigo-500/30 transition-all group min-h-[250px] shadow-inner dark:shadow-none"
              >
                <div className="w-16 h-16 bg-white dark:bg-neutral-950 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm dark:shadow-none">
                  <Plus className="w-8 h-8 text-neutral-400 group-hover:text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">
                    {t('dashboard.projects.create_project_title')}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">
                    {t('dashboard.projects.create_project_desc')}
                  </p>
                </div>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Gerenciador do Túnel */}
      {activeTab === 'tunnel' && (
        <section className="space-y-6 pt-4">
          <WorkspaceTunnelControl workspaceSlug={workspaceSlug} />
        </section>
      )}

      {/* Bancos Sincronizados */}
      {activeTab === 'synced-dbs' && (
        <section className="space-y-6 pt-4">
          <WorkspaceSyncedDatabases workspaceId={workspaceId} />
        </section>
      )}

      {/* Drawer para Criar/Editar */}
      <ProjectFormDrawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        selectedProject={selectedProject}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        isSaving={isSaving}
      />

      {/* Modal de Exclusão */}
      <ProjectDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDelete={handleDelete}
        isDeleting={isDeleting}
      />

      {/* Modal de Configurações do Workspace (Portal e Domínio) */}
      <WorkspacePortalModal
        isOpen={isWorkspaceSettingsModalOpen}
        onClose={() => setIsWorkspaceSettingsModalOpen(false)}
        formData={workspaceFormData}
        setFormData={setWorkspaceFormData}
        onSave={saveWorkspaceSettings}
        isSaving={isSavingWorkspaceSettings}
      />

      {/* Modal Desktop App */}
      {selectedDesktopProject && (
        <DesktopAppGeneratorModal
          isOpen={showDesktopModal}
          onClose={() => {
            setShowDesktopModal(false)
            setSelectedDesktopProject(null)
          }}
          contextType="project"
          contextId={selectedDesktopProject.id}
          defaultName={selectedDesktopProject.name}
          defaultDescription={selectedDesktopProject.description || ''}
          defaultTunnelUrl={
            typeof window !== 'undefined'
              ? `${window.location.origin}/${workspaceSlug}/${selectedDesktopProject.slug}?standalone=true`
              : ''
          }
        />
      )}

      {/* Source Code Download Progress Modal */}
      {downloadModal?.open && (
        <ProjectExportModal
          modalState={downloadModal}
          onClose={() => setDownloadModal(null)}
          onStartExport={handleStartExport}
          exportModels={exportModels}
        />
      )}

      {/* AI Builder Modal */}
      <Modal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} title="Configurações IA">
        <div className="p-2">
          <AIBuilderSettings workspaceId={workspaceId} isPro={tier === 'pro'} />
        </div>
      </Modal>
    </div>
  )
}
