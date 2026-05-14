'use client'
// Refined UseCaseBuilderWizard - Metadata Driven Actions Order

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Save,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Settings2,
  Database,
  Layout,
  MousePointer2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Pencil,
  RefreshCcw,
  Table,
  GripVertical,
  ArrowRight,
  Type,
  Palette,
  Maximize2,
  Lock,
  Type as FontIcon,
  Share2,
  Columns,
  Settings,
  Wand2,
  Terminal,
  RotateCcw,
  Link,
  Layers
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion, useDragControls } from 'framer-motion'

interface UseCaseBuilderWizardProps {
  initialData?: any
  onClose: () => void
  onSaveSuccess: () => void
}

export function UseCaseBuilderWizard({ initialData, onClose, onSaveSuccess }: UseCaseBuilderWizardProps) {
  const { t } = useI18n()
  const params = useParams()
  const { workspace_slug, project_slug } = params
  const supabase = createClient()
  const { toast } = useToast()

  // Estados do Wizard
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [models, setModels] = useState<any[]>([])

  // Helpers de modo edição
  const isEditMode = !!initialData
  const viewId = initialData?.id

  // Popula os dados iniciais se estiver em modo edição
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (initialData && !isInitialized) {
      setConfig({
        name: initialData.name || '',
        slug: initialData.slug || '',
        logic_type: initialData.logic_type || 'pesquisa_cadastro',
        has_arguments: initialData.has_arguments ?? true,
        selected_models: initialData.tables_config || [],
        tables_config: initialData.tables_config || [],
        query_type: initialData.query_type || 'dynamic',
        custom_query: initialData.custom_query || '',
        layout_config: {
          filter_fields: initialData.layout_config?.filter_fields || [],
          grid_fields: initialData.layout_config?.grid_fields || [],
          form_fields: initialData.layout_config?.form_fields || [],
          grouping_type: initialData.layout_config?.grouping_type || 'sections',
          display_type: initialData.layout_config?.display_type || 'list',
          default_view: initialData.layout_config?.default_view || 'list',
          kanban_group_field: initialData.layout_config?.kanban_group_field || '',
          master_model_id: initialData.layout_config?.master_model_id || '',
          detail_display_mode: initialData.layout_config?.detail_display_mode || 'tabs',
          mindmap_central_field: initialData.layout_config?.mindmap_central_field || '',
          action_interface_type: initialData.layout_config?.action_interface_type || 'drawer',
          joins: initialData.layout_config?.joins || [],
          fields_metadata: initialData.layout_config?.fields_metadata || {}
        },
        buttons_config: (() => {
          const defaults = [
            { id: 'search', label: t('runtime.search'), labelKey: 'runtime.search', icon: 'search', action: 'search', visible: true },
            { id: 'clear', label: t('runtime.clear'), labelKey: 'runtime.clear', icon: 'refresh-ccw', action: 'clear', visible: true },
            { id: 'view', label: t('runtime.view'), labelKey: 'runtime.view', icon: 'search', action: 'view', visible: true },
            { id: 'add', label: t('runtime.new_record'), labelKey: 'runtime.new_record', icon: 'plus', action: 'create', visible: true },
            { id: 'edit', label: t('runtime.edit'), labelKey: 'runtime.edit', icon: 'pencil', action: 'pencil', action_key: 'update', visible: true },
            { id: 'delete', label: t('runtime.delete'), labelKey: 'runtime.delete', icon: 'trash', action_key: 'delete', visible: true }
          ]
          if (!initialData.buttons_config) return defaults
          // Merge: Keep existing visible states, but ensure all default IDs exist
          return defaults.map(def => {
            const existing = initialData.buttons_config.find((b: any) => b.id === def.id)
            return existing ? { ...def, ...existing } : { ...def, visible: false }
          })
        })()
      })
      setIsInitialized(true)
    }
  }, [initialData, isInitialized])

  // Configuração da View sendo criada
  const [config, setConfig] = useState({
    name: '',
    slug: '',
    logic_type: 'pesquisa_cadastro',
    has_arguments: true,
    selected_models: [] as string[],
    tables_config: [] as any[],
    query_type: 'dynamic',
    custom_query: '',
    layout_config: {
      filter_fields: [] as string[],
      grid_fields: [] as string[],
      form_fields: [] as string[],
      grouping_type: 'sections',
      display_type: 'list',
      default_view: 'list',
      kanban_group_field: '',
      master_model_id: '',
      detail_display_mode: 'tabs',
      mindmap_central_field: '',
      action_interface_type: 'drawer',
      fields_metadata: {} as Record<string, any>
    },
    buttons_config: [
      { id: 'search', label: t('runtime.search'), labelKey: 'runtime.search', icon: 'search', action: 'search', visible: true },
      { id: 'clear', label: t('runtime.clear'), labelKey: 'runtime.clear', icon: 'refresh-ccw', action: 'clear', visible: true },
      { id: 'view', label: t('runtime.view'), labelKey: 'runtime.view', icon: 'search', action: 'view', visible: true },
      { id: 'add', label: t('runtime.new_record'), labelKey: 'runtime.new_record', icon: 'plus', action: 'create', visible: true },
      { id: 'edit', label: t('runtime.edit'), labelKey: 'runtime.edit', icon: 'pencil', action: 'pencil', action_key: 'update', visible: true },
      { id: 'delete', label: t('runtime.delete'), labelKey: 'runtime.delete', icon: 'trash', action_key: 'delete', visible: true }
    ]
  })
  // Sugestão automática de botões baseado na lógica selecionada
  useEffect(() => {
    // Se estivermos em modo edição (initialData presente), NUNCA rodamos a sugestão automática
    // para não atropelar as escolhas já salvas e persistidas pelo usuário.
    if (initialData) return

    // Só sugerimos enquanto o usuário não chegou na etapa de edição manual (Passo 4)
    if (currentStep < 4) {
      const isPesquisa = config.logic_type === 'pesquisa'
      const isCadastro = config.logic_type === 'cadastro'
      const isBoth = config.logic_type === 'pesquisa_cadastro'
      const hasArgs = config.has_arguments

      let searchVis = false
      let viewVis = false
      let addVis = false
      let editVis = false
      let delVis = false

      if (isPesquisa) {
        searchVis = hasArgs
        viewVis = true
      } else if (isBoth) {
        searchVis = hasArgs
        viewVis = true
        addVis = true
        editVis = true
        delVis = true
      } else if (isCadastro) {
        addVis = true
      }

      setConfig(prev => ({
        ...prev,
        buttons_config: prev.buttons_config.map(btn => {
          if (btn.id === 'search') return { ...btn, visible: searchVis }
          if (btn.id === 'clear') return { ...btn, visible: searchVis }
          if (btn.id === 'view') return { ...btn, visible: viewVis }
          if (btn.id === 'add') return { ...btn, visible: addVis }
          if (btn.id === 'edit') return { ...btn, visible: editVis }
          if (btn.id === 'delete') return { ...btn, visible: delVis }
          return btn
        })
      }))
    }
  }, [config.logic_type, config.has_arguments, currentStep, isInitialized, initialData])

  // Limpeza automática de campos se a lógica mudar
  useEffect(() => {
    const isPesquisaOnly = config.logic_type === 'pesquisa'
    const isCadastroOnly = config.logic_type === 'cadastro'
    const noArgs = !config.has_arguments

    let updateNeeded = false
    const newLayout = { ...config.layout_config }

    if ((isCadastroOnly || noArgs) && newLayout.filter_fields.length > 0) {
      newLayout.filter_fields = []
      updateNeeded = true
    }

    if (isPesquisaOnly && newLayout.form_fields.length > 0) {
      newLayout.form_fields = []
      updateNeeded = true
    }

    if (updateNeeded) {
      setConfig(prev => ({ ...prev, layout_config: newLayout }))
    }
  }, [config.logic_type, config.has_arguments])

  useEffect(() => {
    const loadModels = async () => {
      const { data } = await supabase
        .from('models')
        .select('*, fields(*)')
        .order('db_table_name')

      if (data) setModels(data)
      setIsLoading(false)
    }
    loadModels()
  }, [supabase])

  const steps = [
    { id: 1, title: t('wizard.steps.logic'), icon: <Settings2 className="w-4 h-4" /> },
    { id: 2, title: t('wizard.steps.tables'), icon: <Database className="w-4 h-4" /> },
    { id: 3, title: t('wizard.steps.layout'), icon: <Layout className="w-4 h-4" /> },
    { id: 4, title: t('wizard.steps.actions'), icon: <MousePointer2 className="w-4 h-4" /> }
  ]

  const isStepValid = (step: number) => {
    if (step === 1) return !!(config.name && config.slug)
    if (step === 2) return config.selected_models.length > 0
    if (step === 3) {
      const { logic_type, has_arguments, layout_config } = config
      const hasGrid = layout_config.grid_fields.length > 0
      const hasFilter = layout_config.filter_fields.length > 0
      const hasForm = layout_config.form_fields.length > 0

      if (logic_type === 'pesquisa') {
        return hasGrid && (!has_arguments || hasFilter)
      }
      if (logic_type === 'cadastro') {
        return hasForm
      }
      if (logic_type === 'pesquisa_cadastro') {
        return hasGrid && hasForm && (!has_arguments || hasFilter)
      }
      if (logic_type === 'kanban') {
        return !!layout_config.kanban_group_field && hasGrid
      }
      if (logic_type === 'mapa_mental') {
        return !!(layout_config as any).mindmap_central_field && hasGrid
      }
      if (logic_type === 'master_detail') {
        return config.selected_models.length >= 2 && !!(layout_config as any).master_model_id && hasGrid
      }
      return true
    }
    return true
  }

  const nextStep = () => {
    if (!isStepValid(currentStep)) {
      if (currentStep === 1) toast(t('wizard.buttons.validation.name_slug_required'), 'error')
      if (currentStep === 2 && config.selected_models.length < (config.logic_type === 'master_detail' ? 2 : 1)) {
        toast(config.logic_type === 'master_detail' ? "Mestre-Detalhe requer pelo menos 2 tabelas." : t('dashboard.projects.studio.config.db_fields_desc').replace('{table}', ''), 'error')
        return
      }

      if (currentStep === 3) {
        const { logic_type, has_arguments, layout_config } = config
        if (!layout_config.grid_fields.length && logic_type !== 'cadastro') toast(t('wizard.buttons.validation.grid_required'), 'error')
        if (!layout_config.form_fields.length && (logic_type === 'cadastro' || logic_type === 'pesquisa_cadastro' || logic_type === 'master_detail')) toast(t('wizard.buttons.validation.form_required'), 'error')
        if (has_arguments && !layout_config.filter_fields.length && logic_type.includes('pesquisa')) toast(t('wizard.buttons.validation.filter_required'), 'error')
        if (logic_type === 'kanban' && !layout_config.kanban_group_field) toast("Please select a grouping field for Kanban.", 'error')
        if (logic_type === 'mapa_mental' && !(layout_config as any).mindmap_central_field) toast("Please select a central field for Mind Map.", 'error')
        if (logic_type === 'master_detail' && !(layout_config as any).master_model_id) toast("Please select the Master Table.", 'error')
      }
      return
    }

    setCurrentStep(prev => Math.min(prev + 1, steps.length))
  }
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  const handleSave = async () => {
    if (!config.name || !config.slug) {
      toast(t('wizard.buttons.validation.name_slug_required'), 'error')
      return
    }

    setIsSaving(true)
    try {
      // 1. Criar/Atualizar a View Principal
      const { data: projectData } = await supabase.from('projects').select('id').eq('slug', project_slug).single()

      const viewPayload = {
        project_id: projectData?.id,
        name: config.name,
        slug: config.slug,
        logic_type: config.logic_type,
        has_arguments: config.has_arguments,
        tables_config: config.selected_models,
        query_type: config.query_type,
        custom_query: config.custom_query,
        layout_config: { ...config.layout_config, is_active: true },
        buttons_config: config.buttons_config,
        view_type: 'advanced_use_case',
        model_id: config.selected_models[0], // Define a primeira tabela como modelo principal
      }

      // Tenta encontrar por slug primeiro
      const { data: existingBySlug } = await supabase
        .from('ui_views')
        .select('id')
        .eq('project_id', projectData?.id)
        .eq('slug', config.slug)
        .maybeSingle()

      let view: any
      let viewError: any

      // Agora só atualizamos se o ID for explicitamente passado (modo edição) 
      // ou se o Slug já existir. Não tentamos mais "adivinhar" pelo modelo para não sobrescrever telas diferentes.
      const targetId = isEditMode ? viewId : existingBySlug?.id

      if (targetId) {
        const { data, error } = await supabase
          .from('ui_views')
          .update(viewPayload)
          .eq('id', targetId)
          .select()
          .single()
        view = data
        viewError = error
      } else {
        const { data, error } = await supabase
          .from('ui_views')
          .insert(viewPayload)
          .select()
          .single()
        view = data
        viewError = error
      }

      if (viewError) throw viewError

      // 2. Limpar componentes antigos desta view
      await supabase.from('ui_components').delete().eq('view_id', view.id)

      // 3. Consolidar componentes por field_id para evitar violação de constraint unique(view_id, field_id)
      const componentMap: Record<string, any> = {}

      const addOrUpdateComponent = (fid: string, zone: string) => {
        // Tenta carregar a meta específica da zona ou fallback para global
        const zoneMeta = config.layout_config.fields_metadata[`${zone}-${fid}`]
        const globalMeta = config.layout_config.fields_metadata[fid] || {}
        const metadata = zoneMeta || globalMeta

        if (!componentMap[fid]) {
          componentMap[fid] = {
            view_id: view.id,
            field_id: fid,
            component_type: zone, // Usa a primeira zona como tipo inicial
            label: metadata.label?.text || '',
            config: {
              zones: [zone],
              [`${zone}_config`]: metadata, // Armazena a config específica da zona
              ...metadata // Inclui todas as propriedades no root para retrocompatibilidade
            }
          }
        } else {
          if (!componentMap[fid].config.zones.includes(zone)) {
            componentMap[fid].config.zones.push(zone)
          }
          // Adiciona a config específica da zona ao componente existente
          componentMap[fid].config[`${zone}_config`] = metadata
          
          // Se for a zona de formulário, ela tende a ditar o label principal
          if (zone === 'form' && metadata.label?.text) {
             componentMap[fid].label = metadata.label.text
          }
        }
      }

      config.layout_config.filter_fields?.forEach((fid: string) => addOrUpdateComponent(fid, 'filter'))
      config.layout_config.grid_fields?.forEach((fid: string) => addOrUpdateComponent(fid, 'grid'))
      config.layout_config.form_fields?.forEach((fid: string) => addOrUpdateComponent(fid, 'form'))

      const componentsToInsert = Object.values(componentMap)

      if (componentsToInsert.length > 0) {
        const { error: compError } = await supabase.from('ui_components').insert(componentsToInsert)
        if (compError) throw compError
      }

      onSaveSuccess()
    } catch (err: any) {
      console.error(err)
      toast(t('wizard.buttons.error_save') + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
      <p className="text-sm font-bold animate-pulse">{t('common.loading')}</p>
    </div>
  )

  return (
    <div className="flex flex-col pb-32">

      {/* Header Interno do Builder (Imagem 2) */}
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-neutral-200 dark:bg-neutral-800 mx-2"></div>
            <div>
              <h1 className="text-sm font-black tracking-tight">{t('wizard.title')}</h1>
              <p className="text-[8px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-[0.2em]">{initialData ? t('wizard.edit_mode') : t('wizard.new_mode')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {isSaving ? (initialData ? t('wizard.buttons.updating') : t('wizard.buttons.saving')) : (initialData ? t('wizard.buttons.update') : t('wizard.buttons.finish'))}
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 px-6 py-4 rounded-[2rem]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div
                  className={cn(
                    "flex items-center gap-3 transition-all",
                    currentStep >= step.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400'
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black text-[10px] transition-all shadow-sm",
                    currentStep === step.id ? 'border-indigo-600 bg-indigo-600 text-white rotate-3 shadow-indigo-500/20' :
                      currentStep > step.id ? 'border-indigo-600 bg-indigo-600/10' : 'border-neutral-200 dark:border-neutral-800'
                  )}>
                    {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] hidden sm:block">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 mx-6 h-px transition-colors",
                    currentStep > step.id ? 'bg-indigo-600/30' : 'bg-neutral-200 dark:bg-neutral-800'
                  )}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-6 min-h-[500px]">
        {currentStep === 1 && (
          <StepLogic config={config} setConfig={setConfig} />
        )}
        {currentStep === 2 && (
          <StepTables config={config} setConfig={setConfig} models={models} />
        )}
        {currentStep === 3 && (
          <StepLayout config={config} setConfig={setConfig} models={models} />
        )}
        {currentStep === 4 && (
          <StepActions config={config} setConfig={setConfig} />
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
              currentStep === steps.length
                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xl"
                : "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            <ChevronLeft className="w-3 h-3" /> {t('wizard.buttons.prev')}
          </button>

          <button
            onClick={currentStep === steps.length ? handleSave : nextStep}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-2 px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl",
              currentStep === steps.length
                ? "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
                : !isStepValid(currentStep)
                  ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed opacity-50"
                  : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-neutral-900/10 dark:shadow-white/5"
            )}
          >
            {currentStep === steps.length ? (
              isSaving ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> {initialData ? t('wizard.buttons.updating') : t('wizard.buttons.saving')}</>
              ) : (
                <>{initialData ? t('wizard.buttons.update') : t('wizard.buttons.finish')} <Save className="w-3 h-3 ml-1" /></>
              )
            ) : (
              <>{t('wizard.buttons.next')} <ChevronRight className="w-3 h-3" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- SUB-COMPONENTES DE PASSOS ---

function StepLogic({ config, setConfig }: any) {
  const { t } = useI18n()
  const types = [
    { id: 'pesquisa', title: t('wizard.logic.types.pesquisa.title'), desc: t('wizard.logic.types.pesquisa.desc'), icon: Layout },
    { id: 'pesquisa_cadastro', title: t('wizard.logic.types.pesquisa_cadastro.title'), desc: t('wizard.logic.types.pesquisa_cadastro.desc'), icon: Layout },
    { id: 'cadastro', title: t('wizard.logic.types.cadastro.title'), desc: t('wizard.logic.types.cadastro.desc'), icon: Layout },
    { id: 'mapa_mental', title: t('wizard.logic.types.mapa_mental.title'), desc: t('wizard.logic.types.mapa_mental.desc'), icon: Share2 },
    { id: 'kanban', title: t('wizard.logic.types.kanban.title'), desc: t('wizard.logic.types.kanban.desc'), icon: Columns },
    { id: 'master_detail', title: t('wizard.logic.types.master_detail.title'), desc: t('wizard.logic.types.master_detail.desc'), icon: Layers },
    { id: 'personalizado', title: t('wizard.logic.types.personalizado.title'), desc: t('wizard.logic.types.personalizado.desc'), icon: Settings }
  ]

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.logic.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.logic.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {types.map(t => (
          <button
            key={t.id}
            onClick={() => setConfig({ ...config, logic_type: t.id })}
            className={cn(
              "p-4 rounded-[1.5rem] border-2 text-left transition-all group relative overflow-hidden",
              config.logic_type === t.id
                ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl shadow-indigo-500/10 scale-[1.02]'
                : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-all shadow-sm",
              config.logic_type === t.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-indigo-600'
            )}>
              <t.icon className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm mb-1">{t.title}</h3>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium line-clamp-2">{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="p-4 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-[1.5rem] border border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.logic.screen_name')}</label>
            <input
              required
              type="text"
              value={config.name}
              onChange={e => {
                const val = e.target.value
                const suggestedSlug = val.toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9\s-]/g, '')
                  .trim()
                  .replace(/\s+/g, '-')

                setConfig({
                  ...config,
                  name: val,
                  slug: (!config.slug || config.slug === config.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')) ? suggestedSlug : config.slug
                })
              }}
              placeholder={t('wizard.logic.screen_name_placeholder')}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.logic.slug_label')}</label>
            <div className="flex items-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus-within:border-indigo-600 transition-all shadow-sm">
              <span className="text-neutral-400 mr-2 font-bold">/</span>
              <input
                type="text"
                value={config.slug}
                onChange={e => setConfig({ ...config, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                placeholder={t('wizard.logic.slug_placeholder')}
                className="w-full bg-transparent outline-none text-sm font-bold"
              />
            </div>
          </div>
        </div>

        {(config.logic_type.includes('pesquisa') || config.logic_type === 'kanban') && (
          <div className="flex items-center gap-4 p-6 bg-white dark:bg-neutral-950/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 group cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => setConfig({ ...config, has_arguments: !config.has_arguments })}>
            <div className={cn(
              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
              config.has_arguments ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-neutral-200 dark:border-neutral-800'
            )}>
              {config.has_arguments && <CheckCircle2 className="w-4 h-4" />}
            </div>
            <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{t('wizard.logic.enable_args')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StepTables({ config, setConfig, models }: any) {
  const { t } = useI18n()
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.tables.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.tables.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((m: any) => {
          const isSelected = config.selected_models.includes(m.id)
          return (
            <button
              key={m.id}
              onClick={() => {
                const newSelected = isSelected
                  ? config.selected_models.filter((id: string) => id !== m.id)
                  : [...config.selected_models, m.id]
                setConfig({ ...config, selected_models: newSelected })
              }}
              className={cn(
                "p-4 rounded-[1.5rem] border-2 text-left transition-all relative group",
                isSelected
                  ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                  : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "p-2.5 rounded-xl transition-all",
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                )}>
                  <Database className="w-5 h-5" />
                </div>
                {isSelected && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/40"><CheckCircle2 className="w-4 h-4" /></div>}
              </div>
              <h4 className="font-bold text-base text-neutral-900 dark:text-white">{m.display_name || m.db_table_name}</h4>
              <p className="text-[10px] text-neutral-400 font-mono mt-1 uppercase tracking-widest">{m.db_table_name}</p>
            </button>
          )
        })}
      </div>
      {config.selected_models.length > 1 && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-[11px] font-bold leading-relaxed">{t('wizard.tables.selected_warning').replace('{count}', config.selected_models.length.toString())}</p>
        </div>
      )}
    </div>
  )
}

function StepLayout({ config, setConfig, models }: any) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editingFieldZone, setEditingFieldZone] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({})
  const dragControls = useDragControls()

  // Sensores e Handlers para Drag & Drop
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    // Case 1: Dragging from Available Fields (Sidebar) to a Zone
    if (activeIdStr.startsWith('source-') || activeIdStr.startsWith('table-source-')) {
      const isTable = activeIdStr.startsWith('table-source-')
      const id = activeIdStr.replace(isTable ? 'table-source-' : 'source-', '')
      
      let targetZone: 'filter_fields' | 'grid_fields' | 'form_fields' | null = null
      if (overIdStr === 'droppable-filter' || overIdStr.startsWith('filter-')) targetZone = 'filter_fields'
      else if (overIdStr === 'droppable-grid' || overIdStr.startsWith('grid-')) targetZone = 'grid_fields'
      else if (overIdStr === 'droppable-form' || overIdStr.startsWith('form-')) targetZone = 'form_fields'

      if (targetZone) {
        if (isTable) {
          const model = models.find((m: any) => m.id === id)
          if (!model) return

          const fieldIdsToAdd = model.fields.map((f: any) => f.id)
          const currentFields = [...config.layout_config[targetZone]]
          const newFields = [...currentFields]
          let addedCount = 0

          fieldIdsToAdd.forEach((fid: string) => {
            if (!newFields.includes(fid)) {
              // Validations
              if (targetZone === 'filter_fields' && (!config.has_arguments || config.logic_type === 'cadastro')) return
              if (targetZone === 'form_fields' && config.logic_type === 'pesquisa') return
              newFields.push(fid)
              addedCount++
            }
          })

          if (addedCount > 0) {
            setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                [targetZone]: newFields
              }
            })
            toast(`${addedCount} campos da tabela "${model.display_name || model.db_table_name}" adicionados com sucesso!`, 'success')
          } else {
            toast(t('common.info', 'Todos os campos desta tabela já estão nesta zona.'), 'info')
          }
        } else {
          const fieldId = id
          const currentFields = [...config.layout_config[targetZone]]
          if (!currentFields.includes(fieldId)) {
            // Logic validations
            if (targetZone === 'filter_fields' && (!config.has_arguments || config.logic_type === 'cadastro')) return
            if (targetZone === 'form_fields' && config.logic_type === 'pesquisa') return

            currentFields.push(fieldId)
            setConfig({
              ...config,
              layout_config: {
                ...config.layout_config,
                [targetZone]: currentFields
              }
            })
            toast(t('common.success', 'Campo adicionado com sucesso!'), 'success')
          } else {
            toast(t('common.info', 'Este campo já está nesta zona.'), 'info')
          }
        }
      }
      return
    }

    // Case 2: Reordering within a Zone
    if (active.id === over.id) return

    const isFilter = activeIdStr.startsWith('filter-')
    const isGrid = activeIdStr.startsWith('grid-')
    const isForm = activeIdStr.startsWith('form-')

    const listKey = isFilter ? 'filter_fields' : isGrid ? 'grid_fields' : 'form_fields'
    
    const activeId = activeIdStr.replace(/^(filter-|grid-|form-)/, '')
    const overId = overIdStr.replace(/^(filter-|grid-|form-)/, '')

    setConfig((prev: any) => {
      const list = [...prev.layout_config[listKey as keyof typeof prev.layout_config] as string[]]
      const oldIndex = list.indexOf(activeId)
      const newIndex = list.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1) return prev
      return {
        ...prev,
        layout_config: {
          ...prev.layout_config,
          [listKey]: arrayMove(list, oldIndex, newIndex)
        }
      }
    })
  }

  const selectedModelsData = models.filter((m: any) => config.selected_models.includes(m.id))

  const toggleField = (fieldId: string, zone: 'filter_fields' | 'grid_fields' | 'form_fields') => {
    const currentFields = [...config.layout_config[zone]]
    const index = currentFields.indexOf(fieldId)

    if (index > -1) {
      currentFields.splice(index, 1)
    } else {
      currentFields.push(fieldId)
    }

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        [zone]: currentFields
      }
    })
  }

  const getFieldName = (id: string) => {
    for (const m of models) {
      const f = m.fields.find((f: any) => f.id === id)
      if (f) {
        const tableName = m.display_name || m.db_table_name
        const fieldName = f.display_name || f.db_column_name
        return `${tableName}.${fieldName}`
      }
    }
    return id
  }

  // Chave de metadados: tenta "zona-fieldId", senão usa apenas "fieldId" (fallback global)
  const getFieldMeta = (fid: string, zone?: string | null) => {
    const specificKey = zone ? `${zone}-${fid}` : null
    const meta = (specificKey ? config.layout_config.fields_metadata[specificKey] : null) || config.layout_config.fields_metadata[fid]
    
    if (meta) return meta

    return {
      label: { text: getFieldName(fid), font: 'Inter', size: '9px', color: '' },
      content: { font: 'Inter', size: '12px', color: '', mask: '', required: false },
      component: { type: 'text', rows: 3, width: '100%', options_type: 'fixed', fixed_options: '', rel_table: '', rel_label: '', rel_value: '' }
    }
  }

  const currentFieldMeta = editingFieldId ? getFieldMeta(editingFieldId, editingFieldZone) : null

  const updateMeta = (section: 'label' | 'content' | 'component', key: string, value: any) => {
    if (!editingFieldId) return
    const newMeta = { ...currentFieldMeta }
    newMeta[section] = { ...newMeta[section], [key]: value }

    // Salva sempre com o prefixo da zona para garantir independência
    const metaKey = editingFieldZone ? `${editingFieldZone}-${editingFieldId}` : editingFieldId

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        fields_metadata: {
          ...config.layout_config.fields_metadata,
          [metaKey]: newMeta
        }
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between xl:pr-96">
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.layout.title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.layout.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-3 px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 bg-white dark:bg-neutral-900 border-2 border-red-100 dark:border-red-900/30 rounded-2xl shadow-xl shadow-red-500/5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all hover:scale-105 active:scale-95 group shrink-0"
        >
          <RotateCcw className="w-4 h-4 transition-transform group-hover:rotate-[-180deg] duration-700" />
          {t('wizard.layout.reset_formatting')}
        </button>
      </div>

      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title={t('wizard.layout.reset_formatting')}
      >
        <div className="space-y-6">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">
              {t('wizard.layout.reset_confirm')}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={() => {
                setConfig({
                  ...config,
                  layout_config: {
                    ...config.layout_config,
                    fields_metadata: {}
                  }
                })
                setShowResetConfirm(false)
              }}
              className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-500/20"
            >
              {t('wizard.layout.reset_formatting')}
            </button>
          </div>
        </div>
      </Modal>



      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex flex-col xl:flex-row-reverse gap-10 relative">
          {/* Sidebar Wrapper - Preserves layout space while allowing fixed positioning */}
          <div className="w-full xl:w-80 shrink-0">
            <motion.div 
              drag
              dragControls={dragControls}
              dragListener={false}
              dragMomentum={false}
              className="bg-white dark:bg-neutral-900 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 flex flex-col xl:fixed xl:w-80 xl:h-[600px] xl:top-64 xl:right-12 z-30 shadow-2xl shadow-indigo-500/10 overflow-hidden ring-1 ring-black/5 transition-colors duration-500 resize both min-w-[280px] min-h-[400px] max-w-[500px]"
            >
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="p-5 border-b border-neutral-200 dark:border-neutral-800 cursor-grab active:cursor-grabbing hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group flex items-center justify-between"
            >
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 group-hover:text-indigo-500 transition-colors">{t('wizard.layout.available_fields')}</h3>
              <div className="flex gap-0.5">
                {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 group-hover:bg-indigo-400"></div>)}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {selectedModelsData.map((m: any) => {
                const isCollapsed = collapsedTables[m.id]
                return (
                  <div key={m.id} className="relative">
                    <DraggableTableHeader 
                      model={m} 
                      isCollapsed={isCollapsed} 
                      onToggle={() => setCollapsedTables(prev => ({ ...prev, [m.id]: !isCollapsed }))} 
                    />
                    
                    {!isCollapsed && (
                      <div className="p-4 grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {m.fields.map((f: any) => (
                          <DraggableFieldCard key={f.id} field={f} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>

        <div className="flex-1 space-y-8 w-full">
          {/* ZONA: KANBAN CONFIG */}
          {config.logic_type === 'kanban' && (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-[1.5rem] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <Columns className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.kanban.title')}</h4>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.kanban.group_field')}</label>
                <select
                  value={config.layout_config.kanban_group_field || ''}
                  onChange={e => setConfig({
                    ...config,
                    layout_config: { ...config.layout_config, kanban_group_field: e.target.value }
                  })}
                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                >
                  <option value="">{t('wizard.layout.kanban.group_placeholder')}</option>
                  {selectedModelsData.flatMap((m: any) => m.fields).map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {getFieldName(f.id)} ({f.data_type})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 font-medium italic ml-1">{t('wizard.layout.kanban.group_desc')}</p>
              </div>
            </div>
          )}

          {/* ZONA: MASTER-DETAIL CONFIG */}
          {config.logic_type === 'master_detail' && (
            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-[2rem] space-y-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.master_detail.title')}</h4>
                  <p className="text-[10px] text-neutral-400 font-medium mt-1">{t('wizard.layout.master_detail.subtitle')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Tabela Mestre (Root)</label>
                  <select
                    value={(config.layout_config as any).master_model_id || ''}
                    onChange={e => setConfig({
                      ...config,
                      layout_config: { ...config.layout_config, master_model_id: e.target.value }
                    })}
                    className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
                  >
                    <option value="">Selecione a tabela principal...</option>
                    {selectedModelsData.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Estilo dos Detalhes</label>
                  <div className="flex p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
                    <button
                      onClick={() => setConfig({ ...config, layout_config: { ...config.layout_config, detail_display_mode: 'tabs' } })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        (config.layout_config as any).detail_display_mode !== 'sections' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600'
                      )}
                    >
                      Abas
                    </button>
                    <button
                      onClick={() => setConfig({ ...config, layout_config: { ...config.layout_config, detail_display_mode: 'sections' } })}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        (config.layout_config as any).detail_display_mode === 'sections' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600'
                      )}
                    >
                      Seções
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex gap-3 items-start">
                <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5" />
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 leading-relaxed">
                  <strong>Dica:</strong> No estilo <strong>Abas</strong>, cada tabela detalhe será uma aba separada. No estilo <strong>Seções</strong>, os dados serão empilhados em grupos dentro do mesmo corpo de formulário.
                </p>
              </div>
            </div>
          )}

          {/* ZONA: MIND MAP CONFIG */}
          {config.logic_type === 'mapa_mental' && (
            <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-[1.5rem] space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600 text-white rounded-xl shadow-lg shadow-purple-500/20">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-purple-600 tracking-[0.3em]">{t('wizard.layout.mindmap.config_title', 'Configuração do Mapa Mental')}</h4>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.layout.mindmap.central_field', 'Campo Central (Nó Raiz)')}</label>
                <select
                  value={config.layout_config.mindmap_central_field || ''}
                  onChange={e => setConfig((prev: any) => ({
                    ...prev,
                    layout_config: { ...prev.layout_config, mindmap_central_field: e.target.value }
                  }))}
                  className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-purple-600 outline-none transition-all shadow-sm text-sm font-bold"
                >
                  <option value="">{t('wizard.layout.mindmap.select_central', 'Selecione o campo central...')}</option>
                  {selectedModelsData.flatMap((m: any) => m.fields).map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {getFieldName(f.id)} ({f.data_type})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 font-medium italic ml-1">{t('wizard.layout.mindmap.central_desc', 'Este campo será a raiz do seu mapa mental. Os campos selecionados na Zona 02 formarão os próximos níveis na ordem definida.')}</p>
              </div>
            </div>
          )}

          {/* RELATIONSHIPS CARD */}
          {selectedModelsData.length > 1 && (
            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-[2rem] border border-indigo-200 dark:border-indigo-800/50 p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                  <Link className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-widest">{t('wizard.layout.relationships')}</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('wizard.layout.relationships_desc', 'You selected multiple tables. Define how they connect to each other.')}</p>
                </div>
              </div>
              
              <div className="space-y-3 mt-2">
                {(config.layout_config.joins || []).map((join: any, index: number) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                    {/* FROM TABLE */}
                    <select
                      value={join.from}
                      onChange={e => {
                        const newJoins = [...(config.layout_config.joins || [])]
                        newJoins[index].from = e.target.value
                        newJoins[index].localKey = ''
                        setConfig({ ...config, layout_config: { ...config.layout_config, joins: newJoins } })
                      }}
                      className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="">{t('wizard.layout.select_table', 'Select Table...')}</option>
                      {selectedModelsData.map((m: any) => (
                        <option key={m.id} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>
                      ))}
                    </select>
                    
                    {/* FROM KEY */}
                    <select
                      value={join.localKey}
                      onChange={e => {
                        const newJoins = [...(config.layout_config.joins || [])]
                        newJoins[index].localKey = e.target.value
                        setConfig({ ...config, layout_config: { ...config.layout_config, joins: newJoins } })
                      }}
                      className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="">{t('wizard.layout.select_field', 'Select Field...')}</option>
                      {selectedModelsData.find((m: any) => m.db_table_name === join.from)?.fields.map((f: any) => (
                        <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                      ))}
                    </select>

                    <div className="px-2 text-neutral-400">
                      <ArrowRight className="w-4 h-4" />
                    </div>

                    {/* TO TABLE */}
                    <select
                      value={join.to}
                      onChange={e => {
                        const newJoins = [...(config.layout_config.joins || [])]
                        newJoins[index].to = e.target.value
                        newJoins[index].foreignKey = ''
                        setConfig({ ...config, layout_config: { ...config.layout_config, joins: newJoins } })
                      }}
                      className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="">{t('wizard.layout.select_table', 'Select Table...')}</option>
                      {selectedModelsData.map((m: any) => (
                        <option key={m.id} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>
                      ))}
                    </select>

                    {/* TO KEY */}
                    <select
                      value={join.foreignKey}
                      onChange={e => {
                        const newJoins = [...(config.layout_config.joins || [])]
                        newJoins[index].foreignKey = e.target.value
                        setConfig({ ...config, layout_config: { ...config.layout_config, joins: newJoins } })
                      }}
                      className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                    >
                      <option value="">{t('wizard.layout.select_field', 'Select Field...')}</option>
                      {selectedModelsData.find((m: any) => m.db_table_name === join.to)?.fields.map((f: any) => (
                        <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        const newJoins = [...(config.layout_config.joins || [])]
                        newJoins.splice(index, 1)
                        setConfig({ ...config, layout_config: { ...config.layout_config, joins: newJoins } })
                      }}
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const newJoins = [...(config.layout_config.joins || []), { from: '', localKey: '', to: '', foreignKey: '' }]
                    setConfig({ ...config, layout_config: { ...config.layout_config, joins: newJoins } })
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {t('wizard.layout.add_relationship', 'Add Relationship')}
                </button>
              </div>
            </div>
          )}

          {/* ZONA: FILTROS */}
          {(config.logic_type.includes('pesquisa') || config.logic_type === 'kanban' || config.logic_type === 'mapa_mental' || config.logic_type === 'master_detail') && (
            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[9px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.zones.zone_01')}: {t('wizard.layout.zones.filter')}</h4>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.filter_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                  {config.layout_config.filter_fields.length > 0 && (
                    <button
                      onClick={() => setConfig({ ...config, layout_config: { ...config.layout_config, filter_fields: [] } })}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title={t('common.clear_all', 'Limpar Tudo')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <DroppableZone id="droppable-filter" className="flex flex-wrap gap-3 min-h-[80px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-center">
                {config.layout_config.filter_fields.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium w-full text-center italic">{t('wizard.layout.subtitle')}</p>
                ) : (
                  <SortableContext items={config.layout_config.filter_fields.map((id: string) => `filter-${id}`)} strategy={rectSortingStrategy}>
                    {config.layout_config.filter_fields.map((id: string) => (
                      <SortableFilterItem
                        key={`filter-${id}`}
                        id={`filter-${id}`}
                        itemValue={id}
                        toggleField={toggleField}
                        onEdit={() => { setEditingFieldId(id); setEditingFieldZone('filter'); setIsDrawerOpen(true); }}
                      >
                        <span
                          style={{
                            fontFamily: getFieldMeta(id, 'filter').label?.font,
                            fontSize: getFieldMeta(id, 'filter').label?.size,
                            color: getFieldMeta(id, 'filter').label?.color || undefined
                          }}
                          className={cn(
                            "text-[10px] font-black tracking-wider",
                            !getFieldMeta(id, 'filter').label?.font && "uppercase"
                          )}
                        >
                          {getFieldMeta(id, 'filter').label?.text || getFieldName(id)}
                        </span>
                      </SortableFilterItem>
                    ))}
                  </SortableContext>
                )}
              </DroppableZone>
            </div>
          )}

          {/* ZONA: GRID */}
          <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.3em]">
                  {config.logic_type === 'kanban' ? t('wizard.layout.zones.kanban_card', 'Campos do Card') : config.logic_type === 'mapa_mental' ? t('wizard.layout.zones.mindmap_nodes', 'Campos do Mapa (Níveis)') : `${t('wizard.layout.zones.zone_02')}: ${t('wizard.layout.zones.grid')}`}
                </h4>
                {config.logic_type !== 'kanban' && config.logic_type !== 'mapa_mental' && (
                  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg w-fit">
                    {[
                      { id: 'list', label: t('wizard.layout.display_options.list') },
                      { id: 'card', label: t('wizard.layout.display_options.card') },
                      { id: 'both', label: t('wizard.layout.display_options.both') }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setConfig({
                          ...config,
                          layout_config: { ...config.layout_config, display_type: opt.id }
                        })}
                        className={cn(
                          "px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                          (config.layout_config.display_type || 'list') === opt.id
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.grid_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                {config.layout_config.grid_fields.length > 0 && (
                  <button
                    onClick={() => setConfig({ ...config, layout_config: { ...config.layout_config, grid_fields: [] } })}
                    className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    title={t('common.clear_all', 'Limpar Tudo')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <DroppableZone id="droppable-grid" className="min-h-[100px] p-4 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[1.5rem]">
              {config.layout_config.grid_fields.length === 0 ? (
                <div className="h-full flex items-center justify-center italic text-xs text-neutral-400 font-medium">{t('wizard.layout.subtitle')}</div>
              ) : (
                <div className="w-full overflow-hidden rounded-[1.2rem] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 font-black uppercase text-neutral-400 tracking-wider">
                      <tr>
                        <th className="px-4 py-3">{t('wizard.layout.table.field')}</th>
                        <th className="px-4 py-3 w-10 text-center">{t('wizard.layout.table.action')}</th>
                      </tr>
                    </thead>
                    <SortableContext items={config.layout_config.grid_fields.map((id: string) => `grid-${id}`)} strategy={verticalListSortingStrategy}>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {config.layout_config.grid_fields.map((id: string) => (
                          <SortableGridRow
                            key={`grid-${id}`}
                            id={`grid-${id}`}
                            itemValue={id}
                            toggleField={toggleField}
                            onEdit={() => { setEditingFieldId(id); setEditingFieldZone('grid'); setIsDrawerOpen(true); }}
                          >
                            <span
                              style={{
                                fontFamily: getFieldMeta(id, 'grid').label?.font,
                                fontSize: getFieldMeta(id, 'grid').label?.size,
                                color: getFieldMeta(id, 'grid').label?.color || undefined
                              }}
                              className={cn(
                                !getFieldMeta(id, 'grid').label?.color && "text-neutral-700 dark:text-neutral-200",
                                !getFieldMeta(id, 'grid').label?.font && "capitalize"
                              )}
                            >
                              {getFieldMeta(id, 'grid').label?.text || getFieldName(id)}
                            </span>
                          </SortableGridRow>
                        ))}
                      </tbody>
                    </SortableContext>
                  </table>
                </div>
              )}
            </DroppableZone>
          </div>

          {/* ZONA: FORM */}
          {(config.logic_type.includes('cadastro') || config.logic_type === 'master_detail') && (
            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[9px] font-black uppercase text-amber-600 tracking-[0.3em]">{t('wizard.layout.zones.zone_03')}: {t('wizard.layout.zones.form')}</h4>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.form_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
                  {config.layout_config.form_fields.length > 0 && (
                    <button
                      onClick={() => setConfig({ ...config, layout_config: { ...config.layout_config, form_fields: [] } })}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                      title={t('common.clear_all', 'Limpar Tudo')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <DroppableZone id="droppable-form" className="min-h-[100px] p-4 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[1.5rem]">
                {config.layout_config.form_fields.length === 0 ? (
                  <div className="h-full flex items-center justify-center italic text-xs text-neutral-400 font-medium">{t('wizard.layout.subtitle')}</div>
                ) : (
                  <SortableContext items={config.layout_config.form_fields.map((id: string) => `form-${id}`)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 gap-4 w-full">
                      {config.layout_config.form_fields.map((id: string) => (
                        <SortableFormCard
                          key={`form-${id}`}
                          id={`form-${id}`}
                          itemValue={id}
                          toggleField={toggleField}
                          labelTitle={t('wizard.layout.zones.form')}
                          onEdit={() => { setEditingFieldId(id); setEditingFieldZone('form'); setIsDrawerOpen(true); }}
                        >
                          <span 
                            style={{
                              fontFamily: getFieldMeta(id, 'form').label?.font,
                              fontSize: getFieldMeta(id, 'form').label?.size,
                              color: getFieldMeta(id, 'form').label?.color || undefined
                            }}
                            className={cn(
                              "text-[10px] font-black",
                              !getFieldMeta(id, 'form').label?.color && "text-neutral-800 dark:text-neutral-200",
                              !getFieldMeta(id, 'form').label?.font && "uppercase tracking-wider"
                            )}
                          >
                            {getFieldMeta(id, 'form').label?.text || getFieldName(id)}
                          </span>
                        </SortableFormCard>
                      ))}
                    </div>
                  </SortableContext>
                )}
              </DroppableZone>
            </div>
          )}
          </div>
        </div>
      </DndContext>


      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`${t('wizard.layout.drawer.title')}: ${editingFieldId ? getFieldName(editingFieldId) : ''}`}
      >
        {currentFieldMeta && (
          <div className="space-y-10 pb-20">
            {/* Seção de Label */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-4 bg-indigo-600 rounded-full"></div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.label_config')}</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.display_text')}</label>
                  <input
                    type="text"
                    value={currentFieldMeta.label.text}
                    onChange={e => updateMeta('label', 'text', e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font')}</label>
                    <select
                      value={currentFieldMeta.label.font}
                      onChange={e => updateMeta('label', 'font', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                    >
                      <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Outfit">Outfit</option>
                      <option value="JetBrains Mono">Mono</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size')}</label>
                    <input
                      type="text"
                      placeholder="Ex: 12px"
                      value={currentFieldMeta.label.size}
                      onChange={e => updateMeta('label', 'size', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.text_color')}</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={currentFieldMeta.label.color || '#6366f1'}
                      onChange={e => updateMeta('label', 'color', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                    />
                    <input
                      type="text"
                      value={currentFieldMeta.label.color}
                      onChange={e => updateMeta('label', 'color', e.target.value)}
                      placeholder={t('wizard.layout.drawer.text_color')}
                      className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Seção de Conteúdo */}
            <div className="space-y-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-1 h-4 bg-emerald-600 rounded-full"></div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.content_config')}</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.font')}</label>
                    <select
                      value={currentFieldMeta.content.font}
                      onChange={e => updateMeta('content', 'font', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                    >
                      <option value="Inter">{t('wizard.layout.drawer.font_default')}</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Outfit">Outfit</option>
                      <option value="JetBrains Mono">Mono</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.size')}</label>
                    <input
                      type="text"
                      placeholder="Ex: 14px"
                      value={currentFieldMeta.content.size}
                      onChange={e => updateMeta('content', 'size', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.content_color')}</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={currentFieldMeta.content.color || '#000000'}
                      onChange={e => updateMeta('content', 'color', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0"
                    />
                    <input
                      type="text"
                      value={currentFieldMeta.content.color}
                      onChange={e => updateMeta('content', 'color', e.target.value)}
                      placeholder={t('wizard.layout.drawer.content_color')}
                      className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-mono font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.mask')}</label>
                  <input
                    type="text"
                    placeholder="Ex: 000.000.000-00"
                    value={currentFieldMeta.content.mask}
                    onChange={e => updateMeta('content', 'mask', e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                  />
                </div>

                <div className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-2xl border border-neutral-100 dark:border-neutral-800 cursor-pointer group" onClick={() => updateMeta('content', 'required', !currentFieldMeta.content.required)}>
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    currentFieldMeta.content.required ? 'bg-red-500 border-red-500 text-white' : 'border-neutral-300 dark:border-neutral-700'
                  )}>
                    {currentFieldMeta.content.required && <Plus className="w-3 h-3 rotate-45" />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-widest">{t('wizard.layout.drawer.required')}</span>
                    <span className="text-[8px] text-neutral-400 font-medium">{t('wizard.layout.drawer.required_desc')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção de Componente */}
            <div className="space-y-6 pt-6 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.drawer.component_config', 'Configuração do Componente')}</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.component_type', 'Tipo de Componente')}</label>
                  <select
                    value={currentFieldMeta.component?.type || 'text'}
                    onChange={e => updateMeta('component', 'type', e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-bold outline-none"
                  >
                    <option value="text">Input Texto</option>
                    <option value="textarea">Área de Texto (Textarea)</option>
                    <option value="number">Número</option>
                    <option value="select">Combo (Select)</option>
                    <option value="radio">Radio Buttons</option>
                    <option value="checkbox">Checkbox Group</option>
                    <option value="switch">Switch (Liga/Desliga)</option>
                    <option value="date">Data</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.width', 'Largura')}</label>
                    <input
                      type="text"
                      placeholder="Ex: 100% ou 200px"
                      value={currentFieldMeta.component?.width || '100%'}
                      onChange={e => updateMeta('component', 'width', e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                  {currentFieldMeta.component?.type === 'textarea' && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rows', 'Linhas')}</label>
                      <input
                        type="number"
                        value={currentFieldMeta.component?.rows || 3}
                        onChange={e => updateMeta('component', 'rows', parseInt(e.target.value))}
                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none"
                      />
                    </div>
                  )}
                </div>

                {(['select', 'radio', 'checkbox'].includes(currentFieldMeta.component?.type)) && (
                  <div className="space-y-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.options_source', 'Origem dos Dados')}</label>
                      <div className="flex gap-2">
                        {['fixed', 'relational'].map(opt => (
                          <button
                            key={opt}
                            onClick={() => updateMeta('component', 'options_type', opt)}
                            className={cn(
                              "flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                              (currentFieldMeta.component?.options_type || 'fixed') === opt ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-neutral-900 text-neutral-400'
                            )}
                          >
                            {opt === 'fixed' ? 'Valores Fixos' : 'Relacionamento'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(currentFieldMeta.component?.options_type || 'fixed') === 'fixed' ? (
                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.fixed_options', 'Opções (Label:Valor, separadas por vírgula)')}</label>
                        <textarea
                          placeholder="Ex: Ativo:A, Inativo:I"
                          value={currentFieldMeta.component?.fixed_options || ''}
                          onChange={e => updateMeta('component', 'fixed_options', e.target.value)}
                          className="w-full h-20 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-bold outline-none resize-none"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">{t('wizard.layout.drawer.rel_table', 'Tabela Relacionada')}</label>
                          <select
                            value={currentFieldMeta.component?.rel_table || ''}
                            onChange={e => updateMeta('component', 'rel_table', e.target.value)}
                            className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                          >
                            <option value="">Selecione...</option>
                            {models.map((m: any) => (
                              <option key={m.id} value={m.db_table_name}>{m.display_name || m.db_table_name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Label (Exibição)</label>
                            <select
                              value={currentFieldMeta.component?.rel_label || ''}
                              onChange={e => updateMeta('component', 'rel_label', e.target.value)}
                              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                            >
                              <option value="">Selecione...</option>
                              {models.find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)?.fields.map((f: any) => (
                                <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Value (ID)</label>
                            <select
                              value={currentFieldMeta.component?.rel_value || ''}
                              onChange={e => updateMeta('component', 'rel_value', e.target.value)}
                              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                            >
                              <option value="">Selecione...</option>
                              {models.find((m: any) => m.db_table_name === currentFieldMeta.component?.rel_table)?.fields.map((f: any) => (
                                <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}

function StepActions({ config, setConfig }: any) {
  const { t } = useI18n()
  const strategies = [
    { 
      id: 'dynamic', 
      title: t('wizard.actions.dynamic_query.title'), 
      desc: t('wizard.actions.dynamic_query.desc'), 
      icon: Wand2 
    },
    { 
      id: 'raw', 
      title: t('wizard.actions.raw_sql.title'), 
      desc: t('wizard.actions.raw_sql.desc'), 
      icon: Terminal 
    }
  ]

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.actions.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.actions.subtitle')}</p>
      </div>

      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.interface_buttons')}</label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {config.buttons_config.map((btn: any) => (
            <button
              key={btn.id}
              onClick={() => {
                setConfig({
                  ...config,
                  buttons_config: config.buttons_config.map((b: any) => 
                    b.id === btn.id ? { ...b, visible: !b.visible } : b
                  )
                })
              }}
              className={cn(
                "p-4 rounded-[1.5rem] border transition-all flex flex-col items-center gap-3",
                btn.visible 
                  ? "bg-white dark:bg-neutral-950 border-indigo-600 shadow-lg shadow-indigo-500/5" 
                  : "bg-neutral-50/50 dark:bg-neutral-900/30 border-neutral-200 dark:border-neutral-800 opacity-50"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center",
                btn.visible ? "bg-indigo-500 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
              )}>
                {btn.icon === 'search' && <Search className="w-5 h-5" />}
                {btn.icon === 'refresh-ccw' && <RefreshCcw className="w-5 h-5" />}
                {btn.icon === 'plus' && <Plus className="w-5 h-5" />}
                {btn.icon === 'pencil' && <Pencil className="w-5 h-5" />}
                {btn.icon === 'trash' && <Trash2 className="w-5 h-5" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">{t(btn.labelKey) || btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Interface de Ação (Cadastro/Edição)</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'drawer', title: 'Drawer (Lateral)', desc: 'Os formulários abrirão em uma gaveta lateral deslizante.', icon: Layout },
            { id: 'modal', title: 'Modal (Central)', desc: 'Os formulários abrirão em uma janela centralizada com fundo escurecido.', icon: Maximize2 },
            { id: 'page', title: 'Mesma Tela (Página)', desc: 'O formulário será exibido na mesma tela, substituindo a lista atual.', icon: Layout }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setConfig({
                ...config,
                layout_config: { ...config.layout_config, action_interface_type: opt.id }
              })}
              className={cn(
                "p-6 rounded-[2rem] border-2 text-left transition-all relative group overflow-hidden",
                (config.layout_config.action_interface_type || 'drawer') === opt.id
                  ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                  : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
              )}
            >
              <div className="flex items-center gap-4 mb-4">
                <div className={cn(
                  "p-3 rounded-2xl transition-all",
                  (config.layout_config.action_interface_type || 'drawer') === opt.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                )}>
                  <opt.icon className="w-5 h-5" />
                </div>
                {(config.layout_config.action_interface_type || 'drawer') === opt.id && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white"><CheckCircle2 className="w-4 h-4" /></div>}
              </div>
              <h4 className="font-bold text-base text-neutral-900 dark:text-white">{opt.title}</h4>
              <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-neutral-100 dark:bg-neutral-800/50 w-full"></div>

      <div className="space-y-6">
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.data_strategy')}</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => setConfig({ ...config, query_type: s.id })}
                className={cn(
                  "p-6 rounded-[2rem] border-2 text-left transition-all relative group overflow-hidden",
                  config.query_type === s.id
                    ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                    : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
                )}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn(
                    "p-3 rounded-2xl transition-all",
                    config.query_type === s.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                  )}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  {config.query_type === s.id && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white"><CheckCircle2 className="w-4 h-4" /></div>}
                </div>
                <h4 className="font-bold text-base text-neutral-900 dark:text-white">{s.title}</h4>
                <p className="text-[10px] text-neutral-400 mt-2 leading-relaxed">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {config.query_type === 'raw' && (
          <div className="space-y-4 animate-in zoom-in-95 duration-500 mt-6">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.sql_editor')}</label>
            <div className="p-6 bg-neutral-900 rounded-[2rem] border border-neutral-800 shadow-2xl">
              <textarea
                value={config.raw_sql}
                onChange={e => setConfig({ ...config, raw_sql: e.target.value })}
                className="w-full h-40 bg-transparent text-indigo-400 font-mono text-sm outline-none resize-none"
                placeholder="SELECT * FROM table JOIN ..."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DraggableFieldCard({ field }: { field: any }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `source-${field.id}`,
    data: { fieldId: field.id }
  })

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes}
      className={cn(
        "group p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs flex flex-col gap-2 hover:border-indigo-500/50 transition-all shadow-sm cursor-grab active:cursor-grabbing select-none",
        isDragging && "opacity-50 ring-2 ring-indigo-500 z-50 shadow-2xl scale-105"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-neutral-700 dark:text-neutral-200">{field.display_name || field.db_column_name}</span>
        <span className="text-[9px] font-black font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md">{field.data_type}</span>
      </div>
    </div>
  )
}

function DroppableZone({ id, children, className }: any) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "ring-4 ring-indigo-500/30 bg-indigo-500/5 border-indigo-300 dark:border-indigo-700")}>
      {children}
    </div>
  )
}

function DraggableTableHeader({ model, isCollapsed, onToggle }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `table-source-${model.id}`,
    data: { tableId: model.id, isTable: true }
  })

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Se estiver arrastando, não ativa o toggle
        if (isDragging) return;
        onToggle();
      }}
      className={cn(
        "sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-5 py-4 flex items-center justify-between cursor-pointer group/header border-b border-neutral-100 dark:border-neutral-800/50 shadow-sm transition-all",
        isDragging && "opacity-50 ring-2 ring-indigo-500 z-50 shadow-2xl scale-105"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-1.5 h-4 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
        <div className="flex flex-col">
          <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-[0.15em]">{model.display_name || model.db_table_name}</span>
          <span className="text-[8px] font-bold text-indigo-500/0 group-hover:text-indigo-500 transition-all uppercase tracking-widest leading-none mt-1">Arraste para add tudo</span>
        </div>
      </div>
      <div className="p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover/header:text-indigo-500 group-hover/header:bg-indigo-50 dark:group-hover/header:bg-indigo-500/10 transition-all">
        {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </div>
    </div>
  )
}

function SortableFilterItem({ id, itemValue, toggleField, onEdit, children }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition,
    ...(isDragging ? { opacity: 0.5, zIndex: 50, position: 'relative' } : {})
  }
  
  return (
    <div
      ref={setNodeRef}
      style={style as any}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      className="flex items-center gap-3 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 group cursor-pointer hover:bg-indigo-500 transition-all select-none"
    >
      {children}
      <Trash2
        className="w-3.5 h-3.5 cursor-pointer hover:text-red-300 transition-colors"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); toggleField(itemValue, 'filter_fields'); }}
      />
    </div>
  )
}

function SortableGridRow({ id, itemValue, toggleField, onEdit, children }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 50, display: 'flex', width: '100%', background: 'var(--tw-bg-opacity, 1)' } : {})
  }
  
  return (
    <tr
      ref={setNodeRef}
      style={style as any}
      {...attributes}
      {...listeners}
      className="group hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-grab active:cursor-grabbing select-none"
    >
      <td onClick={onEdit} className="px-4 py-2.5 font-bold text-neutral-700 dark:text-neutral-200">
        {children}
      </td>
      <td className="px-4 py-2.5 text-center">
        <button 
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); toggleField(itemValue, 'grid_fields'); }} 
          className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-neutral-400 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}

function SortableFormCard({ id, itemValue, toggleField, onEdit, children, labelTitle }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition,
    ...(isDragging ? { opacity: 0.5, zIndex: 50, position: 'relative' } : {})
  }
  
  return (
    <div
      ref={setNodeRef}
      style={style as any}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between group shadow-sm hover:border-indigo-500/30 transition-all cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex flex-col gap-1">
        {children}
        <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em]">{labelTitle} Input</span>
      </div>
      <button 
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); toggleField(itemValue, 'form_fields'); }} 
        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-neutral-400 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
