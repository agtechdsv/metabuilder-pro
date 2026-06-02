'use client'

import React, { useState, useTransition, useEffect } from 'react'

import {
  LayoutDashboard,
  Database,
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
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { useI18n } from '@/i18n/I18nContext'
import { UseCaseBuilderWizard } from '@/components/studio/UseCaseBuilderWizard'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { MenuBuilder } from '@/components/studio/MenuBuilder'
import { EnumerationsClient } from '../enumerations/EnumerationsClient'
import { EnumerationsClient } from '../enumerations/EnumerationsClient'

const RETENTION_OPTIONS = [
  { value: '', label: '∞ Manter para Sempre' },
  { value: '1', label: '1 Hora' },
  { value: '6', label: '6 Horas' },
  { value: '12', label: '12 Horas' },
  { value: '24', label: '24 Horas' },
  { value: '72', label: '3 Dias' },
  { value: '168', label: '7 Dias' },
]

function RetentionDropdown({
  value,
  onChange,
  disabled
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
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
          {selected.label}
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
              {opt.label}
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
  canDelete
}: StudioDashboardClientProps) {
  const { t } = useI18n()
  const router = useRouter()
  const supabase = createClient()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

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
      toast('Erro ao atualizar retenção de downloads.', 'error')
    } else {
      toast('Política de retenção atualizada!', 'success')
    }
    setIsUpdatingRetention(false)
  }

  const [viewMode, setViewMode] = useState<'list' | 'builder' | 'navigation' | 'enumerations'>('list')
  const [viewToEdit, setViewToEdit] = useState<any>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [viewToDelete, setViewToDelete] = useState<any>(null)
  const userViews = views?.filter(view => view.slug !== 'downloads' && view.slug !== 'automations') || []
  const downloadsView = views?.find(view => view.slug === 'downloads')
  const isDownloadsActive = downloadsView ? (downloadsView.layout_config?.is_active !== false) : true
  const automationsView = views?.find(view => view.slug === 'automations')
  const isAutomationsActive = automationsView ? (automationsView.layout_config?.is_active !== false) : false
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  const handleDeleteView = async () => {
    if (!viewToDelete) return
    try {
      const { error } = await supabase
        .from('ui_views')
        .delete()
        .eq('id', viewToDelete.id)

      if (error) throw error

      toast(t('dashboard.projects.studio.toasts.delete_success'), 'success')
      setIsDeleteModalOpen(false)
      setViewToDelete(null)
      router.refresh()
    } catch (err: any) {
      toast(t('dashboard.projects.studio.toasts.error_delete') + err.message, 'error')
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

      toast(newActiveState ? 'Módulo de Automações ativado!' : 'Módulo de Automações desativado!', 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao alterar status das automações: ' + err.message, 'error')
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

      toast('Menu de navegação salvo com sucesso!', 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao salvar menu: ' + err.message, 'error')
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

      toast(newActiveState ? 'Central de Downloads ativada!' : 'Central de Downloads desativada!', 'success')
      router.refresh()
    } catch (err: any) {
      toast('Erro ao alterar status de downloads: ' + err.message, 'error')
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

        {viewMode !== 'builder' && (
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
                 Casos de Uso
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
                     Navegação
                   </button>
                   <button 
                    onClick={() => setViewMode('enumerations')}
                    className={cn(
                      "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                      viewMode === 'enumerations' ? "bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                    )}
                   >
                     <Database className="w-3.5 h-3.5" /> Enums
                   </button>
                 </>
               )}
            </div>

            {canCreate && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setViewToEdit(null)
                    setViewMode('builder')
                  }}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                >
                  <Plus className="w-4 h-4" /> {t('dashboard.projects.studio.new_use_case')}
                </button>
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
                  <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">ID Projeto:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-[8px] text-neutral-400 font-mono bg-neutral-100 dark:bg-black/40 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={project.id}>{project.id}</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(project.id)
                        toast("ID do Projeto copiado!", 'success')
                      }}
                      className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase hover:underline"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {/* Linha 2: Token Secreto */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-100 dark:border-neutral-800/50 pt-2">
                  <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Token Secreto:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-[8px] text-neutral-400 font-mono bg-neutral-100 dark:bg-black/40 px-1.5 py-0.5 rounded truncate max-w-[80px]" title={project.secret_token || ''}>
                      {project.secret_token ? `${project.secret_token.substring(0, 8)}...` : 'N/A'}
                    </code>
                    <button
                      onClick={() => {
                        if (project.secret_token) {
                          navigator.clipboard.writeText(project.secret_token)
                          toast("Token Secreto copiado!", 'success')
                        } else {
                          toast("Nenhum token disponível.", 'error')
                        }
                      }}
                      className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase hover:underline"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {/* Linha 3: Retenção de Downloads */}
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/50">
                  <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block mb-1.5">Retenção de Exports:</span>
                  <RetentionDropdown
                    value={retention}
                    onChange={updateRetention}
                    disabled={isUpdatingRetention}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'builder' ? (
          <UseCaseBuilderWizard
            initialData={viewToEdit}
            onClose={() => {
              setViewMode('list')
              setViewToEdit(null)
            }}
            onSaveSuccess={refreshData}
            canCreate={canCreate}
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
              <h3 className="text-xl font-black flex items-center gap-3 text-neutral-900 dark:text-white tracking-tight">
                <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
                {t('dashboard.projects.studio.use_cases')}
              </h3>
              <div className="flex items-center gap-4">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {/* 1. Card Fixo do Portal de Login (Sistema) */}
              <div className="group relative p-5 bg-gradient-to-br from-indigo-600/5 to-purple-600/5 dark:from-indigo-600/10 dark:to-purple-600/10 border border-indigo-500/20 dark:border-indigo-500/30 rounded-[1.5rem] hover:border-indigo-500 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1">
                <div className="flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black tracking-tight text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {t('dashboard.projects.studio.login_portal')}
                        </h4>
                        <div className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                          {t('dashboard.projects.system_label')}
                        </div>
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
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-500/20"
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
                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-500/20"
                      >
                        <ExternalLink className="w-4 h-4" /> Visualizar Portal
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Card do BPM/Automações (Sistema) */}
              <div className="group relative p-5 bg-gradient-to-br from-emerald-600/5 to-teal-600/5 dark:from-emerald-600/10 dark:to-teal-600/10 border border-emerald-500/20 dark:border-emerald-500/30 rounded-[1.5rem] hover:border-emerald-500 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1">
                <div className="flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-lg font-black tracking-tight transition-colors ${isAutomationsActive ? 'text-neutral-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400' : 'text-neutral-400 italic'}`}>
                          Automações / BPM
                        </h4>
                        <div className="px-2 py-0.5 bg-emerald-600 text-white text-[8px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                          {t('dashboard.projects.system_label')}
                        </div>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                        <span className="opacity-50">/</span>{workspace_slug}/{project_slug}/automations
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                       {canCreate ? (
                         <button
                           onClick={handleToggleAutomations}
                           className={`p-1 rounded-md transition-colors ${isAutomationsActive ? 'text-emerald-500 hover:bg-emerald-500/20' : 'text-neutral-400 hover:bg-neutral-500/10'}`}
                           title={isAutomationsActive ? t('dashboard.projects.studio.status_active') : t('dashboard.projects.studio.status_inactive')}
                         >
                           {isAutomationsActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                         </button>
                       ) : (
                         <span
                           className={`p-1 rounded-md cursor-default ${isAutomationsActive ? 'text-emerald-500' : 'text-neutral-400'}`}
                         >
                           {isAutomationsActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                         </span>
                       )}
                      <Workflow className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-auto flex gap-3">
                    {canCreate ? (
                      <>
                        <button
                          onClick={handleToggleAutomations}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-emerald-500/20"
                        >
                          <Settings2 className="w-4 h-4" /> {isAutomationsActive ? 'Desativar Módulo' : 'Ativar Módulo'}
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
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-2xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-emerald-500/20"
                        >
                          <ExternalLink className="w-4 h-4" /> Acessar BPM
                        </Link>
                      )
                    )}
                  </div>

              {/* 3. Card da Central de Downloads (Sistema) */}
              <div className="group relative p-5 bg-gradient-to-br from-blue-600/5 to-cyan-600/5 dark:from-blue-600/10 dark:to-cyan-600/10 border border-blue-500/20 dark:border-blue-500/30 rounded-[1.5rem] hover:border-blue-500 transition-all duration-500 shadow-sm hover:shadow-2xl hover:-translate-y-1">
                <div className="flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-lg font-black tracking-tight transition-colors ${isDownloadsActive ? 'text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400' : 'text-neutral-400 italic'}`}>
                          Central de Downloads
                        </h4>
                        <div className="px-2 py-0.5 bg-blue-600 text-white text-[8px] font-black rounded-lg uppercase tracking-widest shadow-lg shadow-blue-500/20">
                          {t('dashboard.projects.system_label')}
                        </div>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                        <span className="opacity-50">/</span>{workspace_slug}/{project_slug}/downloads
                      </p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600 dark:text-blue-400 flex items-center gap-2">
                       {canCreate ? (
                         <button
                           onClick={handleToggleDownloads}
                           className={`p-1 rounded-md transition-colors ${isDownloadsActive ? 'text-blue-500 hover:bg-blue-500/20' : 'text-neutral-400 hover:bg-neutral-500/10'}`}
                           title={isDownloadsActive ? t('dashboard.projects.studio.status_active') : t('dashboard.projects.studio.status_inactive')}
                         >
                           {isDownloadsActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                         </button>
                       ) : (
                         <span
                           className={`p-1 rounded-md cursor-default ${isDownloadsActive ? 'text-blue-500' : 'text-neutral-400'}`}
                         >
                           {isDownloadsActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                         </span>
                       )}
                      <Download className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-auto flex gap-3">
                    {canCreate ? (
                      <>
                        <button
                          onClick={handleToggleDownloads}
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-blue-500/20"
                        >
                          <Settings2 className="w-4 h-4" /> {isDownloadsActive ? 'Desativar Módulo' : 'Ativar Módulo'}
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
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-2xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-blue-500/20"
                        >
                          <ExternalLink className="w-4 h-4" /> Acessar Downloads
                        </Link>
                      )
                    )}
                  </div>
                </div>
              </div>

              {userViews.map((view) => (
                <div
                  key={view.id}
                  className="group relative p-5 bg-white dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] hover:border-indigo-500/50 transition-all duration-500 shadow-sm hover:shadow-2xl dark:shadow-none hover:-translate-y-1"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black rounded-lg border border-indigo-500/20 uppercase tracking-widest w-fit">
                            {view.logic_type?.replace('_', ' + ') || 'Custom'}
                          </div>
                          {canCreate ? (
                            <button
                              onClick={() => handleToggleActive(view)}
                              className={`p-1 rounded-md transition-colors ${view.layout_config?.is_active !== false ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-neutral-400 hover:bg-neutral-500/10'}`}
                              title={view.layout_config?.is_active !== false ? t('dashboard.projects.studio.status_active') : t('dashboard.projects.studio.status_inactive')}
                            >
                              {view.layout_config?.is_active !== false ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                            </button>
                          ) : (
                            <span
                              className={`p-1 rounded-md cursor-default ${view.layout_config?.is_active !== false ? 'text-emerald-500' : 'text-neutral-400'}`}
                              title={view.layout_config?.is_active !== false ? t('dashboard.projects.studio.status_active') : t('dashboard.projects.studio.status_inactive')}
                            >
                              {view.layout_config?.is_active !== false ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                            </span>
                          )}
                        </div>
                        <h4 className={`text-lg font-bold tracking-tight transition-colors ${view.layout_config?.is_active !== false ? 'text-neutral-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : 'text-neutral-400 italic'}`}>
                          {view.name}
                        </h4>
                        <p className="text-xs text-neutral-400 font-mono flex items-center gap-1.5 tracking-tight">
                          <span className="opacity-50">/</span>{view.slug}
                        </p>
                      </div>

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

                    <div className="pt-2 flex gap-3">
                      {canCreate ? (
                        <>
                          <button
                            onClick={() => {
                              setViewToEdit(view)
                              setViewMode('builder')
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-neutral-900/10 dark:shadow-white/5"
                          >
                            <Settings2 className="w-4 h-4" /> {t('dashboard.projects.studio.configure')}
                          </button>
                          <Link
                            href={`/${workspace_slug}/${project_slug}/${view.slug}`}
                            target="_blank"
                            className="w-14 flex items-center justify-center bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 rounded-2xl border border-neutral-200 dark:border-neutral-700 transition-all text-neutral-400 hover:text-indigo-600 dark:hover:text-white shadow-sm"
                          >
                            <ArrowRight className="w-5 h-5" />
                          </Link>
                        </>
                      ) : (
                        <Link
                          href={`/${workspace_slug}/${project_slug}/${view.slug}`}
                          target="_blank"
                          className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl text-xs font-black tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-neutral-900/10 dark:shadow-white/5"
                        >
                          <ArrowRight className="w-4 h-4" /> Acessar Caso de Uso
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {userViews.length === 0 && (
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

      </main>
    </>
  )
}
