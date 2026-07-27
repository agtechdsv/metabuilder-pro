'use client'

import React, { useState, useTransition, useEffect } from 'react'
import { openExternalUrl } from '@/utils/tauriUtils'

import {
  LayoutDashboard,
  Database,
  Table,
  Settings2,
  Eye,
  Plus,
  ArrowRight,
  Search,
  Box,
  Layers,
  Clock,
  ShieldCheck,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  Shield,
  ExternalLink,
  LayoutGrid,
  RefreshCw,
  Workflow,
  Download,
  Menu,
  X,
  ZoomIn,
  Minimize2,
  Maximize2,
  UploadCloud,
  Server,
  Calendar,
  Share2,
  Settings,
  FileSearch,
  Kanban,
  Activity,
  GanttChart,
  GitMerge,
  Network,
  Map as MapIcon,
  PieChart,
  Image as ImageIcon,
  ScrollText,
  Monitor,
  Sparkles,
  Loader2
} from 'lucide-react'
import { usePreview } from '@/contexts/PreviewContext'
import { DesktopAppGeneratorModal } from '@/components/workspace/DesktopAppGeneratorModal'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useI18n } from '@/i18n/I18nContext'
import { UseCaseBuilderWizard } from '@/components/studio/UseCaseBuilder'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { useUpgradeModal } from '@/context/UpgradeModalContext'
import { MenuBuilder } from '@/components/studio/MenuBuilder'
import { EnumerationsClient } from '../enumerations/EnumerationsClient'
import { TableFieldsManager } from '@/components/studio/TableFieldsManager'
import { RelationsManager } from '@/components/studio/RelationsManager'
import { ProjectSecuritySettings } from '@/components/studio/ProjectSecuritySettings'
import ProjectLogsTab from '@/components/studio/ProjectLogs/ProjectLogsTab'
import { AIBuilderChat } from '@/components/studio/AIBuilder/AIBuilderChat'
import { AIBuilderSettings } from '@/components/workspace/AIBuilderSettings'

const RETENTION_OPTIONS = [
  { value: '', labelKey: 'dashboard.projects.studio.stats.retention.forever' },
  { value: '1', labelKey: 'dashboard.projects.studio.stats.retention.1h' },
  { value: '6', labelKey: 'dashboard.projects.studio.stats.retention.6h' },
  { value: '12', labelKey: 'dashboard.projects.studio.stats.retention.12h' },
  { value: '24', labelKey: 'dashboard.projects.studio.stats.retention.24h' },
  { value: '72', labelKey: 'dashboard.projects.studio.stats.retention.3d' },
  { value: '168', labelKey: 'dashboard.projects.studio.stats.retention.7d' },
]

function RetentionDropdown({
  value,
  onChange,
  disabled,
  t
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
  t: any
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = React.useRef<HTMLButtonElement>(null)
  const selected = RETENTION_OPTIONS.find(o => o.value === value) || RETENTION_OPTIONS[0]

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen(prev => !prev)
  }

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative w-full">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); handleOpen() }}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold transition-all",
          "bg-white dark:bg-neutral-800/80",
          "border-neutral-200 dark:border-neutral-700",
          "hover:border-indigo-400 dark:hover:border-indigo-500",
          "focus:outline-none focus:ring-1 focus:ring-indigo-500/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span className={cn(
          "truncate",
          value === '' ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-400"
        )}>
          {t(selected.labelKey)}
        </span>
        <svg
          className={cn("w-3 h-3 text-neutral-400 transition-transform flex-shrink-0", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && typeof window !== 'undefined' && (
        <div
          className={cn(
            "fixed z-[9999] rounded-xl border overflow-hidden shadow-2xl",
            "bg-white dark:bg-neutral-900",
            "border-neutral-200 dark:border-neutral-700",
          )}
          style={{ top: coords.top, left: coords.left, width: coords.width }}
          onMouseDown={e => e.stopPropagation()}
        >
          {RETENTION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                "w-full text-left px-3 py-2 text-[9px] font-bold transition-all",
                "hover:bg-indigo-50 dark:hover:bg-indigo-900/30",
                opt.value === value
                  ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                  : "text-neutral-600 dark:text-neutral-300",
                opt.value === '' && opt.value !== value && "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {t(opt.labelKey)}
              {opt.value === value && (
                <span className="float-right text-indigo-500">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface StudioDashboardClientProps {
  workspace: any
  project: any
  models: any[]
  views: any[]
  workspace_slug: string
  project_slug: string
  user: any
  profile: any
  canCreate: boolean
  canDelete: boolean
  projectRelations?: any[]
  tier?: 'pro' | 'free'
}

export function StudioDashboardClient({
  workspace,
  project,
  models,
  views,
  workspace_slug,
  project_slug,
  user,
  profile,
  canCreate,
  canDelete,
  projectRelations = [],
  tier = 'free'
}: StudioDashboardClientProps) {
  const { t } = useI18n()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const { openUpgrade } = useUpgradeModal()
  const [isPending, startTransition] = useTransition()
  const { openPreview } = usePreview()

  const [retention, setRetention] = useState<string>(
    project.download_retention_hours !== null && project.download_retention_hours !== undefined
      ? String(project.download_retention_hours)
      : ''
  )
  const [isUpdatingRetention, setIsUpdatingRetention] = useState(false)

  const updateRetention = async (value: string) => {
    setRetention(value)
    setIsUpdatingRetention(true)
    const numValue = value ? parseInt(value) : null
    const { error } = await supabase
      .from('projects')
      .update({ download_retention_hours: numValue })
      .eq('id', project.id)
    if (error) {
      toast(t('dashboard.projects.studio.toasts.retention_error'), 'error')
    } else {
      toast(t('dashboard.projects.studio.toasts.retention_success'), 'success')
    }
    setIsUpdatingRetention(false)
  }

  const [viewMode, setViewMode] = useState<'list' | 'builder' | 'ai-editor' | 'navigation' | 'enumerations' | 'metadata' | 'relations' | 'security'>('list')
  const [showDesktopModal, setShowDesktopModal] = useState(false)
  const [viewToEdit, setViewToEdit] = useState<any>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [viewToDelete, setViewToDelete] = useState<any>(null)
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
  const [viewToPublish, setViewToPublish] = useState<any>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isCheckingAI, setIsCheckingAI] = useState(false)
  const [isAISettingsModalOpen, setIsAISettingsModalOpen] = useState(false)
  const [isCheckingLimit, setIsCheckingLimit] = useState(false)
  const userViews = views?.filter(view => view.slug !== 'downloads' && view.slug !== 'automations') || []
  const downloadsView = views?.find(view => view.slug === 'downloads')
  const isDownloadsActive = downloadsView ? (downloadsView.layout_config?.is_active !== false) : true
  const automationsView = views?.find(view => view.slug === 'automations')
  const isAutomationsActive = automationsView ? (automationsView.layout_config?.is_active !== false) : false
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isBpmConfigModalOpen, setIsBpmConfigModalOpen] = useState(false)
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false)
  const [bpmConfig, setBpmConfig] = useState<any>(automationsView?.layout_config || { default_auto_align: false, error_email: '', log_retention: 30, timeout_mins: 5 })

  const [scale, setScale] = useState(1.0)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  
  const QUICK_START_LOGICS = [
    { id: 'pesquisa_cadastro', title: 'Pesquisa + Cadastro', icon: FileSearch },
    { id: 'kanban', title: 'Kanban', icon: Kanban },
    { id: 'timeline', title: 'Linha do Tempo / Feed', icon: Activity },
    { id: 'gantt', title: 'Gráfico de Gantt', icon: GanttChart },
    { id: 'scheduler', title: 'Agenda / Calendário', icon: Calendar },
    { id: 'blueprint', title: 'Fluxograma (Blueprint)', icon: GitMerge },
    { id: 'mapa_mental', title: 'Mapa Mental', icon: Network },
    { id: 'map', title: 'Visão de Mapa (Geospatial)', icon: MapIcon },
    { id: 'analytics', title: 'Dashboard (BI)', icon: PieChart },
    { id: 'galeria', title: 'Galeria / Assets', icon: ImageIcon },
    { id: 'personalizado', title: 'Personalizado (Híbrido)', icon: Box }
  ];

  const [quickStartModal, setQuickStartModal] = useState<{ isOpen: boolean, logicType: string, logicName: string, name: string, slug: string } | null>(null);

  const categoryLogicTypes = {
    'sistema': ['system'],
    'dados': ['pesquisa_cadastro', 'cadastro_simples', 'mestre_detalhe'],
    'projetos': ['kanban', 'timeline', 'gantt', 'scheduler'],
    'mapas': ['blueprint', 'mapa_mental', 'map'],
    'outros': ['analytics', 'galeria'],
    'avancado': ['personalizado', 'advanced_use_case'],
  }

  const filterOptions = [
    { id: 'sistema', title: 'Sistema', icon: Server },
    { id: 'dados', title: 'Gestão de Dados e Cadastros', icon: Database },
    { id: 'projetos', title: 'Projetos, Prazos e Cronogramas', icon: Calendar },
    { id: 'mapas', title: 'Mapeamento, Fluxos e Espacial', icon: Share2 },
    { id: 'outros', title: 'Inteligência, Mídia e Outros', icon: LayoutGrid },
    { id: 'avancado', title: 'Avançado e Híbrido', icon: Settings },
  ]

  const scales = [
    { value: 0.8, icon: <Minimize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_small', 'Pequeno') },
    { value: 1.0, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: t('runtime.scale_normal', 'Normal') },
    { value: 1.2, icon: <Maximize2 className="w-3.5 h-3.5" />, label: t('runtime.scale_large', 'Grande') },
    { value: 1.5, icon: <ZoomIn className="w-3.5 h-3.5" />, label: t('runtime.scale_xl', 'Extra Grande') }
  ]

  const gridColumns = scale === 0.8 ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7' :
                      scale === 1.2 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4' :
                      scale === 1.5 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3' :
                      'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6'

  const refreshData = () => {
    setViewToEdit(null)
    setViewMode('list')
    router.refresh()
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 800)
  }

  const handleToggleActive = async (view: any) => {
    try {
      const isCurrentlyActive = view.layout_config?.is_active !== false
      const newLayoutConfig = {
        ...(view.layout_config || {}),
        is_active: !isCurrentlyActive
      }

      const { error } = await supabase
        .from('ui_views')
        .update({ layout_config: newLayoutConfig })
        .eq('id', view.id)

      if (error) throw error

      toast(!isCurrentlyActive ? t('dashboard.projects.studio.toasts.active_success') : t('dashboard.projects.studio.toasts.inactive_success'), 'success')
      router.refresh()
    } catch (err: any) {
      toast(t('dashboard.projects.studio.toasts.error_status') + err.message, 'error')
    }
  }

  const handleSaveBpmConfig = async () => {
    if (!automationsView) return
    try {
      const { error } = await supabase
        .from('ui_views')
        .update({ layout_config: bpmConfig })
        .eq('id', automationsView.id)

      if (error) throw error

      toast(t('dashboard.projects.studio.toasts.bpm_config_success'), 'success')
      setIsBpmConfigModalOpen(false)
      router.refresh()
    } catch (err: any) {
      toast(t('dashboard.projects.studio.toasts.bpm_config_error') + err.message, 'error')
    }
  }

  const handleGenerateWithAI = async () => {
    setIsCheckingAI(true)
    try {
      const res = await fetch(`/api/ai-builder/config?workspace_id=${workspace.id}`)
      const data = await res.json()
      
      if (!data.config) {
        if (workspace.owner_id === user.id) {
          setIsAISettingsModalOpen(true)
        } else {
          toast('A IA não está configurada! Por favor, solicite ao administrador/owner do workspace que adicione a Chave de API da IA nas configurações.', 'error')
        }
        return
      }
      
      router.push(`/admin/${workspace_slug}/${project_slug}/studio/ai-builder`)
    } catch (e: any) {
      toast('Erro ao verificar configurações da IA.', 'error')
    } finally {
      setIsCheckingAI(false)
    }
  }

  const handleDeleteView = async () => {
    if (!viewToDelete) return
    try {
      const { error } = await supabase
        .from('ui_views')
        .delete()
        .eq('id', viewToDelete.id)

      if (error) throw error

      // Limpar menus que apontavam para este caso de uso
      const currentMenu = project.navigation || []
      const removeTargetFromMenu = (items: any[], targetSlug: string): any[] => {
        return items
          .filter(item => !(item.type === 'view' && item.target === targetSlug))
          .map(item => ({
            ...item,
            children: item.children ? removeTargetFromMenu(item.children, targetSlug) : undefined
          }))
      }
      
      const newMenu = removeTargetFromMenu(currentMenu, viewToDelete.slug)
      
      if (JSON.stringify(currentMenu) !== JSON.stringify(newMenu)) {
        await supabase
          .from('projects')
          .update({ navigation: newMenu })
          .eq('id', project.id)
      }

      toast(t('dashboard.projects.studio.toasts.delete_success'), 'success')
      setIsDeleteModalOpen(false)
      setViewToDelete(null)
      router.refresh()
    } catch (err: any) {
      toast(t('dashboard.projects.studio.toasts.error_delete') + err.message, 'error')
    }
  }

  const handlePublishView = async () => {
    if (!viewToPublish?.id) return
    setIsPublishing(true)
    try {
      const draft = viewToPublish.draft_config

      let payloadToUpdate: any = {}

      if (!draft) {
        // If there's no draft, it's a completely unpublished view being published directly
        payloadToUpdate = {
          status: 'delivered',
          layout_config: viewToPublish.layout_config && Object.keys(viewToPublish.layout_config).length > 0 ? viewToPublish.layout_config : { is_active: true }
        }
      } else {
        payloadToUpdate = {
          name: draft.name,
          slug: draft.slug,
          logic_type: draft.logic_type,
          has_arguments: draft.has_arguments,
          tables_config: draft.tables_config,
          query_type: draft.query_type,
          custom_query: draft.custom_query,
          layout_config: draft.layout_config,
          buttons_config: draft.buttons_config,
          model_id: draft.model_id,
          status: 'delivered',
          draft_config: null,
        }
      }

      const { error: publishError } = await supabase
        .from('ui_views')
        .update(payloadToUpdate)
        .eq('id', viewToPublish.id)

      if (publishError) throw publishError

      if (draft) {
        await supabase.from('ui_components').delete().eq('view_id', viewToPublish.id)

        const draftLayout = draft.layout_config || {}
        const draftMeta = draftLayout.fields_metadata || {}
        const validFormFields: string[] = draftLayout.form_fields || []
        const validGridFields: string[] = draftLayout.grid_fields || []
        const validFilterFields: string[] = draftLayout.filter_fields || []

        const componentMap: Record<string, any> = {}

        const addComponent = (fid: string, zone: string) => {
          if (fid.startsWith('virt_') || fid.startsWith('byoc_')) return
          const zoneMeta = draftMeta[`${zone}-${fid}`]
          const globalMeta = draftMeta[fid] || {}
          const metadata = zoneMeta || globalMeta
          const labelText = metadata.label?.text || fid
          if (!componentMap[fid]) {
            componentMap[fid] = {
              view_id: viewToPublish.id,
              field_id: fid,
              component_type: zone,
              label: labelText,
              is_visible: true,
              config: { zones: [zone], [`${zone}_config`]: metadata, ...metadata }
            }
          } else {
            if (!componentMap[fid].config.zones.includes(zone)) componentMap[fid].config.zones.push(zone)
            componentMap[fid].config[`${zone}_config`] = metadata
            if (zone === 'form' && metadata.label?.text) componentMap[fid].label = metadata.label.text
          }
        }

        validFilterFields.forEach((fid: string) => addComponent(fid, 'filter'))
        validGridFields.forEach((fid: string) => addComponent(fid, 'grid'))
        validFormFields.forEach((fid: string) => addComponent(fid, 'form'))

        const componentsToInsert = Object.values(componentMap)
        if (componentsToInsert.length > 0) {
          const { error: compError } = await supabase.from('ui_components').insert(componentsToInsert)
          if (compError) throw compError
        }
      }

      toast('Caso de Uso publicado com sucesso! Os usuários já podem acessar.', 'success')
      setIsPublishModalOpen(false)
      setViewToPublish(null)
      router.refresh()
    } catch (err: any) {
      toast('Erro ao publicar: ' + err.message, 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  const handleToggleAutomations = async () => {
    try {
      const newActiveState = !isAutomationsActive
      const { error: viewError } = await supabase
        .from('ui_views')
        .upsert({
          project_id: project.id,
          model_id: null,
          name: 'Automações & BPM',
          slug: 'automations',
          logic_type: 'personalizado',
          view_type: 'system',
          layout_config: { is_active: newActiveState }
        }, { onConflict: 'project_id, slug' })

      if (viewError) throw viewError

      toast(newActiveState ? t('dashboard.projects.studio.toasts.automations_active_success') : t('dashboard.projects.studio.toasts.automations_inactive_success'), 'success')
      router.refresh()
    } catch (err: any) {
      toast(t('dashboard.projects.studio.toasts.automations_status_error') + err.message, 'error')
    }
  }

  const handleSaveNavigation = async (menu: any[]) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          navigation: menu 
        })
        .eq('id', project.id)

      if (error) throw error

      toast(t('dashboard.projects.studio.toasts.navigation_save_success'), 'success')
      router.refresh()
    } catch (err: any) {
      toast(t('dashboard.projects.studio.toasts.navigation_save_error') + err.message, 'error')
    }
  }

  const handleAddToMenu = async (view: any) => {
    try {
      const currentMenu = project.navigation || []
      
      const exists = currentMenu.some((item: any) => item.type === 'view' && item.target === view.slug)
      if (exists) {
        toast(t('dashboard.projects.studio.toasts.use_case_already_in_menu'), 'info')
        return
      }

      const newId = Math.random().toString(36).substr(2, 9)
      const newItem = {
        id: `view_${newId}`,
        label: view.name,
        description: '',
        icon: 'Layout',
        type: 'view',
        target: view.slug,
        show_dashboard: true
      }

      const updatedMenu = [...currentMenu, newItem]

      const { error } = await supabase
        .from('projects')
        .update({ 
          navigation: updatedMenu 
        })
        .eq('id', project.id)

      if (error) throw error

      project.navigation = updatedMenu

      toast(t('dashboard.projects.studio.toasts.use_case_added_to_menu'), 'success')
      router.refresh()
    } catch (err: any) {
      toast(t('dashboard.projects.studio.toasts.use_case_add_to_menu_error') + err.message, 'error')
    }
  }

  const handleRemoveFromMenu = async (view: any) => {
    try {
      const currentMenu = project.navigation || []
      const updatedMenu = currentMenu.filter((item: any) => !(item.type === 'view' && item.target === view.slug))

      const { error } = await supabase
        .from('projects')
        .update({ 
          navigation: updatedMenu 
        })
        .eq('id', project.id)

      if (error) throw error

      project.navigation = updatedMenu

      toast('Removido do Menu com sucesso', 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao remover do menu: ' + err.message, 'error')
    }
  }

  const handleDiscardDraft = async (view: any) => {
    try {
      const { error } = await supabase
        .from('ui_views')
        .update({ draft_config: null })
        .eq('id', view.id)

      if (error) throw error

      toast('Rascunho descartado com sucesso!', 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao descartar rascunho: ' + err.message, 'error')
    }
  }

  const handleToggleDownloads = async () => {
    try {
      const newActiveState = !isDownloadsActive
      const { error: viewError } = await supabase
        .from('ui_views')
        .upsert({
          project_id: project.id,
          model_id: null,
          name: 'Central de Downloads',
          slug: 'downloads',
          logic_type: 'personalizado',
          view_type: 'advanced_use_case',
          layout_config: { is_active: newActiveState }
        }, { onConflict: 'project_id, slug' })

      if (viewError) throw viewError

      toast(newActiveState ? t('dashboard.projects.studio.toasts.downloads_active_success') : t('dashboard.projects.studio.toasts.downloads_inactive_success'), 'success')
      router.refresh()
    } catch (err: any) {
      toast(t('dashboard.projects.studio.toasts.downloads_status_error') + err.message, 'error')
    }
  }

  return (
    <>
      <Breadcrumbs
        workspaceName={workspace.name}
        workspaceSlug={workspace_slug}
        projectName={project.name}
        projectSlug={project_slug}
      />

      <main className="w-full px-10 pt-4 pb-4 space-y-4 flex-grow">

        {viewMode !== 'builder' && viewMode !== 'ai-editor' && (
          <div className="flex items-center justify-between mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 rotate-3">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
                  MetaBuilder <span className="text-indigo-600 dark:text-indigo-500">Studio</span>
                </h2>
                <p className="text-[10px] text-neutral-400 uppercase font-black tracking-[0.2em]">{t('dashboard.projects.studio.control_dashboard')}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-neutral-100 dark:bg-neutral-900/50 p-1 rounded-2xl border border-neutral-200 dark:border-neutral-800">
               <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  viewMode === 'list' ? "bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                )}
               >
                 {t('dashboard.projects.studio.tabs.use_cases')}
               </button>
               {canCreate && (
                 <>
                   <button 
                    onClick={() => setViewMode('navigation')}
                    className={cn(
                      "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      viewMode === 'navigation' ? "bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                    )}
                   >
                     {t('dashboard.projects.studio.tabs.navigation')}
                   </button>
                   <button 
                     onClick={() => setViewMode('enumerations')}
                     className={cn(
                       "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                       viewMode === 'enumerations' ? "bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                     )}
                    >
                      <Database className="w-3.5 h-3.5" /> {t('dashboard.projects.studio.tabs.enums')}
                    </button>
                 </>
               )}
            </div>

            {canCreate && (
              <div className="flex items-center gap-4">


                <button
                  disabled={isCheckingLimit}
                  onClick={async () => {
                    if (tier === 'free') {
                      setIsCheckingLimit(true)
                      const { count } = await supabase
                        .from('ui_views')
                        .select('*', { count: 'exact', head: true })
                        .eq('project_id', project.id)
                        .neq('slug', 'downloads')
                        .neq('slug', 'automations')
                        
                      setIsCheckingLimit(false)

                      if (count !== null && count >= 4) {
                        openUpgrade('Novo Caso de Uso')
                        return
                      }
                    }
                    setViewToEdit(null)
                    setViewMode('builder')
                  }}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" /> {t('dashboard.projects.studio.new_use_case')}
                </button>

                {tier === 'pro' && (
                  <button
                    onClick={handleGenerateWithAI}
                    disabled={isCheckingAI}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-violet-500/20 active:scale-95 disabled:opacity-50"
                  >
                    {isCheckingAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar com IA
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Stats Rápidos */}
        {viewMode === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-2 shadow-sm dark:shadow-none transition-all">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-500">
                  <Database className="w-5 h-5" />
                </div>
                <span className="text-xl font-black text-neutral-900 dark:text-white">{models?.length || 0}</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-widest">{t('dashboard.projects.studio.stats.synced_tables')}</p>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-2 shadow-sm dark:shadow-none transition-all">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-500">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-xl font-black text-neutral-900 dark:text-white">{userViews.length}</span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium uppercase tracking-widest">{t('dashboard.projects.studio.stats.custom_views')}</p>
            </div>

            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3 shadow-sm dark:shadow-none transition-all group/stat relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="p-2 bg-orange-500/10 rounded-xl text-orange-600 dark:text-orange-500">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-[9px] font-black text-green-600 dark:text-green-500 uppercase tracking-widest">{t('dashboard.projects.studio.stats.now')}</span>
                </div>
              </div>
              <div className="space-y-2 relative z-10">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium leading-tight uppercase tracking-widest">{t('dashboard.projects.studio.agent_status')}</p>
                
                {/* Linha 1: ID do Projeto */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800/50 pt-2">
                  <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">{t('dashboard.projects.project_id')}:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-[8px] text-neutral-400 font-mono bg-neutral-100 dark:bg-black/40 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={project.id}>{project.id}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(project.id)
                        toast(t('dashboard.projects.studio.token_copied'), 'success')
                      }}
                      className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase hover:underline"
                    >
                      {t('dashboard.projects.copy')}
                    </button>
                  </div>
                </div>

                {/* Linha 2: Token Secreto */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800/50 pt-2">
                  <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">{t('dashboard.projects.secret_token')}:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-[8px] text-neutral-400 font-mono bg-neutral-100 dark:bg-black/40 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={project.secret_token || ''}>
                      {project.secret_token ? `${project.secret_token.substring(0, 8)}...` : 'N/A'}
                    </code>
                    <button
                      onClick={() => {
                        if (project.secret_token) {
                          navigator.clipboard.writeText(project.secret_token)
                          toast(t('dashboard.projects.studio.secret_token_copied'), 'success')
                        } else {
                          toast(t('dashboard.projects.studio.no_token_available'), 'error')
                        }
                      }}
                      className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase hover:underline"
                    >
                      {t('dashboard.projects.copy')}
                    </button>
                  </div>
                </div>

                {/* Linha 3: Retenção de Downloads */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/50">
                  <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block mb-1.5">{t('dashboard.projects.studio.stats.export_retention')}</span>
                  <RetentionDropdown
                    value={retention}
                    onChange={updateRetention}
                    disabled={isUpdatingRetention}
                    t={t}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'ai-editor' && viewToEdit ? (
          <div className="flex flex-col h-full min-h-0 bg-white dark:bg-neutral-950 rounded-2xl shadow-xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
            <AIBuilderChat
              workspaceId={workspace.id}
              workspaceSlug={workspace_slug}
              projectId={project.id}
              projectSlug={project_slug}
              projectSecretToken={project.secret_token}
              initialView={viewToEdit}
              onClose={() => { setViewMode('list'); setViewToEdit(null) }}
            />
          </div>
        ) : viewMode === 'builder' ? (
          <UseCaseBuilderWizard
            initialData={viewToEdit}
            onClose={() => {
              setViewMode('list')
              setViewToEdit(null)
            }}
            onSaveSuccess={refreshData}
            canCreate={canCreate}
            projectRelations={projectRelations}
          />
        ) : viewMode === 'navigation' ? (
          <div className="">
            <MenuBuilder 
              project={project}
              views={userViews}
              isDownloadsActive={isDownloadsActive}
              onSave={handleSaveNavigation}
            />
          </div>
        ) : viewMode === 'enumerations' ? (
          <div className="">
            <EnumerationsClient 
              project={project}
            />
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/50 pb-4">
              <div className="flex items-center gap-6">
                <h3 className="text-xl font-black flex items-center gap-3 text-neutral-900 dark:text-white tracking-tight">
                  <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
                  {t('dashboard.projects.studio.use_cases')}
                </h3>
                
                {/* QUICK START BAR */}
                <div className="flex items-center gap-1 bg-white dark:bg-neutral-900/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 hidden xl:flex shadow-inner">
                  <span className="text-[9px] font-black uppercase text-indigo-400/80 dark:text-indigo-500/80 tracking-widest px-3 border-r border-neutral-200 dark:border-neutral-800 mr-1 flex items-center gap-1.5">
                    <Plus className="w-3 h-3" />
                    Quick Start
                  </span>
                  {QUICK_START_LOGICS.map(logic => {
                    const Icon = logic.icon;
                    return (
                      <button
                        key={logic.id}
                        type="button"
                        onClick={() => setQuickStartModal({ isOpen: true, logicType: logic.id, logicName: logic.title, name: '', slug: '' })}
                        title={`Novo ${logic.title}`}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all active:scale-95"
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 hidden md:flex">
                  {filterOptions.map(f => {
                    const Icon = f.icon
                    const isActive = activeFilter === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => setActiveFilter(isActive ? null : f.id)}
                        title={f.title}
                        className={cn(
                          "p-1.5 rounded-lg transition-all",
                          isActive
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                            : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-700/50"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    )
                  })}
                </div>
                <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 hidden md:block"></div>
                <div className="flex items-center bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800 hidden md:flex">
                  {scales.map(s => (
                    <button
                      key={s.value}
                      onClick={() => setScale(s.value)}
                      title={s.label}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        scale === s.value 
                          ? "bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                          : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      )}
                    >
                      {s.icon}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors group"
                  title="Atualizar"
                >
                  <RefreshCw className={cn("w-4 h-4 transition-transform duration-500 ease-out", isRefreshing ? "animate-spin" : "group-hover:rotate-180")} />
                </button>
                <div className="px-4 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full text-[10px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest border border-neutral-200 dark:border-neutral-800">
                  {userViews.length} {t('dashboard.projects.studio.created_suffix')}
                </div>
              </div>
            </div>

            <div className={cn("grid gap-4 transition-all duration-500", gridColumns)}>
              {(!activeFilter || activeFilter === 'sistema') && (
                <>
                  {/* 1. Card Fixo do Portal de Login (Sistema) */}
                  <div className="group relative p-5 bg-gradient-to-br from-indigo-600/5 to-purple-600/5 dark:from-indigo-600/10 dark:to-purple-600/10 border border-indigo-500/20 dark:border-indigo-500/30 rounded-[1.5rem] hover:border-indigo-500 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-indigo-500/20 z-10 border border-white/10 dark:border-black/10 min-w-[140px] text-center">
                  {t('dashboard.projects.system_label')}
                </div>
                <div className="flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black tracking-tight text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {t('dashboard.projects.studio.login_portal')}
                        </h4>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                        <span className="opacity-50">/</span>{workspace_slug}/{project_slug}/login
                      </p>
                    </div>
                    <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-600 dark:text-indigo-400">
                      <Shield className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-auto flex gap-3">
                    {canCreate ? (
                      <>
                        <Link
                          href={`/admin/${workspace_slug}/${project_slug}/studio/auth`}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-500/20"
                        >
                          <Settings2 className="w-4 h-4" /> {t('dashboard.projects.studio.configure_login')}
                        </Link>
                        <Link
                          href={`/${workspace_slug}/${project_slug}/login`}
                          target="_blank"
                          className="w-14 flex items-center justify-center bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 transition-all text-neutral-400 hover:text-indigo-600 dark:hover:text-white shadow-sm"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/${workspace_slug}/${project_slug}/login`}
                        target="_blank"
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-500/20"
                      >
                        <ExternalLink className="w-4 h-4" /> {t('dashboard.projects.studio.view_portal')}
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Card do BPM/Automações (Sistema) */}
              <div className="group relative p-5 bg-gradient-to-br from-emerald-600/5 to-teal-600/5 dark:from-emerald-600/10 dark:to-teal-600/10 border border-emerald-500/20 dark:border-emerald-500/30 rounded-[1.5rem] hover:border-emerald-500 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-emerald-500/20 z-10 border border-white/10 dark:border-black/10 min-w-[140px] text-center">
                  {t('dashboard.projects.system_label')}
                </div>
                <div className="flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-base font-black tracking-tight transition-colors ${isAutomationsActive ? 'text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400' : 'text-neutral-400 italic'}`}>
                          {t('dashboard.projects.studio.automations_bpm')}
                        </h4>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                        <span className="opacity-50">/</span>{workspace_slug}/{project_slug}/automations
                      </p>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400 flex flex-col items-center gap-2">
                       {canCreate ? (
                         <button
                           onClick={handleToggleAutomations}
                           className={`p-1.5 rounded-xl transition-colors ${isAutomationsActive ? 'text-emerald-500 hover:bg-emerald-500/20' : 'text-neutral-400 hover:bg-neutral-500/10'}`}
                           title={isAutomationsActive ? t('dashboard.projects.studio.status_active') : t('dashboard.projects.studio.status_inactive')}
                         >
                           {isAutomationsActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                         </button>
                       ) : (
                         <span
                           className={`p-1.5 rounded-xl cursor-default ${isAutomationsActive ? 'text-emerald-500' : 'text-neutral-400'}`}
                         >
                           {isAutomationsActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                         </span>
                       )}
                      <div className="p-1.5"><Workflow className="w-4 h-4" /></div>
                    </div>
                  </div>

                  <div className="mt-auto flex gap-3">
                    {canCreate ? (
                      <>
                        <button
                          onClick={() => setIsBpmConfigModalOpen(true)}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-emerald-500/20"
                        >
                          <Settings2 className="w-4 h-4" /> {t('dashboard.projects.studio.configure_module')}
                        </button>
                        {isAutomationsActive && (
                          <Link
                            href={`/${workspace_slug}/${project_slug}/automations`}
                            target="_blank"
                            className="w-14 flex items-center justify-center bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 transition-all text-neutral-400 hover:text-emerald-600 dark:hover:text-white shadow-sm"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </Link>
                        )}
                      </>
                    ) : (
                      isAutomationsActive && (
                        <Link
                          href={`/${workspace_slug}/${project_slug}/automations`}
                          target="_blank"
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-emerald-500/20"
                        >
                          <ExternalLink className="w-4 h-4" /> {t('dashboard.projects.studio.access_bpm')}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Card da Central de Downloads (Sistema) */}
              <div className="group relative p-5 bg-gradient-to-br from-blue-600/5 to-cyan-600/5 dark:from-blue-600/10 dark:to-cyan-600/10 border border-blue-500/20 dark:border-blue-500/30 rounded-[1.5rem] hover:border-blue-500 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1">
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-500/20 z-10 border border-white/10 dark:border-black/10 min-w-[140px] text-center">
                  {t('dashboard.projects.system_label')}
                </div>
                <div className="flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-base font-black tracking-tight transition-colors ${isDownloadsActive ? 'text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400' : 'text-neutral-400 italic'}`}>
                          {t('dashboard.projects.studio.downloads_center')}
                        </h4>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                        <span className="opacity-50">/</span>{workspace_slug}/{project_slug}/downloads
                      </p>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-400 flex flex-col items-center gap-2">
                       {canCreate ? (
                         <button
                           onClick={handleToggleDownloads}
                           className={`p-1.5 rounded-xl transition-colors ${isDownloadsActive ? 'text-blue-500 hover:bg-blue-500/20' : 'text-neutral-400 hover:bg-neutral-500/10'}`}
                           title={isDownloadsActive ? t('dashboard.projects.studio.status_active') : t('dashboard.projects.studio.status_inactive')}
                         >
                           {isDownloadsActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                         </button>
                       ) : (
                         <span
                           className={`p-1.5 rounded-xl cursor-default ${isDownloadsActive ? 'text-blue-500' : 'text-neutral-400'}`}
                         >
                           {isDownloadsActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                         </span>
                       )}
                      <div className="p-1.5"><Download className="w-4 h-4" /></div>
                    </div>
                  </div>

                  <div className="mt-auto flex gap-3">
                    {canCreate ? (
                      <>
                        <button
                          onClick={handleToggleDownloads}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-blue-500/20"
                        >
                          <Settings2 className="w-4 h-4" /> {isDownloadsActive ? t('dashboard.projects.studio.disable_module') : t('dashboard.projects.studio.enable_module')}
                        </button>
                        {isDownloadsActive && (
                          <Link
                            href={`/${workspace_slug}/${project_slug}/downloads`}
                            target="_blank"
                            className="w-14 flex items-center justify-center bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 transition-all text-neutral-400 hover:text-blue-600 dark:hover:text-white shadow-sm"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </Link>
                        )}
                      </>
                    ) : (
                      isDownloadsActive && (
                        <Link
                          href={`/${workspace_slug}/${project_slug}/downloads`}
                          target="_blank"
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-blue-500/20"
                        >
                          <ExternalLink className="w-4 h-4" /> {t('dashboard.projects.studio.access_downloads')}
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>
              </>
              )}

              {/* 4. Card de Logs (Sistema) removido */}
              {/* 5. Card do SQL Studio (Sistema) removido */}

              {userViews.filter(view => {
                if (!activeFilter) return true;
                if (activeFilter === 'sistema') return false;
                return categoryLogicTypes[activeFilter as keyof typeof categoryLogicTypes]?.includes(view.logic_type || '');
              }).map((view) => (
                <div
                  key={view.id}
                  className="group relative p-5 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] hover:border-indigo-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl dark:shadow-none hover:-translate-y-1"
                >
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black rounded-full capitalize tracking-widest shadow-lg shadow-indigo-500/10 z-10 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap min-w-[140px] text-center">
                    {t(`wizard.logic.types.${view.logic_type}.title`, view.logic_type?.replace('_', ' + ') || 'Custom')}
                  </div>

                  <div className="flex flex-col gap-4 h-full">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={`text-base font-bold tracking-tight transition-colors ${view.layout_config?.is_active !== false ? 'text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : 'text-neutral-400 italic'}`}>
                            {view.draft_config?.name || view.name}
                          </h4>
                          {view.layout_config?.generated_by_ai && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0">
                              <Sparkles className="w-2.5 h-2.5" /> IA
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                          <span className="opacity-50">/</span>{view.draft_config?.slug || view.slug}
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                          {canCreate ? (
                            <button
                              onClick={() => handleToggleActive(view)}
                              className={`p-2 rounded-xl transition-colors ${view.layout_config?.is_active !== false ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-neutral-400 hover:bg-neutral-500/10'}`}
                              title={view.layout_config?.is_active !== false ? t('dashboard.projects.studio.status_active') : t('dashboard.projects.studio.status_inactive')}
                            >
                              {view.layout_config?.is_active !== false ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                            </button>
                          ) : (
                            <span
                              className={`p-2 rounded-xl cursor-default ${view.layout_config?.is_active !== false ? 'text-emerald-500' : 'text-neutral-400'}`}
                              title={view.layout_config?.is_active !== false ? t('dashboard.projects.studio.status_active') : t('dashboard.projects.studio.status_inactive')}
                            >
                              {view.layout_config?.is_active !== false ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                            </span>
                          )}
                        {canCreate && (
                          project.navigation?.some((item: any) => item.type === 'view' && item.target === view.slug) ? (
                            <button
                              onClick={() => handleRemoveFromMenu(view)}
                              className="relative p-2 text-indigo-500 bg-indigo-500/10 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-all group"
                              title="Remover do Menu"
                            >
                              <Menu className="w-4 h-4" />
                              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full flex items-center justify-center text-white border-2 border-white dark:border-neutral-900 shadow-sm">
                                <X className="w-2 h-2" strokeWidth={4} />
                              </div>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddToMenu(view)}
                              className="p-2 text-neutral-300 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-xl transition-all"
                              title={t('dashboard.projects.studio.add_to_menu')}
                            >
                              <Menu className="w-4 h-4" />
                            </button>
                          )
                        )}
                        {canDelete && (
                          <button
                            onClick={() => {
                              setViewToDelete(view)
                              setIsDeleteModalOpen(true)
                            }}
                            className="p-2 text-neutral-300 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex flex-col gap-2 mt-auto">
                      {canCreate ? (
                        <>
                          {(view.draft_config || !view.layout_config || Object.keys(view.layout_config).length === 0 || view.status === 'draft') && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setViewToPublish(view)
                                  setIsPublishModalOpen(true)
                                }}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-2xl border border-emerald-200 dark:border-emerald-500/30 transition-all text-emerald-600 dark:text-emerald-500 shadow-sm group/publish-draft"
                                title="Publicar Alterações"
                              >
                                <UploadCloud className="w-5 h-5 group-hover/publish-draft:scale-110 transition-transform" />
                                <span className="text-xs font-bold">Publicar</span>
                              </button>
                              
                              {view.draft_config && view.status !== 'draft' && (
                                <button
                                  onClick={() => handleDiscardDraft(view)}
                                  className="w-[42px] shrink-0 flex items-center justify-center bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-2xl border border-rose-200 dark:border-rose-500/30 transition-all text-rose-600 dark:text-rose-500 shadow-sm"
                                  title="Descartar Rascunho"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setViewToEdit(view)
                                // Views geradas pela IA vão para o AI Builder, não para o Studio
                                if (view.layout_config?.generated_by_ai === true || view.draft_config?.generated_by_ai === true) {
                                  setViewMode('ai-editor')
                                } else {
                                  setViewMode('builder')
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl text-[10px] font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-neutral-900/10 dark:shadow-white/5"
                            >
                              {(view.layout_config?.generated_by_ai === true || view.draft_config?.generated_by_ai === true)
                                ? <><Sparkles className="w-4 h-4" /> Configurar</>
                                : <><Settings2 className="w-4 h-4" /> {t('dashboard.projects.studio.configure')}</>
                              }
                            </button>
                            {(view.draft_config || !view.layout_config || Object.keys(view.layout_config).length === 0 || view.status === 'draft') && (
                              <>
                                {view.draft_config && (
                                  <button
                                    onClick={() => openPreview(`${window.location.origin}/${workspace_slug}/${project_slug}/${view.slug}?preview=draft`, `Rascunho: ${view.name}`)}
                                    className="w-14 flex items-center justify-center bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-2xl border border-amber-200 dark:border-amber-500/30 transition-all text-amber-600 dark:text-amber-500 shadow-sm group/preview animate-pulse"
                                    title="Visualizar Rascunho"
                                  >
                                    <Eye className="w-5 h-5 group-hover/preview:scale-110 transition-transform" />
                                  </button>
                                )}
                              </>
                            )}
                            {(view.layout_config && Object.keys(view.layout_config).length > 0) && (
                              <button
                                onClick={() => openPreview(`${window.location.origin}/${workspace_slug}/${project_slug}/${view.slug}`, `Publicado: ${view.name}`)}
                                className="w-14 flex items-center justify-center bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 transition-all text-neutral-400 hover:text-indigo-600 dark:hover:text-white shadow-sm group/publish"
                                title="Acessar versão publicada"
                              >
                                <ArrowRight className="w-5 h-5 group-hover/publish:translate-x-0.5 transition-transform" />
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        (view.layout_config && Object.keys(view.layout_config).length > 0) && (
                          <button
                            onClick={() => openPreview(`${window.location.origin}/${workspace_slug}/${project_slug}/${view.slug}`, `Acessar: ${view.name}`)}
                            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl text-[10px] font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-neutral-900/10 dark:shadow-white/5"
                          >
                            <ArrowRight className="w-4 h-4" /> {t('dashboard.projects.studio.access_use_case')}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {(userViews.length === 0 || userViews.filter(view => {
                if (!activeFilter) return true;
                if (activeFilter === 'sistema') return false;
                return categoryLogicTypes[activeFilter as keyof typeof categoryLogicTypes]?.includes(view.logic_type || '');
              }).length === 0) && (!activeFilter || activeFilter !== 'sistema') && (
                <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[3rem] text-neutral-400 gap-4">
                  <div className="p-4 bg-neutral-50 dark:bg-neutral-900 rounded-full">
                    <Layers className="w-10 h-10 opacity-20" />
                  </div>
                  <p className="text-sm font-bold tracking-tight">{t('dashboard.projects.studio.no_use_cases')}</p>
                  {canCreate && (
                    <button onClick={() => setViewMode('builder')} className="text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest hover:underline underline-offset-8 transition-all">{t('dashboard.projects.studio.start_now')}</button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title={t('dashboard.projects.studio.delete_confirm.title')}
        >
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-600">{t('dashboard.projects.studio.delete_confirm.warning')}</p>
                <p className="text-xs text-neutral-500 mt-1">{t('dashboard.projects.studio.delete_confirm.desc').replace('{name}', viewToDelete?.name || '')}</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteView}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)]"
              >
                {t('dashboard.projects.studio.delete_confirm.yes_delete')}
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all"
              >
                {t('dashboard.projects.studio.delete_confirm.cancel')}
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isPublishModalOpen}
          onClose={() => setIsPublishModalOpen(false)}
          title="Publicar Alterações"
        >
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
              <UploadCloud className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-600">Tem certeza que deseja publicar?</p>
                <p className="text-xs text-neutral-500 mt-1">Isso tornará todas as alterações do "{viewToPublish?.name}" visíveis imediatamente para os usuários.</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handlePublishView}
                disabled={isPublishing}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
              >
                {isPublishing ? 'Publicando...' : 'Sim, Publicar'}
              </button>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="w-full py-4 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white rounded-2xl font-bold transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isBpmConfigModalOpen}
          onClose={() => setIsBpmConfigModalOpen(false)}
          title={t('dashboard.projects.studio.bpm_modal.title')}
        >
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 block">{t('dashboard.projects.studio.bpm_modal.log_retention')}</label>
                <select 
                  value={bpmConfig?.log_retention || 30}
                  onChange={(e) => setBpmConfig((prev: any) => ({ ...prev, log_retention: Number(e.target.value) }))}
                  className="w-full h-12 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={7}>{t('dashboard.projects.studio.bpm_modal.days_7')}</option>
                  <option value={30}>{t('dashboard.projects.studio.bpm_modal.days_30')}</option>
                  <option value={90}>{t('dashboard.projects.studio.bpm_modal.days_90')}</option>
                  <option value={365}>{t('dashboard.projects.studio.bpm_modal.year_1')}</option>
                  <option value={0}>{t('dashboard.projects.studio.bpm_modal.forever')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 block">{t('dashboard.projects.studio.bpm_modal.error_email')}</label>
                <input 
                  type="email"
                  value={bpmConfig?.error_email || ''}
                  onChange={(e) => setBpmConfig((prev: any) => ({ ...prev, error_email: e.target.value }))}
                  placeholder={t('dashboard.projects.studio.bpm_modal.error_email_placeholder')}
                  className="w-full h-12 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-indigo-500 placeholder:text-neutral-400"
                />
                <p className="text-[10px] text-neutral-400 mt-1">{t('dashboard.projects.studio.bpm_modal.error_email_hint')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setIsBpmConfigModalOpen(false)}
                className="px-6 h-12 rounded-2xl font-black text-xs uppercase tracking-widest text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
              >
                {t('dashboard.projects.studio.bpm_modal.cancel')}
              </button>
              <button
                onClick={handleSaveBpmConfig}
                className="px-6 h-12 rounded-2xl font-black text-xs uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2"
              >
                <Settings2 className="w-4 h-4" />
                {t('dashboard.projects.studio.bpm_modal.save')}
              </button>
            </div>
          </div>
        </Modal>

        {/* Quick Start Modal */}
        <Modal
          isOpen={quickStartModal !== null}
          onClose={() => setQuickStartModal(null)}
          title={`Quick Start: ${quickStartModal?.logicName || ''}`}
        >
          {quickStartModal && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                    Nome do Caso de Uso
                  </label>
                  <input
                    type="text"
                    value={quickStartModal.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = (!quickStartModal.slug || quickStartModal.slug === quickStartModal.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')) 
                        ? name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') 
                        : quickStartModal.slug;
                      setQuickStartModal(prev => prev ? { ...prev, name, slug } : null);
                    }}
                    placeholder="Ex: Gestão de Projetos"
                    className="w-full h-12 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                    Slug
                  </label>
                  <input
                    type="text"
                    value={quickStartModal.slug}
                    onChange={(e) => setQuickStartModal(prev => prev ? { ...prev, slug: e.target.value.toLowerCase().replace(/\s/g, '-') } : null)}
                    placeholder="ex: gestao-de-projetos"
                    className="w-full h-12 px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">Identificador único na URL. Apenas letras minúsculas, números e hífens.</p>
                </div>
              </div>

              <div className="flex items-center gap-3 justify-end pt-4 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  onClick={() => setQuickStartModal(null)}
                  className="px-6 h-12 rounded-2xl font-black text-xs uppercase tracking-widest text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                >
                  Cancelar
                </button>
                <button
                  disabled={!quickStartModal.name || !quickStartModal.slug}
                  onClick={() => {
                    setViewToEdit({
                      name: quickStartModal.name,
                      slug: quickStartModal.slug,
                      logic_type: quickStartModal.logicType,
                      is_quick_add: true
                    });
                    setViewMode('builder');
                    setQuickStartModal(null);
                  }}
                  className="px-6 h-12 rounded-2xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal de Logs do Projeto */}
        <Modal
          isOpen={isLogsModalOpen}
          onClose={() => setIsLogsModalOpen(false)}
          title=""
          size="xl"
        >
          <div className="flex flex-col gap-4" style={{ minHeight: '70vh' }}>
            <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="p-2 rounded-xl bg-violet-500/10">
                <ScrollText className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <h2 className="text-base font-black text-neutral-900 dark:text-white">Logs do Projeto</h2>
                <p className="text-[11px] text-neutral-400">Armazenados localmente no banco do cliente • Acesso via túnel CLI</p>
              </div>
            </div>
            <ProjectLogsTab project={project} supabase={supabase} />
          </div>
        </Modal>

        <DesktopAppGeneratorModal
          isOpen={showDesktopModal}
          onClose={() => setShowDesktopModal(false)}
          contextType="project"
          contextId={project.id}
          defaultName={project.name}
          defaultDescription={project.description || ''}
          defaultTunnelUrl={typeof window !== 'undefined' ? `${window.location.origin}/${project.workspace?.slug || 'workspace'}/${project.slug}` : ''}
        />

        <Modal
          isOpen={isAISettingsModalOpen}
          onClose={() => setIsAISettingsModalOpen(false)}
          title="Configurações IA"
          className="max-w-2xl"
        >
          <AIBuilderSettings workspaceId={workspace.id} isPro={tier === 'pro'} />
        </Modal>
      </main>
    </>
  )
}
