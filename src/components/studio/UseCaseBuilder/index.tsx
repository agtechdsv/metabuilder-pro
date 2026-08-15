'use client'

// ─── UseCaseBuilderWizard — Orchestrator (Refactored) ───────────────────────
// This file is the lean orchestrator that was previously a 8000+ line monolith.
// All logic has been extracted into dedicated hooks and step components.

import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, Save, ChevronRight, ChevronLeft,
  Settings2, Database, Layout, MousePointer2,
  Trash2, CheckCircle2, Loader2, X
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { useTelemetry } from '@/hooks/useTelemetry'
import { useUpgradeModal } from '@/context/UpgradeModalContext'

// ── New modular hooks ──────────────────────────────────────────────────────────
import { useWizardData }      from './hooks/useWizardData'
import { useWizardConfig }    from './hooks/useWizardConfig'
import { useTelemetryDiff }   from './hooks/useTelemetryDiff'

// ── Steps ─────────────────────────────────────────────────────────────────────
import { StepLogic }         from './steps/StepLogic'
import { StepTables }        from './steps/StepTables'
import { StepPersonalizado } from './steps/StepPersonalizado'

// ── StepLayout + StepActions are still referenced from the original file via
//    lazy re-export to avoid one massive PR. They will be extracted in a future
//    pass. For now we re-export from the original location.
import { StepLayout }  from '../StepLayout'
import { StepActions } from '../StepActions'

// ── Utils ──────────────────────────────────────────────────────────────────────
import { createDefaultFieldMeta } from './utils'
import type { UseCaseBuilderWizardProps } from './types'

export function UseCaseBuilderWizard({
  initialData,
  onClose,
  onSaveSuccess,
  canCreate = true,
  projectRelations = []
}: UseCaseBuilderWizardProps) {
  const { t } = useI18n()
  const params = useParams()
  const { workspace_slug, project_slug } = params as { workspace_slug: string; project_slug: string }
  const supabase = createClient()
  const { toast } = useToast()
  const { openUpgrade } = useUpgradeModal()

  // ── Wizard navigation ───────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(initialData?.is_quick_add ? 2 : 1)
  const [isSaving, setIsSaving] = useState(false)
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false)
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<string>(initialData?.status || 'draft')

  // ── Data fetching ────────────────────────────────────────────────────────────
  const {
    models, enumerations, relations, useCases, bpmWorkflows,
    isLoading, isDownloadsActive,
    currentProjectId, currentWorkspaceId, virtualFields, byocComponents
  } = useWizardData({ projectSlug: project_slug })

  // ── Telemetry ────────────────────────────────────────────────────────────────
  const { logAction, flush } = useTelemetry({
    workspaceId: currentWorkspaceId,
    projectId: currentProjectId,
    uiViewId: initialData?.id,
    uiViewName: initialData?.name || 'Novo Caso de Uso'
  })

  // ── Config state ─────────────────────────────────────────────────────────────
  const { config, setConfig, isInitialized, orderedModels } = useWizardConfig({
    initialData,
    models,
    relations,
    currentStep,
    toast
  })

  // ── Telemetry diff tracking ───────────────────────────────────────────────────
  const { flushTextChanges } = useTelemetryDiff({
    config,
    models,
    currentStep,
    isInitialized,
    logAction,
    flush
  })

  // Log navigation
  useEffect(() => {
    if (currentStep > 1) {
      flushTextChanges()
      logAction('NAVIGATION', `Avançou para Etapa ${currentStep}`)
    }
  }, [currentStep]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step definitions ──────────────────────────────────────────────────────────
  const steps = [
    { id: 1, title: t('wizard.steps.logic', 'Lógica'), icon: <Settings2 className="w-4 h-4" /> },
    { id: 2, title: config.logic_type === 'personalizado' ? t('wizard.steps.master_uc', 'Caso de Uso Mestre') : t('wizard.steps.tables', 'Tabelas'), icon: <Database className="w-4 h-4" /> },
    { id: 3, title: t('wizard.steps.layout', 'Campos & Layout'), icon: <Layout className="w-4 h-4" />, hidden: config.logic_type === 'personalizado' },
    { id: 4, title: t('wizard.steps.actions', 'Query & Ações Finais'), icon: <MousePointer2 className="w-4 h-4" /> }
  ].filter(s => !(s as any).hidden)

  // ── Validation ────────────────────────────────────────────────────────────────
  const isStepValid = (step: number): boolean => {
    if (step === 1) return !!(config.name && config.slug && config.logic_type)
    if (step === 2) {
      if (config.logic_type === 'personalizado') return !!(config.layout_config as any).master_use_case_slug
      return config.selected_models.length > 0
    }
    if (step === 3) {
      const { logic_type, has_arguments, layout_config } = config
      const hasGrid   = layout_config.grid_fields.length > 0
      const hasFilter = layout_config.filter_fields.length > 0
      const hasForm   = layout_config.form_fields.length > 0

      if (logic_type === 'pesquisa')         return hasGrid && (!has_arguments || hasFilter)
      if (logic_type === 'cadastro')         return hasForm
      if (logic_type === 'pesquisa_cadastro') return hasGrid && hasForm && (!has_arguments || hasFilter)
      if (logic_type === 'kanban')           return !!(layout_config as any).kanban_group_field && hasGrid
      if (logic_type === 'timeline')         return !!((layout_config as any).timeline_config?.date_field && (layout_config as any).timeline_config?.title_field)
      if (logic_type === 'map')              return !!((layout_config as any).map_config?.lat_field && (layout_config as any).map_config?.lng_field && (layout_config as any).map_config?.title_field)
      if (logic_type === 'gantt')            return !!((layout_config as any).gantt_config?.title_field && (layout_config as any).gantt_config?.start_date_field && (layout_config as any).gantt_config?.end_date_field)
      if (logic_type === 'blueprint')        return !!((layout_config as any).blueprint_config?.title_field && (layout_config as any).blueprint_config?.predecessor_field)
      if (logic_type === 'scheduler')        return !!((layout_config as any).scheduler_config?.title_field && (layout_config as any).scheduler_config?.start_date_field) && hasGrid
      if (logic_type === 'mapa_mental')      return !!(layout_config as any).mindmap_levels?.length && hasGrid
      if (logic_type === 'master_detail')    return config.selected_models.length >= 2 && !!(layout_config as any).master_model_id && hasGrid
      if (logic_type === 'personalizado')    return !!((layout_config as any).custom_slots?.length)
      return true
    }
    return true
  }

  const nextStep = () => {
    if (!isStepValid(currentStep)) {
      if (currentStep === 1) toast(t('wizard.buttons.validation.name_slug_required'), 'error')
      if (currentStep === 2 && config.selected_models.length < 1) { toast(t('dashboard.projects.studio.config.db_fields_desc').replace('{table}', ''), 'error'); return }
      if (currentStep === 3) {
        const { logic_type, has_arguments, layout_config } = config
        if (!layout_config.grid_fields.length && logic_type !== 'cadastro')   toast(t('wizard.buttons.validation.grid_required'), 'error')
        if (!layout_config.form_fields.length && ['cadastro', 'pesquisa_cadastro', 'master_detail'].includes(logic_type)) toast(t('wizard.buttons.validation.form_required'), 'error')
        if (has_arguments && !layout_config.filter_fields.length && logic_type.includes('pesquisa')) toast(t('wizard.buttons.validation.filter_required'), 'error')
        if (logic_type === 'kanban'      && !(layout_config as any).kanban_group_field) toast('Por favor, selecione um campo de agrupamento para o Kanban.', 'error')
        if (logic_type === 'timeline'    && (!(layout_config as any).timeline_config?.date_field || !(layout_config as any).timeline_config?.title_field)) toast('Por favor, selecione os campos de data e título para a Linha do Tempo.', 'error')
        if (logic_type === 'map'         && (!(layout_config as any).map_config?.lat_field || !(layout_config as any).map_config?.lng_field)) toast('Por favor, selecione os campos de Latitude, Longitude e Título para o Mapa.', 'error')
        if (logic_type === 'gantt'       && (!(layout_config as any).gantt_config?.title_field || !(layout_config as any).gantt_config?.start_date_field || !(layout_config as any).gantt_config?.end_date_field)) toast('Por favor, selecione os campos de Título, Data Inicial e Data Final para o Gantt.', 'error')
        if (logic_type === 'blueprint'   && (!(layout_config as any).blueprint_config?.title_field || !(layout_config as any).blueprint_config?.predecessor_field)) toast('Por favor, selecione os campos de Título e Predecessora para o Fluxograma.', 'error')
        if (logic_type === 'scheduler'   && (!(layout_config as any).scheduler_config?.title_field || !(layout_config as any).scheduler_config?.start_date_field)) toast('Por favor, selecione os campos de título e data de início para o Calendário.', 'error')
        if (logic_type === 'mapa_mental' && !(layout_config as any).mindmap_levels?.length) toast('Por favor, configure a hierarquia do Mapa Mental.', 'error')
        if (logic_type === 'master_detail' && !(layout_config as any).master_model_id) toast('Por favor, selecione a Tabela Mestre.', 'error')
        if (logic_type === 'personalizado' && !(layout_config as any).custom_slots?.length) toast('Por favor, adicione pelo menos uma aba no Layout Personalizado.', 'error')
      }
      return
    }

    // Analytics: ensure at least one model is selected
    if (currentStep === 1 && config.logic_type === 'analytics' && config.selected_models.length === 0 && models.length > 0) {
      setConfig(prev => ({ ...prev, selected_models: [models[0].id] }))
    }

    const currentIndex = steps.findIndex(s => s.id === currentStep)
    if (currentIndex < steps.length - 1) setCurrentStep(steps[currentIndex + 1].id)
  }

  const prevStep = () => {
    const currentIndex = steps.findIndex(s => s.id === currentStep)
    if (currentIndex > 0) setCurrentStep(steps[currentIndex - 1].id)
  }

  // ── Save (draft) ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!canCreate) { toast('Você não tem permissão para salvar alterações.', 'error'); return }
    if (!config.name || !config.slug) { toast(t('wizard.buttons.validation.name_slug_required'), 'error'); return }

    setIsSaving(true)
    try {
      const { data: projectData } = await supabase.from('projects').select('id, navigation').eq('slug', project_slug).single()

      const validFieldIds = new Set(models.flatMap(m => (m.fields ?? []).map(f => f.id)))
      const filterValid = (arr: string[]) => (arr || []).filter(fid => validFieldIds.has(fid) || fid.startsWith('virt_') || fid.startsWith('byoc_'))

      const validFormFields   = filterValid(config.layout_config.form_fields)
      const validGridFields   = filterValid(config.layout_config.grid_fields)
      const validFilterFields = filterValid(config.layout_config.filter_fields)

      const allFieldIds = new Set([...validFormFields, ...validGridFields, ...validFilterFields])
      const populatedFieldsMeta = { ...config.layout_config.fields_metadata }
      allFieldIds.forEach(fid => { if (!populatedFieldsMeta[fid]) populatedFieldsMeta[fid] = createDefaultFieldMeta(fid, models) })

      const cleanLayoutConfig = {
        ...config.layout_config,
        form_fields:   validFormFields,
        grid_fields:   validGridFields,
        filter_fields: validFilterFields
      }

      const draftPayload = {
        name: config.name,
        slug: config.slug,
        logic_type: config.logic_type,
        has_arguments: config.has_arguments,
        tables_config: config.selected_models,
        query_type: config.query_type,
        custom_query: config.custom_query,
        layout_config: { ...cleanLayoutConfig, fields_metadata: populatedFieldsMeta, is_active: true },
        buttons_config: config.buttons_config,
        model_id: config.selected_models[0] || null,
        project_id: currentProjectId,
        view_type: 'advanced_use_case'
      }

      // Check for slug conflict
      const { data: existingBySlug } = await supabase
        .from('ui_views').select('id')
        .eq('project_id', currentProjectId)
        .eq('slug', config.slug)
        .maybeSingle()

      if (existingBySlug && (!initialData || existingBySlug.id !== initialData.id)) {
        toast('Já existe um caso de uso com este slug neste projeto.', 'error')
        setIsSaving(false)
        return
      }

      // Check Freemium Use Case Limit (4)
      if (!initialData?.id && currentWorkspaceId) {
        const { data: workspace } = await supabase.from('workspaces').select('owner_id').eq('id', currentWorkspaceId).single()
        if (workspace) {
          const { data: profile } = await supabase.from('workspace_profiles').select('subscription_status').eq('user_id', workspace.owner_id).single()
          
          if (profile && (profile.subscription_status === 'pending' || profile.subscription_status === 'blocked')) {
            const { count } = await supabase.from('ui_views').select('*', { count: 'exact', head: true }).eq('project_id', currentProjectId)
            if (count !== null && count >= 4) {
              openUpgrade('Novo Caso de Uso')
              setIsSaving(false)
              return
            }
          }
        }
      }

      let view: any
      let viewError: any

      if (initialData?.id) {
        const { data, error } = await supabase.from('ui_views').update({ draft_config: draftPayload }).eq('id', initialData.id).select().single()
        view = data; viewError = error
      } else {
        const { data, error } = await supabase.from('ui_views').insert({
          project_id: projectData?.id,
          name: config.name,
          slug: config.slug,
          view_type: 'advanced_use_case',
          logic_type: config.logic_type,
          model_id: config.selected_models[0] || null,
          draft_config: draftPayload
        }).select().single()
        view = data; viewError = error
      }

      if (viewError) throw viewError

      // Update navigation references if slug changed
      if (initialData && initialData.slug && initialData.slug !== config.slug && projectData?.navigation && Array.isArray(projectData.navigation)) {
        const updateMenuTarget = (items: any[]): any[] => items.map(item => {
          const updated = { ...item }
          if (updated.type === 'view' && updated.target === initialData.slug) updated.target = config.slug
          if (updated.children) updated.children = updateMenuTarget(updated.children)
          return updated
        })
        await supabase.from('projects').update({ navigation: updateMenuTarget(projectData.navigation) }).eq('id', projectData.id)
      }

      flushTextChanges()
      logAction('SAVE', 'Salvou rascunho do caso de uso')
      await flush(view.id)
      toast('Rascunho salvo! Clique em Publicar para liberar aos usuários.', 'success')
      onSaveSuccess()
    } catch (err: any) {
      console.error(err)
      if (!initialData?.id && err?.code === '42501') {
        openUpgrade('Novo Caso de Uso')
      } else {
        toast(t('wizard.buttons.error_save') + err.message, 'error')
      }
    } finally {
      setIsSaving(false)
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!initialData?.id) return
    setIsSaving(true)
    try {
      const { data: currentView, error: readError } = await supabase.from('ui_views').select('status, draft_config').eq('id', initialData.id).single()
      if (readError) throw readError

      const draft = currentView?.draft_config
      if (!draft) { toast('Nenhum rascunho encontrado para publicar.', 'error'); setIsSaving(false); return }

      const { error: publishError } = await supabase.from('ui_views').update({
        name: draft.name, slug: draft.slug, logic_type: draft.logic_type,
        has_arguments: draft.has_arguments, tables_config: draft.tables_config,
        query_type: draft.query_type, custom_query: draft.custom_query,
        layout_config: draft.layout_config, buttons_config: draft.buttons_config,
        model_id: draft.model_id, status: 'delivered', draft_config: null
      }).eq('id', initialData.id)

      if (publishError) throw publishError

      // Rebuild ui_components from published draft
      await supabase.from('ui_components').delete().eq('view_id', initialData.id)

      const draftLayout  = draft.layout_config || {}
      const draftMeta    = draftLayout.fields_metadata || {}
      const componentMap: Record<string, any> = {}

      const addComponent = (fid: string, zone: string) => {
        if (fid.startsWith('virt_')) return
        const zoneMeta   = draftMeta[`${zone}-${fid}`]
        const globalMeta = draftMeta[fid] || {}
        const metadata   = zoneMeta || globalMeta
        const labelText  = metadata.label?.text || fid

        if (!componentMap[fid]) {
          componentMap[fid] = { view_id: initialData.id, field_id: fid, component_type: zone, label: labelText, is_visible: true, config: { zones: [zone], [`${zone}_config`]: metadata, ...metadata } }
        } else {
          if (!componentMap[fid].config.zones.includes(zone)) componentMap[fid].config.zones.push(zone)
          componentMap[fid].config[`${zone}_config`] = metadata
          if (zone === 'form' && metadata.label?.text) componentMap[fid].label = metadata.label.text
        }
      }

      ;(draftLayout.filter_fields || []).forEach((fid: string) => addComponent(fid, 'filter'))
      ;(draftLayout.grid_fields   || []).forEach((fid: string) => addComponent(fid, 'grid'))
      ;(draftLayout.form_fields   || []).forEach((fid: string) => addComponent(fid, 'form'))

      const toInsert = Object.values(componentMap)
      if (toInsert.length > 0) {
        const { error: compError } = await supabase.from('ui_components').insert(toInsert)
        if (compError) throw compError
      }

      // Ensure the view is present in the project navigation. If not, add it.
      const { data: projectData } = await supabase.from('projects').select('id, navigation').eq('slug', project_slug).single()
      if (projectData) {
        const navigationArray = Array.isArray(projectData.navigation) ? projectData.navigation : []
        const hasMenuItem = (items: any[]): boolean => {
          return items.some(item => 
            (item.type === 'view' && item.target === draft.slug) || 
            (item.children && hasMenuItem(item.children))
          )
        }
        
        if (!hasMenuItem(navigationArray)) {
          const newMenuItem = {
            id: 'menu_' + Math.random().toString(36).substr(2, 9),
            label: draft.name,
            description: '',
            icon: 'Layout',
            type: 'view',
            target: draft.slug,
            show_dashboard: true
          }
          const updatedNavigation = [...navigationArray, newMenuItem]
          await supabase.from('projects').update({ navigation: updatedNavigation }).eq('id', projectData.id)
        }
      }

      setCurrentStatus('delivered')
      flushTextChanges()
      logAction('LIFECYCLE', 'Publicou o Caso de Uso')
      toast('Caso de Uso publicado com sucesso! Os usuários já podem acessar.', 'success')
      onSaveSuccess()
    } catch (err: any) {
      toast('Erro ao publicar: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
      setIsPublishModalOpen(false)
    }
  }

  // ── Discard draft ─────────────────────────────────────────────────────────────
  const executeDiscardDraft = async () => {
    if (!initialData?.id) return
    setIsSaving(true)
    try {
      const { error } = await supabase.from('ui_views').update({ draft_config: null }).eq('id', initialData.id)
      if (error) throw error
      toast('Rascunho descartado com sucesso.', 'success')
      setIsDiscardModalOpen(false)
      onSaveSuccess()
      onClose()
    } catch (err: any) {
      toast('Erro ao descartar: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
      <p className="text-sm font-bold animate-pulse">{t('common.loading')}</p>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col pb-32">

      {/* Header */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2" />
            <div>
              <h1 className="text-sm font-black tracking-tight">{t('wizard.title')}</h1>
              <p className="text-[8px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-[0.2em]">
                {initialData ? t('wizard.edit_mode') : t('wizard.new_mode')}
                {config.name && <span className="text-neutral-400 dark:text-neutral-500 ml-1">/ {config.name}</span>}
              </p>
            </div>
          </div>

          {canCreate && (
            <div className="flex items-center gap-4">
              {initialData && (
                <>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                    initialData.draft_config ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  )}>
                    {initialData.draft_config ? t('wizard.status.draft_pending', 'Rascunho Pendente') : t('wizard.status.published', 'Publicado')}
                  </div>
                  {initialData.draft_config && (
                    <>
                      <button onClick={() => setIsDiscardModalOpen(true)} className="flex items-center gap-2 px-6 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-red-500/5 active:scale-95 border border-red-500/20">
                        <Trash2 className="w-3.5 h-3.5" /> {t('wizard.buttons.discard_draft', 'Descartar Rascunho')}
                      </button>
                      <button onClick={() => setIsPublishModalOpen(true)} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 active:scale-95">
                        🚀 {t('wizard.buttons.publish', 'Publicar')}
                      </button>
                    </>
                  )}
                </>
              )}
              <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 active:scale-95">
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {isSaving ? (initialData ? t('wizard.buttons.updating') : t('wizard.buttons.saving')) : (initialData ? t('wizard.buttons.update') : t('wizard.buttons.finish'))}
              </button>
            </div>
          )}
        </div>

        {/* Stepper */}
        <div className="bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 px-6 py-4 rounded-[2rem]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className={cn("flex items-center gap-3 transition-all", currentStep >= idx + 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400')}>
                  <div className={cn(
                    "w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black text-[10px] transition-all shadow-sm",
                    currentStep === idx + 1 ? 'border-indigo-600 bg-indigo-600 text-white rotate-3 shadow-indigo-500/20' :
                    currentStep > idx + 1  ? 'border-indigo-600 bg-indigo-600/10' :
                                             'border-neutral-200 dark:border-neutral-800'
                  )}>
                    {currentStep > idx + 1 ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] hidden sm:block">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn("flex-1 mx-6 h-px transition-colors", currentStep > idx + 1 ? 'bg-indigo-600/30' : 'bg-neutral-200 dark:bg-neutral-800')} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="mt-6 min-h-[500px]">
        {currentStep === 1 && (
          <StepLogic config={config} setConfig={setConfig} />
        )}
        {currentStep === 2 && config.logic_type === 'personalizado' ? (
          <StepPersonalizado config={config} setConfig={setConfig} models={models} useCases={useCases} relations={relations} />
        ) : currentStep === 2 ? (
          <StepTables config={config} setConfig={setConfig} models={models} relations={relations} />
        ) : null}
        {currentStep === 3 && (
          <StepLayout config={config} setConfig={setConfig} models={models} enumerations={enumerations} relations={relations} useCases={useCases} orderedModels={orderedModels} virtualFields={virtualFields} byocComponents={byocComponents} />
        )}
        {currentStep === 4 && (
          <StepActions config={config} setConfig={setConfig} models={models} useCases={useCases} isDownloadsActive={isDownloadsActive} bpmWorkflows={bpmWorkflows} relations={relations} />
        )}
      </div>

      {/* Floating Footer Navigation */}
      <div className="fixed bottom-6 left-0 right-0 flex justify-center px-6 z-40">
        <div className="w-full max-w-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 p-2 rounded-full flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-0",
              currentStep === steps[steps.length - 1].id
                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xl"
                : "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            <ChevronLeft className="w-3 h-3" /> {t('wizard.buttons.prev')}
          </button>

          <button
            onClick={currentStep === steps[steps.length - 1].id ? handleSave : nextStep}
            disabled={isSaving || (currentStep === steps[steps.length - 1].id && !canCreate)}
            className={cn(
              "flex items-center gap-2 px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl",
              currentStep === steps[steps.length - 1].id
                ? (!canCreate ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed opacity-50" : "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800")
                : !isStepValid(currentStep)
                  ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed opacity-50"
                  : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-neutral-900/10 dark:shadow-white/5"
            )}
          >
            {currentStep === steps[steps.length - 1].id ? (
              isSaving
                ? <><Loader2 className="w-3 h-3 animate-spin" /> {initialData ? t('wizard.buttons.updating') : t('wizard.buttons.saving')}</>
                : <>{!canCreate ? 'Sem permissão' : (initialData ? t('wizard.buttons.update') : t('wizard.buttons.finish'))} <Save className="w-3 h-3 ml-1" /></>
            ) : (
              <>{t('wizard.buttons.next')} <ChevronRight className="w-3 h-3" /></>
            )}
          </button>
        </div>
      </div>

      {/* Discard Draft Modal */}
      {isDiscardModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDiscardModalOpen(false)} />
          <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 pb-4">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Descartar Rascunho</h3>
                <button onClick={() => setIsDiscardModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white ml-auto"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="px-8 pb-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5 text-red-500" /></div>
                <div>
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-1">Tem certeza que deseja descartar?</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">Todas as alterações não publicadas serão permanentemente perdidas e o caso de uso voltará ao estado da última versão publicada. Esta ação não pode ser desfeita.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setIsDiscardModalOpen(false)} disabled={isSaving} className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={executeDiscardDraft} disabled={isSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                  {isSaving ? 'Descartando...' : 'Sim, Descartar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsPublishModalOpen(false)} />
          <div className="relative bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 pb-4">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Publicar Alterações</h3>
                <button onClick={() => setIsPublishModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:bg-neutral-800 rounded-xl transition-colors text-neutral-500 hover:text-neutral-900 dark:hover:text-white ml-auto"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="px-8 pb-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
                <div>
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-1">Tem certeza que deseja publicar?</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">Todas as alterações do rascunho serão aplicadas e ficarão disponíveis imediatamente para os usuários finais em produção.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setIsPublishModalOpen(false)} disabled={isSaving} className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={handlePublish} disabled={isSaving} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isSaving ? 'Publicando...' : 'Sim, Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
