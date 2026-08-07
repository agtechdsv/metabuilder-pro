'use client'

import { useState, useEffect } from 'react'
import {
  Database,
  Plus,
  ChevronRight,
  Pencil,
  Trash2,
  AlertCircle,
  Activity,
  Layers,
  Power,
  PowerOff,
  Settings,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  Monitor,
  Download,
  CheckCircle,
  X,
  FolderOpen,
  Copy,
  Bot
} from 'lucide-react'
import { AIBuilderSettings } from './AIBuilderSettings'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import { usePreview } from '@/contexts/PreviewContext'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'
import { IconPicker } from '@/components/studio/IconPicker'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { isTauri, openExternalUrl } from '@/utils/tauriUtils'
import { DesktopAppGeneratorModal } from '@/components/workspace/DesktopAppGeneratorModal'
import { useUpgradeModal } from '@/context/UpgradeModalContext'
import { ProGate } from '@/components/ui/ProGate'
import { WorkspaceTunnelControl } from '@/components/workspace/WorkspaceTunnelControl'
import { WorkspaceSyncedDatabases } from '@/components/workspace/WorkspaceSyncedDatabases'
interface Project {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  is_active: boolean
  workspace_id: string
  models?: { count: number }[]
  can_create?: boolean
  can_edit?: boolean
  can_deactivate?: boolean
  can_delete?: boolean
  theme_config?: any
}

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
  const [formData, setFormData] = useState({ name: '', slug: '', description: '', icon: '', is_active: true, show_in_portal: false, login_logo_url: '', login_banner_url: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [navigatingSlug, setNavigatingSlug] = useState<string | null>(null)
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  
  const [showDesktopModal, setShowDesktopModal] = useState(false)
  const [selectedDesktopProject, setSelectedDesktopProject] = useState<Project | null>(null)
  const [portalEnabled, setPortalEnabled] = useState(workspaceThemeConfig?.portal_enabled || false)
  const [isTogglingPortal, setIsTogglingPortal] = useState(false)
  
  const [isWorkspaceSettingsModalOpen, setIsWorkspaceSettingsModalOpen] = useState(false)
  const [workspaceFormData, setWorkspaceFormData] = useState({
    portal_logo_url: workspaceThemeConfig?.portal_logo_url || '',
    portal_banner_url: workspaceThemeConfig?.portal_banner_url || ''
  })
  const [isSavingWorkspaceSettings, setIsSavingWorkspaceSettings] = useState(false)
  const [activeTab, setActiveTab] = useState<'projects' | 'tunnel' | 'synced-dbs'>('projects')

  const [downloadModal, setDownloadModal] = useState<{
    open: boolean
    phase: 'selecting' | 'downloading' | 'done' | 'error'
    fileName: string
    progress: number
    savedPath: string
    savedDir: string
    projectId?: string
    authConfig?: any
  } | null>(null)

  const { openUpgrade } = useUpgradeModal()

  const handleNewProject = () => {
    if (tier === 'free' && projects.length >= 1) {
      openUpgrade('Novo Projeto')
      return
    }
    openDrawer()
  }

  const [exportTab, setExportTab] = useState<'database' | 'auth'>('database')
  const [exportDataMode, setExportDataMode] = useState<'tunnel' | 'supabase' | 'postgres'>('supabase')
  const [exportAuthStrategy, setExportAuthStrategy] = useState<'managed' | 'legacy' | 'ldap' | 'none'>('none')
  const [exportLegacyDriver, setExportLegacyDriver] = useState<'supabase' | 'postgres'>('supabase')
  const [exportTunnelUrl, setExportTunnelUrl] = useState('')
  const [exportDbType, setExportDbType] = useState<'supabase' | 'postgres'>('supabase')
  const [exportDbUser, setExportDbUser] = useState('user')
  const [exportDbPassword, setExportDbPassword] = useState('password')
  const [exportDbHost, setExportDbHost] = useState('localhost')
  const [exportDbPort, setExportDbPort] = useState('5432')
  const [exportDbName, setExportDbName] = useState('dataBase')
  const [exportSupaUrl, setExportSupaUrl] = useState('')
  const [exportSupaAnonKey, setExportSupaAnonKey] = useState('')
  const [exportAuthTableName, setExportAuthTableName] = useState('usuarios')
  const [exportAuthEmailCol, setExportAuthEmailCol] = useState('email')
  const [exportAuthPassCol, setExportAuthPassCol] = useState('senha')
  const [exportAuthHash, setExportAuthHash] = useState('Bcrypt')
  const [exportModels, setExportModels] = useState<any[]>([])

  const handleOpenFolder = async (dir: string, fileFullPath: string) => {
    try {
      if (fileFullPath) {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
        await revealItemInDir(fileFullPath)
      } else {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      }
    } catch (e) {
      console.error('Não foi possível abrir o explorador:', e)
      try {
        const { openPath } = await import('@tauri-apps/plugin-opener')
        await openPath(dir)
      } catch {}
    }
  }

  const handleStartExport = async (projectId: string, fileName: string, dataMode: string, authStrategy: string, legacyDriver: string, dbConfig?: any, authConfig?: any) => {
    setDownloadModal({
      open: true,
      phase: 'downloading',
      fileName,
      progress: 0,
      savedPath: '',
      savedDir: '',
      projectId
    })

    try {
      const res = await fetch('/api/export-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, dataMode, authStrategy, legacyDriver, dbConfig, authConfig })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao gerar código')
      }
      
      const contentLength = Number(res.headers.get('content-length') || 0)
      const reader = res.body!.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        const pct = contentLength > 0 ? Math.min(Math.round((received / contentLength) * 100), 99) : 0
        setDownloadModal(prev => prev ? { ...prev, progress: pct } : prev)
      }

      const total = chunks.reduce((a, c) => a + c.length, 0)
      const merged = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }

      if (isTauri()) {
        const { open } = await import('@tauri-apps/plugin-dialog')
        const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs')
        const { join, dirname } = await import('@tauri-apps/api/path')
        const { Command } = await import('@tauri-apps/plugin-shell')
        const JSZip = (await import('jszip')).default

        const selectedDir = await open({ directory: true })
        if (!selectedDir || typeof selectedDir !== 'string') {
           setDownloadModal(null)
           return
        }

        setDownloadModal(prev => prev ? { ...prev, phase: 'selecting', progress: 100 } : prev)
        toast('Extraindo projeto...', 'info')

        const zip = await JSZip.loadAsync(merged)
        
        for (const relativePath of Object.keys(zip.files)) {
          const zipEntry = zip.files[relativePath]
          if (zipEntry.dir) continue
          
          const fullPath = await join(selectedDir, relativePath)
          const dirPath = await dirname(fullPath)
          
          try {
            await mkdir(dirPath, { recursive: true })
          } catch (e) {}

          const fileBytes = await zipEntry.async('uint8array')
          await writeFile(fullPath, fileBytes)
        }

        toast('Instalando dependências (npm install)...', 'info')
        const cmd = Command.create('npm', ['install'], { cwd: selectedDir })
        const output = await cmd.execute()
        if (output.code !== 0) {
          console.error('NPM Install failed:', output.stderr)
          toast('As dependências foram instaladas com erros, verifique o terminal.', 'error')
        } else {
          toast('Dependências instaladas com sucesso!', 'success')
          try {
            const { sendNotification } = await import('@tauri-apps/plugin-notification')
            sendNotification({ 
              title: t('ide.project.eject_notif_title', 'Projeto Ejetado! 🎉'), 
              body: t('ide.project.eject_notif_body', 'Os arquivos e dependências foram instalados com sucesso.') 
            })
          } catch (err) { console.error('Native notification error', err) }
        }

        setDownloadModal({
          open: true,
          phase: 'done',
          fileName,
          progress: 100,
          savedPath: selectedDir,
          savedDir: selectedDir
        })

        if (confirm('Projeto ejetado e dependências instaladas! Deseja abrir no VS Code?')) {
           const codeCmd = Command.create('code', ['.'], { cwd: selectedDir })
           await codeCmd.execute()
        }

      } else {
        const blob = new Blob([merged], { type: 'application/zip' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)

        setDownloadModal({
          open: true,
          phase: 'done',
          fileName,
          progress: 100,
          savedPath: '',
          savedDir: 'Downloads'
        })
      }
    } catch (error: any) {
      setDownloadModal(prev => prev ? { ...prev, phase: 'error', progress: 0 } : null)
      toast('Falha na exportação: ' + error.message, 'error')
    }
  }

  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { openPreview } = usePreview()
  const pathname = usePathname()
  const { t } = useI18n()
  const { toast } = useToast()

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
    setFormData(project
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
      : { name: '', slug: '', description: '', icon: '', is_active: true, show_in_portal: false, login_logo_url: '', login_banner_url: '' }
    )
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setSelectedProject(null)
    setFormData({ name: '', slug: '', description: '', icon: '', is_active: true, show_in_portal: false, login_logo_url: '', login_banner_url: '' })
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
            theme_config: { ...(selectedProject ? selectedProject.theme_config : { enable_downloads: true }), show_in_portal: formData.show_in_portal, login_logo_url: formData.login_logo_url, login_banner_url: formData.login_banner_url }
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
            theme_config: { enable_downloads: true, show_in_portal: formData.show_in_portal, login_logo_url: formData.login_logo_url, login_banner_url: formData.login_banner_url }
          })
          .select('id')
          .single()

        if (error) throw error

        if (newProject) {
          const { error: viewError } = await supabase
            .from('ui_views')
            .upsert({
              project_id: newProject.id,
              model_id: null,
              name: 'Central de Downloads',
              slug: 'downloads',
              logic_type: 'personalizado',
              view_type: 'advanced_use_case',
              layout_config: { is_active: true }
            }, { onConflict: 'project_id, slug' })
          if (viewError) {
            console.error('Error inserting default downloads view:', viewError)
          }
        }
      }

      closeDrawer()
      // Refresh the page data (which will recalculate permissions and update initialProjects)
      router.refresh()
    } catch (err: any) {
      console.error(err)
      // RLS blocked the insert — free tier limit reached
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

  const toggleWorkspacePortal = async () => {
    setIsTogglingPortal(true)
    const newStatus = !portalEnabled
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ theme_config: { ...workspaceThemeConfig, portal_enabled: newStatus } })
        .eq('id', workspaceId)

      if (error) throw error
      setPortalEnabled(newStatus)
      toast(newStatus ? 'Portal de Aplicações ativado' : 'Portal de Aplicações desativado', 'success')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'Erro ao alterar portal da workspace', 'error')
    } finally {
      setIsTogglingPortal(false)
    }
  }

  const saveWorkspaceSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingWorkspaceSettings(true)
    
    // Create new theme config combining old config with new portal settings
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
    const newStatus = !(project.theme_config?.show_in_portal)
    const newThemeConfig = { ...(project.theme_config || {}), show_in_portal: newStatus }
    try {
      const { error } = await supabase
        .from('projects')
        .update({ theme_config: newThemeConfig })
        .eq('id', project.id)

      if (error) throw error
      setProjects(projects.map(p => p.id === project.id ? { ...p, theme_config: newThemeConfig } : p))
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

      setProjects(projects.map(p => p.id === project.id ? { ...p, is_active: newStatus } : p))
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
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 blur-[100px] -mr-48 -mt-48 group-hover:bg-indigo-600/10 transition-all duration-700"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">
              {t('dashboard.active_environment')}
            </div>
            <h2 className="text-3xl font-black tracking-tight leading-tight text-neutral-900 dark:text-white">
              {t('dashboard.projects.title')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400 dark:from-white dark:to-neutral-500">{workspaceName}</span>
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
            "pb-3 text-sm font-bold transition-all relative",
            activeTab === 'projects'
              ? "text-indigo-600 dark:text-indigo-400"
              : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          )}
        >
          Projetos do Ecossistema
          {activeTab === 'projects' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.5)]"></div>
          )}
        </button>
        {isTauri() && (
          <>
            <button
              onClick={() => setActiveTab('tunnel')}
              className={cn(
                "pb-3 text-sm font-bold transition-all relative",
                activeTab === 'tunnel'
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              )}
            >
              Gerenciador do Túnel
              {activeTab === 'tunnel' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.5)]"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('synced-dbs')}
              className={cn(
                "pb-3 text-sm font-bold transition-all relative",
                activeTab === 'synced-dbs'
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              )}
            >
              Bancos Sincronizados
              {activeTab === 'synced-dbs' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full shadow-[0_-2px_10px_rgba(79,70,229,0.5)]"></div>
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
            {canCreate && (
              <div className="flex items-center gap-2 mr-4 border-r dark:border-neutral-800 pr-4">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest hidden sm:block mr-2">Portal de Aplicações</span>
                <button
                  onClick={toggleWorkspacePortal}
                  disabled={isTogglingPortal}
                  className={`w-10 h-5 rounded-full transition-all relative ${portalEnabled ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-800'} ${isTogglingPortal ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={portalEnabled ? 'Desativar Portal' : 'Ativar Portal'}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${portalEnabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
                <button
                  onClick={() => setIsWorkspaceSettingsModalOpen(true)}
                  className="p-1.5 ml-1 text-neutral-400 hover:text-indigo-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
                  title="Configurações do Portal e Domínio"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors group"
              title="Atualizar"
            >
              <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 ease-out", isRefreshing ? "animate-spin" : "group-hover:rotate-180")} />
            </button>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
              {projects.length} {t('dashboard.projects.found')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {projects.map((project) => {
            const isNavigating = navigatingSlug === project.slug;
            return (
              <div
                key={project.id}
                className={cn(
                  "group relative p-5 bg-white dark:bg-neutral-950 border rounded-[2rem] transition-all shadow-sm hover:shadow-xl dark:shadow-none",
                  isNavigating
                    ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/20 shadow-lg scale-[0.98] pointer-events-none"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/50"
                )}
              >
                <div className="flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <Link
                      href={`/admin/${workspaceSlug}/${project.slug}/studio`}
                      onClick={() => setNavigatingSlug(project.slug)}
                      className="flex flex-col gap-4 flex-1 min-w-0"
                    >
                      <div className={cn(
                        "p-3 rounded-2xl w-fit transition-colors flex items-center justify-center min-w-[48px] min-h-[48px] border shrink-0",
                        isNavigating
                          ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-500"
                          : "bg-neutral-100 dark:bg-neutral-800 border-transparent group-hover:bg-indigo-500/10"
                      )}>
                        <div className={cn(
                          "transition-colors",
                          isNavigating ? "text-indigo-500 animate-spin" : "text-neutral-400 group-hover:text-indigo-500"
                        )}>
                          {isNavigating ? (
                            <Loader2 className="w-6 h-6" />
                          ) : (
                            <DynamicIcon icon={project.icon || 'Box'} size={24} />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5 w-full min-w-0">
                        <h4 className="text-lg font-bold text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-white transition-colors truncate">{project.name}</h4>
                        <p className="text-xs text-neutral-500 font-mono mt-0.5 truncate">/{project.slug}</p>
                        {project.description && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-600 mt-2 line-clamp-2 leading-relaxed min-w-0">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </Link>

                    <div className="flex flex-col items-end gap-4">
                      <div className={`px-4 py-1.5 text-[10px] font-bold rounded-full border uppercase tracking-widest transition-all ${project.is_active
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                        }`}>
                        {project.is_active ? t('dashboard.projects.status_active') : t('dashboard.projects.status_inactive')}
                      </div>

                      {!isNavigating && (project.can_edit || project.can_deactivate || project.can_delete) && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {portalEnabled && (
                            <button
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-indigo-500 hover:text-indigo-400"
                              title="Acessar versão publicada"
                              onClick={(e) => {
                                e.stopPropagation()
                                openPreview(`${window.location.origin}/${workspaceSlug}/${project.slug}`, `Projeto: ${project.name}`)
                              }}
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                          )}
                          <ProGate gateType="desktop" tier={tier || 'free'} featureName="Gerar App Desktop Nativo">
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setSelectedDesktopProject(project)
                                setShowDesktopModal(true)
                              }}
                              className="p-2 text-indigo-500 hover:text-indigo-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                              title="Gerar App Desktop Nativo"
                            >
                              <Monitor className="w-4 h-4" />
                            </button>
                          </ProGate>
                          {project.can_edit && (
                            <ProGate gateType="desktop" tier={tier || 'free'} featureName="Exportar Código Fonte">
                              <button
                                onClick={async (e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                
                                setExportDbType('supabase')
                                setExportDbUser('postgres')
                                setExportDbPassword('senha')
                                setExportDbUser('user')
                                setExportDbPassword('password')
                                setExportDbHost('localhost')
                                setExportDbPort('5432')
                                setExportDbName(`dataBase`)
                                setExportSupaUrl('')
                                setExportSupaAnonKey('')

                                // Fetch auth config to pre-select
                                const supabase = createClient()
                                const { data: authConf } = await supabase
                                  .from('project_auth_config')
                                  .select('auth_type, auth_config')
                                  .eq('project_id', project.id)
                                  .maybeSingle()

                                const authType = authConf?.auth_type || 'none'
                                setExportAuthStrategy(
                                  authType === 'ldap' ? 'ldap' : 
                                  authType === 'legacy' ? 'legacy' : 'none'
                                )

                                setExportAuthTableName(authConf?.auth_config?.legacy?.usersTable || authConf?.auth_config?.db_table_name || 'usuarios')
                                setExportAuthEmailCol(authConf?.auth_config?.legacy?.emailColumn || authConf?.auth_config?.db_email_column || 'email')
                                setExportAuthPassCol(authConf?.auth_config?.legacy?.passwordColumn || authConf?.auth_config?.db_password_column || 'senha')
                                setExportAuthHash(authConf?.auth_config?.legacy?.passwordHash || authConf?.auth_config?.db_password_hash || 'Bcrypt')

                                const { data: models, error: modelsError } = await supabase
                                  .from('models')
                                  .select('id, db_table_name')
                                  .eq('project_id', project.id)
                                  .order('db_table_name')
                                
                                if (models && models.length > 0) {
                                  const { data: fields } = await supabase
                                    .from('fields')
                                    .select('id, db_column_name, model_id')
                                    .in('model_id', models.map(m => m.id))
                                  
                                  const mappedModels = models.map(m => ({
                                    ...m,
                                    fields: fields?.filter(f => f.model_id === m.id) || []
                                  }))
                                  setExportModels(mappedModels)
                                } else {
                                  console.error('Error fetching models:', modelsError)
                                  setExportModels([])
                                }

                                setDownloadModal({
                                  open: true,
                                  phase: 'selecting',
                                  fileName: `${project.slug || 'app'}-source-code.zip`,
                                  progress: 0,
                                  savedPath: '',
                                  savedDir: '',
                                  projectId: project.id,
                                  authConfig: authConf?.auth_config
                                })
                              }}
                              className="p-2 text-indigo-500 hover:text-indigo-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                              title="Exportar Código Fonte (Next.js)"
                            >
                              <Download className="w-4 h-4" />
                              </button>
                            </ProGate>
                          )}
                          {portalEnabled && (
                            <button
                              onClick={(e) => { e.preventDefault(); toggleProjectPortal(project); }}
                              className={`p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors ${project.theme_config?.show_in_portal ? 'text-indigo-500 hover:text-indigo-600' : 'text-neutral-400 hover:text-indigo-400'}`}
                              title={project.theme_config?.show_in_portal ? 'Remover do Portal' : 'Adicionar ao Portal'}
                            >
                              <Database className="w-4 h-4" />
                            </button>
                          )}
                          {project.can_deactivate && (
                            <button
                              onClick={() => toggleActive(project)}
                              className={`p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors ${project.is_active ? 'text-neutral-500 hover:text-red-400' : 'text-neutral-500 hover:text-emerald-400'}`}
                              title={project.is_active ? t('dashboard.projects.toggle_inactive') : t('dashboard.projects.toggle_active')}
                            >
                              {project.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </button>
                          )}
                          {project.can_edit && (
                            <button
                              onClick={() => openDrawer(project)}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-indigo-400"
                              title={t('dashboard.projects.edit_project')}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {project.can_delete && (
                            <button
                              onClick={() => openDeleteModal(project)}
                              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-500 hover:text-red-400"
                              title={t('dashboard.projects.delete_project')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-neutral-100 dark:border-neutral-800/50">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-neutral-400" />
                        <span className="text-xs font-bold text-neutral-400 tracking-tighter">
                          {project.models?.[0]?.count || 0} {t('dashboard.projects.tables')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-neutral-400" />
                        <span className="text-xs font-bold text-neutral-400 tracking-tighter">
                          {t('dashboard.projects.use_cases')}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/admin/${workspaceSlug}/${project.slug}/studio`}
                      onClick={() => setNavigatingSlug(project.slug)}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm dark:shadow-none",
                        isNavigating
                          ? "bg-indigo-600 animate-pulse"
                          : "bg-neutral-100 dark:bg-neutral-800 group-hover:bg-indigo-600"
                      )}
                    >
                      {isNavigating ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-white" />
                      )}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}


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
                <p className="font-bold text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200 transition-colors">{t('dashboard.projects.create_project_title')}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-600 mt-1">{t('dashboard.projects.create_project_desc')}</p>
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
      <Drawer
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        title={selectedProject ? t('dashboard.projects.edit_project') : t('dashboard.projects.new_project')}
      >
        <form onSubmit={handleSave} className="space-y-8">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.projects.project_name')}</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value, slug: selectedProject ? formData.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                placeholder={t('dashboard.projects.name_placeholder')}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.projects.project_slug')}</label>
              <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3">
                <span className="text-neutral-400 dark:text-neutral-600 text-sm">/</span>
                <input
                  required
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') })}
                  placeholder="crm-vendas"
                  className="flex-1 bg-transparent border-none text-sm focus:ring-0 outline-none text-neutral-900 dark:text-white"
                />
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-600">{t('dashboard.slug_hint')}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.projects.project_description')}</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('dashboard.projects.desc_placeholder')}
                rows={3}
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white resize-none"
              />
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('dashboard.projects.project_icon')}</label>
              <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                  <DynamicIcon icon={formData.icon || 'Box'} size={24} />
                </div>
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(true)}
                    className="px-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all"
                  >
                    {t('dashboard.projects.change_icon')}
                  </button>
                </div>
              </div>

              {showIconPicker && (
                <IconPicker 
                  currentIcon={formData.icon || 'Box'}
                  onSelect={(icon) => setFormData({ ...formData, icon })}
                  onClose={() => setShowIconPicker(false)}
                />
              )}
            </div>

            {portalEnabled && (
              <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-6">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Portal & Branding</h4>
                  <p className="text-xs text-neutral-500">Configure a exibição deste projeto no Portal de Aplicações e a personalização da tela de login.</p>
                </div>

                <div className="flex items-center gap-3 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-xl">
                  <input
                    type="checkbox"
                    id="showInPortal"
                    checked={formData.show_in_portal}
                    onChange={(e) => setFormData({ ...formData, show_in_portal: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="showInPortal" className="text-sm font-medium text-neutral-900 dark:text-white cursor-pointer select-none">
                    Exibir no Portal de Aplicações
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">URL da Logo (Opcional)</label>
                  <input
                    type="url"
                    value={formData.login_logo_url}
                    onChange={e => setFormData({ ...formData, login_logo_url: e.target.value })}
                    placeholder="https://sua-empresa.com/logo.png"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">URL do Banner (Opcional)</label>
                  <input
                    type="url"
                    value={formData.login_banner_url}
                    onChange={e => setFormData({ ...formData, login_banner_url: e.target.value })}
                    placeholder="https://sua-empresa.com/banner.jpg"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
                  />
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-600">Recomendado: Imagem vertical ou padrão geométrico.</p>
                </div>
              </div>
            )}

            {selectedProject && (
              <div className="pt-4 flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">{t('dashboard.projects.status_title')}</p>
                  <p className="text-xs text-neutral-500">{t('dashboard.projects.status_desc')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`w-12 h-6 rounded-full transition-all relative ${formData.is_active ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-800'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_active ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-neutral-900">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
            >
              {isSaving ? t('common.loading') : selectedProject ? t('common.save') : t('dashboard.projects.new_project')}
            </button>
          </div>
        </form>
      </Drawer>

      {/* Modal de Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t('dashboard.projects.delete_project')}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-500">{t('dashboard.projects.confirm_delete_project')}</p>
              <p className="text-xs text-neutral-500 mt-1">{t('dashboard.projects.delete_project_desc')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
            >
              {isDeleting ? t('common.loading') : t('dashboard.projects.yes_delete')}
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

      {/* Modal de Configurações do Workspace (Portal e Domínio) */}
      <Modal
        isOpen={isWorkspaceSettingsModalOpen}
        onClose={() => setIsWorkspaceSettingsModalOpen(false)}
        title="Configurações do Workspace"
      >
        <form onSubmit={saveWorkspaceSettings} className="space-y-6">
          <div className="space-y-4">
            
            <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4">
              <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-1">Aparência do Portal</h4>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Personalize as imagens que serão exibidas na tela de login global do Portal de Aplicações.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Logo do Portal (Opcional)</label>
              <input
                type="url"
                value={workspaceFormData.portal_logo_url}
                onChange={e => setWorkspaceFormData({ ...workspaceFormData, portal_logo_url: e.target.value })}
                placeholder="https://sua-empresa.com/logo.png"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Banner do Portal (Opcional)</label>
              <input
                type="url"
                value={workspaceFormData.portal_banner_url}
                onChange={e => setWorkspaceFormData({ ...workspaceFormData, portal_banner_url: e.target.value })}
                placeholder="https://sua-empresa.com/banner.jpg"
                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="submit"
              disabled={isSavingWorkspaceSettings}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)]"
            >
              {isSavingWorkspaceSettings ? t('common.loading') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => setIsWorkspaceSettingsModalOpen(false)}
              className="w-full py-3.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-xl font-bold transition-all"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </Modal>

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
          defaultTunnelUrl={typeof window !== 'undefined' ? `${window.location.origin}/${workspaceSlug}/${selectedDesktopProject.slug}` : ''}
        />
      )}

      {/* Source Code Download Progress Modal */}
      {downloadModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white text-center">
              <div className="mx-auto bg-white/20 w-14 h-14 rounded-full flex items-center justify-center mb-3">
                {downloadModal.phase === 'selecting' ? (
                  <Database className="w-7 h-7 text-white animate-pulse" />
                ) : downloadModal.phase === 'done' ? (
                  <CheckCircle className="w-7 h-7 text-white" />
                ) : downloadModal.phase === 'error' ? (
                  <X className="w-7 h-7 text-white" />
                ) : (
                  <Download className="w-7 h-7 text-white" />
                )}
              </div>
              <h3 className="text-lg font-black">
                {downloadModal.phase === 'selecting' && 'Configurar Exportação'}
                {downloadModal.phase === 'downloading' && 'Baixando Código Fonte...'}
                {downloadModal.phase === 'done' && 'Download Concluído!'}
                {downloadModal.phase === 'error' && 'Erro no Download'}
              </h3>
              <p className="text-indigo-100 text-sm mt-1 truncate max-w-xs mx-auto">{downloadModal.fileName}</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Selecting Database Option */}
              {downloadModal.phase === 'selecting' && (
                <div className="space-y-4">
                  {/* Tabs */}
                  <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setExportTab('database')}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                        exportTab === 'database' 
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                          : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                      }`}
                    >
                      Banco de Dados
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportTab('auth')}
                      className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
                        exportTab === 'auth' 
                          ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
                          : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                      }`}
                    >
                      Autenticação (Login)
                    </button>
                  </div>

                  {/* Database Tab */}
                  {exportTab === 'database' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setExportDataMode('tunnel')}
                          className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                            exportDataMode === 'tunnel'
                              ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                            exportDataMode === 'tunnel' ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'
                          }`}>
                            {exportDataMode === 'tunnel' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-white">MetaBuilder Tunnel (BaaS)</p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              Conecta via Websocket ao servidor online. Ideal para Frontend Desacoplado.
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportDataMode('supabase')}
                          className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                            exportDataMode === 'supabase'
                              ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                            exportDataMode === 'supabase' ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'
                          }`}>
                            {exportDataMode === 'supabase' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-white">Supabase (Nativo)</p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              Conecta via SDK oficial do Supabase. Ideal para infraestrutura serverless na nuvem.
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportDataMode('postgres')}
                          className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                            exportDataMode === 'postgres'
                              ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                            exportDataMode === 'postgres' ? 'border-indigo-500' : 'border-neutral-300 dark:border-neutral-700'
                          }`}>
                            {exportDataMode === 'postgres' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-neutral-900 dark:text-white">PostgreSQL (Nativo - pg)</p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              Gera queries SQL diretas via driver `pg`. Ideal para hospedar localmente (on-premise) no servidor do cliente.
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Configuração Supabase Data */}
                      {exportDataMode === 'supabase' && (
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                          <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">Configuração do Supabase</p>
                          <div className="space-y-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">Supabase URL</span>
                              <input
                                type="text"
                                value={exportSupaUrl}
                                onChange={(e) => setExportSupaUrl(e.target.value)}
                                placeholder="https://your-project.supabase.co"
                                className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500 text-xs w-full font-mono"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-neutral-500 font-sans text-xs">Supabase Anon Key</span>
                              <input
                                type="text"
                                value={exportSupaAnonKey}
                                onChange={(e) => setExportSupaAnonKey(e.target.value)}
                                placeholder="your-anon-key"
                                className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500 text-xs w-full font-mono truncate"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Configuração Postgres Data */}
                      {exportDataMode === 'postgres' && (
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                          <p className="font-bold text-neutral-500 uppercase tracking-widest text-[9px]">Configuração da URL de Conexão</p>
                          <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-800/80 leading-relaxed text-xs">
                            <span className="text-neutral-500">postgresql://</span>
                            <input
                              type="text"
                              value={exportDbUser}
                              onChange={(e) => setExportDbUser(e.target.value)}
                              placeholder="user"
                              className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-16"
                              title="Usuário"
                            />
                            <span className="text-neutral-500">:</span>
                            <input
                              type="text"
                              value={exportDbPassword}
                              onChange={(e) => setExportDbPassword(e.target.value)}
                              placeholder="password"
                              className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-16"
                              title="Senha"
                            />
                            <span className="text-neutral-500">@</span>
                            <input
                              type="text"
                              value={exportDbHost}
                              onChange={(e) => setExportDbHost(e.target.value)}
                              placeholder="localhost"
                              className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-24"
                              title="Host"
                            />
                            <span className="text-neutral-500">:</span>
                            <input
                              type="text"
                              value={exportDbPort}
                              onChange={(e) => setExportDbPort(e.target.value)}
                              placeholder="5432"
                              className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-14"
                              title="Porta"
                            />
                            <span className="text-neutral-500">/</span>
                            <input
                              type="text"
                              value={exportDbName}
                              onChange={(e) => setExportDbName(e.target.value)}
                              placeholder="dataBase"
                              className="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 rounded text-center text-neutral-900 dark:text-white outline-none focus:border-indigo-500 w-32"
                              title="Nome do Banco de Dados"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Auth Tab */}
                  {exportTab === 'auth' && (
                    <div className="space-y-4 pt-4 max-h-[50vh] overflow-y-auto pr-2 pb-2">
                      <div 
                        onClick={() => setExportAuthStrategy('none')}
                        className={cn(
                          "p-4 rounded-xl border border-white/10 cursor-pointer transition-all duration-200",
                          exportAuthStrategy === 'none' ? "bg-white/10 border-white/20" : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", exportAuthStrategy === 'none' ? "border-[#5E2BFF]" : "border-gray-500")}>
                            {exportAuthStrategy === 'none' && <div className="w-2 h-2 bg-[#5E2BFF] rounded-full" />}
                          </div>
                          <span className="font-medium">Sem Autenticação</span>
                        </div>
                        <p className="text-sm text-gray-400 ml-7">
                          O app exportado não exigirá login. Middlewares de proteção serão removidos.
                        </p>
                      </div>

                      <div 
                        onClick={() => setExportAuthStrategy('legacy')}
                        className={cn(
                          "p-4 rounded-xl border border-white/10 cursor-pointer transition-all duration-200",
                          exportAuthStrategy === 'legacy' ? "bg-white/10 border-white/20" : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", exportAuthStrategy === 'legacy' ? "border-[#5E2BFF]" : "border-gray-500")}>
                            {exportAuthStrategy === 'legacy' && <div className="w-2 h-2 bg-[#5E2BFF] rounded-full" />}
                          </div>
                          <span className="font-medium">Via Banco de Dados Legado</span>
                        </div>
                        <p className="text-sm text-gray-400 ml-7 mb-4">
                          O app exportado validará o login comparando com SUA tabela de usuários sincronizada.
                        </p>
                        
                        {exportAuthStrategy === 'legacy' && (
                          <div className="ml-7 space-y-4 border-t border-white/10 pt-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-400 mb-2">Driver de Conexão do BD Legado</label>
                              <div className="flex items-center space-x-4">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    checked={exportLegacyDriver === 'supabase'} 
                                    onChange={() => setExportLegacyDriver('supabase')}
                                    className="text-[#5E2BFF] focus:ring-[#5E2BFF]"
                                  />
                                  <span className="text-xs">Supabase SDK</span>
                                </label>
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input 
                                    type="radio" 
                                    checked={exportLegacyDriver === 'postgres'} 
                                    onChange={() => setExportLegacyDriver('postgres')}
                                    className="text-[#5E2BFF] focus:ring-[#5E2BFF]"
                                  />
                                  <span className="text-xs">Driver PostgreSQL Nativo (pg)</span>
                                </label>
                              </div>
                            </div>
                            <div className="mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-3 uppercase">Mapeamento de Autenticação</p>
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="flex flex-col gap-1">
                                  <span className="text-neutral-500 font-sans text-xs">Tabela Usuários:</span>
                                  <select value={exportAuthTableName} onChange={(e) => setExportAuthTableName(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono">
                                    <option value="">Selecione a tabela...</option>
                                    {exportModels.map(m => (
                                      <option key={m.id} value={m.db_table_name}>{m.db_table_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-neutral-500 font-sans text-xs">Coluna Email:</span>
                                  <select value={exportAuthEmailCol} onChange={(e) => setExportAuthEmailCol(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono">
                                    <option value="">Selecione o campo...</option>
                                    {exportModels.find(m => m.db_table_name === exportAuthTableName)?.fields?.map((f: any) => (
                                      <option key={f.id || f.db_column_name} value={f.db_column_name}>{f.db_column_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-neutral-500 font-sans text-xs">Coluna Senha:</span>
                                  <select value={exportAuthPassCol} onChange={(e) => setExportAuthPassCol(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono">
                                    <option value="">Selecione o campo...</option>
                                    {exportModels.find(m => m.db_table_name === exportAuthTableName)?.fields?.map((f: any) => (
                                      <option key={f.id || f.db_column_name} value={f.db_column_name}>{f.db_column_name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <span className="text-neutral-500 font-sans text-xs">Formato Hash:</span>
                                  <select value={exportAuthHash} onChange={(e) => setExportAuthHash(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-900 dark:text-white outline-none focus:border-indigo-500 font-mono">
                                    <option value="Bcrypt">Bcrypt</option>
                                    <option value="Plain">Texto Puro</option>
                                    <option value="MD5">MD5</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div 
                        onClick={() => setExportAuthStrategy('ldap')}
                        className={cn(
                          "p-4 rounded-xl border border-white/10 cursor-pointer transition-all duration-200",
                          exportAuthStrategy === 'ldap' ? "bg-white/10 border-white/20" : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", exportAuthStrategy === 'ldap' ? "border-[#5E2BFF]" : "border-gray-500")}>
                            {exportAuthStrategy === 'ldap' && <div className="w-2 h-2 bg-[#5E2BFF] rounded-full" />}
                          </div>
                          <span className="font-medium">LDAP / AD</span>
                        </div>
                        <p className="text-sm text-gray-400 ml-7">
                          Integração corporativa nativa. O app gerado validará no Active Directory do cliente.
                        </p>
                        {exportAuthStrategy === 'ldap' && (
                          <div className="ml-7 mt-4 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
                              Por questões de segurança corporativa, você precisará configurar as variáveis do LDAP diretamente nas propriedades do projeto exportado.
                              No fonte exportado, preencha as variáveis em seu arquivo <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded">.env.local</code> da seguinte forma:
                            </p>
                            <div className="relative group">
                              <button onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(`# Configurações do Active Directory (LDAP)\nLDAP_URL="ldap://10.0.0.15:389"\nLDAP_BASE_DN="dc=empresa,dc=local"\nLDAP_BIND_DN="cn=metabuilder_service,ou=Services,dc=empresa,dc=local"\nLDAP_BIND_PASSWORD="senha_secreta_do_bind"\nLDAP_SEARCH_FILTER="(sAMAccountName={{username}})"`);
                              }} className="absolute top-2 right-2 p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Copiar">
                                <Copy className="w-3 h-3" />
                              </button>
                              <pre className="text-[10px] text-indigo-400 bg-neutral-950 p-3 rounded border border-neutral-800 overflow-x-auto font-mono leading-tight whitespace-pre">
{`# Configurações do Active Directory (LDAP)
LDAP_URL="ldap://10.0.0.15:389"
LDAP_BASE_DN="dc=empresa,dc=local"
LDAP_BIND_DN="cn=metabuilder_service,ou=Services,dc=empresa,dc=local"
LDAP_BIND_PASSWORD="senha_secreta_do_bind"
LDAP_SEARCH_FILTER="(sAMAccountName={{username}})"`}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2.5 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={() => handleStartExport(
                        downloadModal.projectId!, 
                        downloadModal.fileName, 
                        exportDataMode, 
                        exportAuthStrategy,
                        exportLegacyDriver,
                        exportDataMode === 'postgres' ? {
                          user: exportDbUser,
                          password: exportDbPassword,
                          host: exportDbHost,
                          port: exportDbPort,
                          database: exportDbName
                        } : exportDataMode === 'supabase' ? {
                          supabaseUrl: exportSupaUrl,
                          supabaseAnonKey: exportSupaAnonKey
                        } : null,
                        exportAuthStrategy === 'legacy' ? {
                          legacy: {
                            usersTable: exportAuthTableName,
                            emailColumn: exportAuthEmailCol,
                            passwordColumn: exportAuthPassCol,
                            passwordHash: exportAuthHash
                          },
                          db_table_name: exportAuthTableName,
                          db_email_column: exportAuthEmailCol,
                          db_password_column: exportAuthPassCol,
                          db_user_role_column: 'id',
                          db_password_hash: exportAuthHash
                        } : null
                      )}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)]"
                    >
                      Iniciar Exportação
                    </button>
                    <button
                      onClick={() => setDownloadModal(null)}
                      className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-950 dark:text-white rounded-xl text-sm font-bold transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              {downloadModal.phase === 'downloading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-neutral-500">
                    <span>Progresso</span>
                    <span>{downloadModal.progress}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${downloadModal.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-neutral-400">
                    {isTauri() ? 'Salvando na pasta Downloads do sistema...' : 'Preparando arquivo no navegador...'}
                  </p>
                </div>
              )}

              {/* Done state */}
              {downloadModal.phase === 'done' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-400 text-center font-medium">
                    Arquivo salvo em: <span className="font-bold">Downloads</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2.5">
                    {isTauri() ? (
                      <button
                        onClick={() => handleOpenFolder(downloadModal.savedDir, downloadModal.savedPath)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <FolderOpen className="w-4 h-4" />
                        Abrir Pasta
                      </button>
                    ) : (
                      <button
                        onClick={() => setDownloadModal(null)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm"
                      >
                        Concluído
                      </button>
                    )}
                  </div>

                  {isTauri() && (
                    <button
                      onClick={() => setDownloadModal(null)}
                      className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 font-bold uppercase tracking-widest py-1 transition-colors"
                    >
                      Fechar
                    </button>
                  )}
                </div>
              )}

              {/* Error state */}
              {downloadModal.phase === 'error' && (
                <div className="space-y-3">
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl p-3 text-xs text-red-700 dark:text-red-400 text-center font-medium">
                    Ocorreu um erro ao gerar o arquivo de código fonte.
                  </div>
                  <button
                    onClick={() => setDownloadModal(null)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Builder Modal */}
      <Modal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        title="Configurações IA"
      >
        <div className="p-2">
          <AIBuilderSettings workspaceId={workspaceId} isPro={tier === 'pro'} />
        </div>
      </Modal>

    </div>
  )
}
