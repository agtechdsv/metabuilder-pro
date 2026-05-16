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
  ArrowRightLeft,
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
import { JoinsEditor } from './JoinsEditor'
import { cn } from '@/lib/utils'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay
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
  const [relations, setRelations] = useState<any[]>([])

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
      joins: [] as any[],
      fields_metadata: {} as Record<string, any>,
      analytics_config: {
        widgets: [] as any[],
        allow_runtime_edit: true
      }
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

  // Helpers de modo edição
  const isEditMode = !!initialData
  const viewId = initialData?.id

  // Popula os dados iniciais se estiver em modo edição
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      // 1. Primeiro buscamos o ID do projeto atual pelo slug
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', project_slug)
        .single()

      if (!project) return

      // 2. Buscamos apenas os modelos deste projeto
      const { data: modelsData } = await supabase
        .from('models')
        .select('*, fields(*)')
        .eq('project_id', project.id)
        .order('db_table_name')

      if (modelsData) setModels(modelsData)

      // 3. Buscamos apenas as relações deste projeto
      const { data: relsData } = await supabase
        .from('relations')
        .select('*')
        .eq('project_id', project.id)
      
      if (relsData) setRelations(relsData)

      setIsLoading(false)
    }
    loadData()
  }, [supabase, project_slug])

  // Brinde UX: Sugestão automática de Joins baseada na tabela 'relations' (vinda do tunnel)
  useEffect(() => {
    // Se estiver em modo edição ou se já houver joins configurados, não sobrescrevemos
    // ou se não houver modelos suficientes selecionados
    if (initialData || config.layout_config.joins.length > 0 || config.selected_models.length <= 1) return

    if (currentStep === 3 && relations.length > 0) {
      const autoJoins: any[] = []
      
      // Filtra relações onde AMBOS os modelos estão selecionados no Wizard
      const relevantRelations = relations.filter(rel => 
        config.selected_models.includes(rel.from_model_id) && 
        config.selected_models.includes(rel.to_model_id)
      )

      relevantRelations.forEach(rel => {
        const fromModel = models.find(m => m.id === rel.from_model_id)
        const toModel = models.find(m => m.id === rel.to_model_id)
        const fromField = fromModel?.fields.find((f: any) => f.id === rel.from_field_id)
        const toField = toModel?.fields.find((f: any) => f.id === rel.to_field_id)

        if (fromModel && toModel && fromField && toField) {
          // No MetaBuilder, convencionamos Mestre (Pai) -> Detalhe (Filho)
          // No banco: fromModel(B).fromField(a_id) -> toModel(A).toField(id)
          // Na UI: A.id -> B.a_id
          autoJoins.push({
            from: toModel.db_table_name,
            localKey: toField.db_column_name,
            to: fromModel.db_table_name,
            foreignKey: fromField.db_column_name
          })
        }
      })

      if (autoJoins.length > 0) {
        setConfig(prev => ({
          ...prev,
          layout_config: {
            ...prev.layout_config,
            joins: autoJoins
          }
        }))
        toast(`Sugerimos ${autoJoins.length} relacionamentos baseados no seu banco de dados!`, 'info')
      }
    }
  }, [currentStep, relations, config.selected_models, initialData, models])

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
          fields_metadata: initialData.layout_config?.fields_metadata || {},
          analytics_config: initialData.layout_config?.analytics_config || { widgets: [], allow_runtime_edit: true },
          details_interface_types: initialData.layout_config?.details_interface_types || {},
          details_inline_types: initialData.layout_config?.details_inline_types || {}
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
      const isMasterDetail = config.logic_type === 'master_detail'
      const hasArgs = config.has_arguments

      let searchVis = false
      let viewVis = false
      let addVis = false
      let editVis = false
      let delVis = false

      if (isPesquisa) {
        searchVis = hasArgs
        viewVis = true
      } else if (isBoth || isMasterDetail) {
        // Para Mestre-Detalhe ou Pesquisa+Cadastro, mostramos todos por padrão (UX solicitada)
        searchVis = true
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
    { id: 2, title: t('wizard.steps.tables'), icon: <Database className="w-4 h-4" />, hidden: config.logic_type === 'analytics' },
    { id: 3, title: t('wizard.steps.layout'), icon: <Layout className="w-4 h-4" /> },
    { id: 4, title: t('wizard.steps.actions'), icon: <MousePointer2 className="w-4 h-4" /> }
  ].filter(s => !s.hidden)

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

    if (currentStep === 1 && config.logic_type === 'analytics' && config.selected_models.length === 0 && models.length > 0) {
      setConfig(prev => ({ ...prev, selected_models: [models[0].id] }))
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
                    currentStep >= idx + 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400'
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl border-2 flex items-center justify-center font-black text-[10px] transition-all shadow-sm",
                    currentStep === idx + 1 ? 'border-indigo-600 bg-indigo-600 text-white rotate-3 shadow-indigo-500/20' :
                      currentStep > idx + 1 ? 'border-indigo-600 bg-indigo-600/10' : 'border-neutral-200 dark:border-neutral-800'
                  )}>
                    {currentStep > idx + 1 ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] hidden sm:block">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 mx-6 h-px transition-colors",
                    currentStep > idx + 1 ? 'bg-indigo-600/30' : 'bg-neutral-200 dark:bg-neutral-800'
                  )}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="mt-6 min-h-[500px]">
        {steps[currentStep - 1]?.id === 1 && (
          <StepLogic config={config} setConfig={setConfig} />
        )}
        {steps[currentStep - 1]?.id === 2 && (
          <StepTables config={config} setConfig={setConfig} models={models} />
        )}
        {steps[currentStep - 1]?.id === 3 && (
          <StepLayout config={config} setConfig={setConfig} models={models} />
        )}
        {steps[currentStep - 1]?.id === 4 && (
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
                : (currentStep === 1 && config.logic_type === 'analytics' ? false : !isStepValid(steps[currentStep-1].id))
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
    { id: 'cadastro', title: t('wizard.logic.types.cadastro.title'), desc: t('wizard.logic.types.cadastro.desc'), icon: Layout },
    { id: 'pesquisa_cadastro', title: t('wizard.logic.types.pesquisa_cadastro.title'), desc: t('wizard.logic.types.pesquisa_cadastro.desc'), icon: Layout },
    { id: 'master_detail', title: t('wizard.logic.types.master_detail.title'), desc: t('wizard.logic.types.master_detail.desc'), icon: Layers },
    { id: 'kanban', title: t('wizard.logic.types.kanban.title'), desc: t('wizard.logic.types.kanban.desc'), icon: Columns },
    { id: 'mapa_mental', title: t('wizard.logic.types.mapa_mental.title'), desc: t('wizard.logic.types.mapa_mental.desc'), icon: Share2 },
    { id: 'analytics', title: t('wizard.logic.types.analytics.title', 'Dashboard (BI)'), desc: t('wizard.logic.types.analytics.desc', 'Indicadores de desempenho, gráficos e KPIs.'), icon: Layout },
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
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({})
  const [fieldSearchTerm, setFieldSearchTerm] = useState('')
  const dragControls = useDragControls()
  
  const [editingWidget, setEditingWidget] = useState<any>(null)
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false)

  const handleAddWidget = () => {
    setEditingWidget({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Novo Widget',
      type: 'kpi',
      model_id: config.selected_models[0] || '',
      field: '',
      calc: 'COUNT',
      group_by: '',
      width: 'half',
      joins: []
    })
    setIsWidgetModalOpen(true)
  }

  const handleSaveWidget = (updatedWidget: any) => {
    const currentWidgets = config.layout_config.analytics_config?.widgets || []
    const exists = currentWidgets.find((w: any) => w.id === updatedWidget.id)
    
    let newWidgets
    if (exists) {
      newWidgets = currentWidgets.map((w: any) => w.id === updatedWidget.id ? updatedWidget : w)
    } else {
      newWidgets = [...currentWidgets, updatedWidget]
    }

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        analytics_config: { ...config.layout_config.analytics_config, widgets: newWidgets }
      }
    })
    setIsWidgetModalOpen(false)
    setEditingWidget(null)
  }

  const handleDeleteWidget = (id: string) => {
    const newWidgets = (config.layout_config.analytics_config?.widgets || []).filter((w: any) => w.id !== id)
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        analytics_config: { ...config.layout_config.analytics_config, widgets: newWidgets }
      }
    })
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: any) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return

    const activeIdStr = String(active.id)
    const overIdStr = String(over.id)

    if (activeIdStr.startsWith('source-') || activeIdStr.startsWith('table-source-')) {
      const isTable = activeIdStr.startsWith('table-source-')
      const id = activeIdStr.replace(isTable ? 'table-source-' : 'source-', '')
      
      let targetZone: 'filter_fields' | 'grid_fields' | 'form_fields' | null = null
      if (overIdStr === 'droppable-filter' || overIdStr.startsWith('filter-')) targetZone = 'filter_fields'
      else if (overIdStr === 'droppable-grid' || overIdStr.startsWith('grid-')) targetZone = 'grid_fields'
      else if (overIdStr === 'droppable-form' || overIdStr.startsWith('form-') || overIdStr.startsWith('droppable-form-')) targetZone = 'form_fields'

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

  const relationalTree = (() => {
    const masterId = config.layout_config.master_model_id || config.selected_models[0]
    const masterModel = models.find((m: any) => m.id === masterId)
    if (!masterModel) return []

    const joins = config.layout_config.joins || []
    const visited = new Set<string>([masterModel.db_table_name])

    const getNode = (model: any): any => {
      const children: any[] = []
      joins.forEach((j: any) => {
        if (j.from === model.db_table_name && !visited.has(j.to)) {
          const childModel = models.find((m: any) => m.db_table_name === j.to)
          if (childModel) {
            visited.add(j.to)
            children.push(getNode(childModel))
          }
        }
      })
      return { ...model, children }
    }

    const tree = [getNode(masterModel)]
    models.filter((m: any) => config.selected_models.includes(m.id) && !visited.has(m.db_table_name)).forEach((m: any) => {
       visited.add(m.db_table_name)
       tree.push(getNode(m))
    })
    return tree
  })()

  const flattenTree = (nodes: any[]): any[] => {
    let flat: any[] = []
    nodes.forEach(node => {
      flat.push(node)
      if (node.children) flat = flat.concat(flattenTree(node.children))
    })
    return flat
  }
  const orderedModels = config.logic_type === 'analytics' ? models : flattenTree(relationalTree)

  const renderModelZone = (model: any, depth: number = 0, index: number = 0) => {
    const isMaster = depth === 0 && index === 0
    const fieldsOfThisModel = config.layout_config.form_fields.filter((fid: string) => 
      model.fields.some((f: any) => f.id === fid)
    )

    return (
      <div key={`${model.id}-${depth}-${index}`} className={cn("space-y-4", depth > 0 && "ml-8 border-l-2 border-dashed border-amber-200 dark:border-amber-900/30 pl-6 pb-4")}>
        <div className="flex items-center justify-between ml-1 pr-6">
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-4 rounded-full shadow-sm", isMaster ? "bg-amber-600" : "bg-amber-400")}></div>
            <span className="text-[11px] font-black uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
              {isMaster ? `Mestre: ${model.display_name || model.db_table_name}` : 
               depth === 1 ? `Detalhe: ${model.display_name || model.db_table_name}` :
               `Sub-Detalhe: ${model.display_name || model.db_table_name}`}
            </span>
          </div>

          {!isMaster && (
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                {[
                  { id: 'modal', label: 'Modal', icon: Maximize2 },
                  { id: 'drawer', label: 'Drawer', icon: Layout }
                ].map(opt => {
                  const currentType = (config.layout_config as any).details_interface_types?.[model.id] || 'modal'
                  const isActive = currentType === opt.id
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        const currentTypes = (config.layout_config as any).details_interface_types || {}
                        setConfig({
                          ...config,
                          layout_config: {
                            ...config.layout_config,
                            details_interface_types: {
                              ...currentTypes,
                              [model.id]: opt.id
                            }
                          }
                        })
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                        isActive
                          ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                          : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                      )}
                    >
                      <opt.icon className="w-2.5 h-2.5" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>

            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800 ml-2">
              <button
                onClick={() => {
                  const currentInlines = (config.layout_config as any).details_inline_types || {}
                  const isCurrentlyInline = currentInlines[model.id] !== false // Default true
                  
                  setConfig({
                    ...config,
                    layout_config: {
                      ...config.layout_config,
                      details_inline_types: {
                        ...currentInlines,
                        [model.id]: !isCurrentlyInline
                      }
                    }
                  })
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest transition-all",
                  ((config.layout_config as any).details_inline_types?.[model.id] !== false)
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                )}
              >
                <div className={cn(
                  "w-1 h-1 rounded-full",
                  ((config.layout_config as any).details_inline_types?.[model.id] !== false) ? "bg-white" : "bg-neutral-400"
                )} />
                Na lista
              </button>
            </div>
          </div>
        )}
        </div>

        <DroppableZone 
          id={`droppable-form-${model.id}`} 
          className="grid grid-cols-7 gap-3 min-h-[100px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] items-start transition-all hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40"
        >
          {fieldsOfThisModel.length === 0 ? (
            <div className="col-span-7 flex flex-col items-center justify-center py-4 space-y-2 opacity-50">
               <Plus className="w-4 h-4 text-neutral-400" />
               <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Arraste campos de "{model.display_name || model.db_table_name}" para cá</p>
            </div>
          ) : (
            <SortableContext items={fieldsOfThisModel.map((id: string) => `form-${id}`)} strategy={rectSortingStrategy}>
              {fieldsOfThisModel.map((id: string) => (
                <SortableFieldChip
                  key={`form-${id}`}
                  id={`form-${id}`}
                  itemValue={id}
                  toggleField={toggleField}
                  zoneType="form"
                  onEdit={() => { setEditingFieldId(id); setEditingFieldZone('form'); setIsDrawerOpen(true); }}
                >
                   <span
                    style={{
                      fontFamily: getFieldMeta(id, 'form').label?.font,
                      fontSize: getFieldMeta(id, 'form').label?.size,
                      color: getFieldMeta(id, 'form').label?.color || undefined
                    }}
                    className={cn(
                      "text-[10px] font-black tracking-wider",
                      !getFieldMeta(id, 'form').label?.font && "uppercase"
                    )}
                  >
                    {getFieldMeta(id, 'form').label?.text || getFieldName(id)}
                  </span>
                </SortableFieldChip>
              ))}
            </SortableContext>
          )}
        </DroppableZone>

        {model.children && model.children.length > 0 && (
          <div className="space-y-6 pt-2">
            {model.children.map((child: any, cIdx: number) => renderModelZone(child, depth + 1, cIdx))}
          </div>
        )}
      </div>
    )
  }

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

      <DndContext 
        sensors={sensors} 
        collisionDetection={rectIntersection} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col xl:flex-row-reverse gap-10 relative">
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
            
            {/* Filtro de Campos */}
            <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-950/50 border-b border-neutral-100 dark:border-neutral-800">
              <div className="relative group">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-all" />
                <input 
                  type="text"
                  placeholder="Pesquisar tabelas ou campos..."
                  value={fieldSearchTerm}
                  onChange={e => setFieldSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {orderedModels
                .filter((m: any) => {
                  if (!fieldSearchTerm) return true
                  const term = fieldSearchTerm.toLowerCase()
                  const tableMatch = (m.display_name || m.db_table_name || '').toLowerCase().includes(term)
                  const fieldMatch = m.fields.some((f: any) => (f.display_name || f.db_column_name || '').toLowerCase().includes(term))
                  return tableMatch || fieldMatch
                })
                .map((m: any) => {
                  const isCollapsed = collapsedTables[m.id]
                  // Se houver busca e a tabela der match via campo, forçamos a expansão para mostrar os campos
                  const forceExpand = fieldSearchTerm && m.fields.some((f: any) => (f.display_name || f.db_column_name || '').toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                  const actuallyCollapsed = isCollapsed && !forceExpand

                return (
                  <div key={`sidebar-table-${m.id}`} className="border-b border-neutral-100 dark:border-neutral-800/50 last:border-0">
                    <button
                      onClick={() => setCollapsedTables(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                      className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-1 h-4 rounded-full transition-all",
                          actuallyCollapsed ? "bg-neutral-300" : "bg-indigo-500"
                        )}></div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300">
                          {m.display_name || m.db_table_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">{m.fields.length}</span>
                        {actuallyCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronUp className="w-3.5 h-3.5 text-indigo-500" />}
                      </div>
                    </button>
                    
                    {!actuallyCollapsed && (
                      <div className="p-4 pt-0 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <DraggableItem id={`table-source-${m.id}`} className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 p-2.5 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-all">
                           <div className="flex items-center gap-2">
                             <Table className="w-3 h-3 text-indigo-500" />
                             <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Adicionar Tabela</span>
                           </div>
                           <Plus className="w-3 h-3 text-indigo-400 group-hover:scale-125 transition-transform" />
                        </DraggableItem>

                        <div className="h-px bg-neutral-100 dark:bg-neutral-800 my-1"></div>

                        {m.fields
                          .filter((f: any) => {
                             if (!fieldSearchTerm) return true
                             const term = fieldSearchTerm.toLowerCase()
                             return (f.display_name || f.db_column_name || '').toLowerCase().includes(term) || (m.display_name || m.db_table_name || '').toLowerCase().includes(term)
                          })
                          .map((f: any) => (
                          <DraggableItem key={`source-${f.id}`} id={`source-${f.id}`} className="bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-100 dark:border-neutral-800/50 p-2.5 rounded-xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all">
                            <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 truncate pr-2">
                              {f.display_name || f.db_column_name}
                            </span>
                            <Plus className="w-3 h-3 text-neutral-300 group-hover:text-indigo-500 group-hover:scale-125 transition-all" />
                          </DraggableItem>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            </motion.div>
          </div>
          
          <div className="flex-1 space-y-10 min-w-0">
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
                  {orderedModels.flatMap((m: any) => m.fields).map((f: any) => (
                    <option key={`opt-kanban-${f.id}`} value={f.id}>
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
                    {models.filter(m => config.selected_models.includes(m.id)).map((m: any) => (
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

          {/* ZONA: ANALYTICS (BI) CONFIG */}
          {config.logic_type === 'analytics' && (
            <div className="p-6 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-[2rem] space-y-6 shadow-sm animate-in zoom-in-95 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Painel de Indicadores (BI)</h4>
                    <p className="text-[10px] text-neutral-400 font-medium mt-1">Configure os widgets e gráficos do seu dashboard.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                   <button 
                     onClick={() => setConfig({
                       ...config,
                       layout_config: {
                         ...config.layout_config,
                         analytics_config: { ...config.layout_config.analytics_config, allow_runtime_edit: !config.layout_config.analytics_config.allow_runtime_edit }
                       }
                     })}
                     className={cn(
                       "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                       config.layout_config.analytics_config.allow_runtime_edit ? "bg-indigo-600 text-white shadow-md" : "text-neutral-400 hover:text-neutral-600"
                     )}
                   >
                     Edição no Runtime: {config.layout_config.analytics_config.allow_runtime_edit ? 'ON' : 'OFF'}
                   </button>
                </div>
              </div>

              {/* Seção de Relacionamentos (JOINS) - USANDO COMPONENTE PADRÃO */}
              {config.logic_type !== 'analytics' && (
                <JoinsEditor 
                  joins={config.layout_config.joins || []}
                  models={models.filter(m => config.selected_models.includes(m.id))}
                  onUpdate={(newJoins) => setConfig({
                    ...config,
                    layout_config: { ...config.layout_config, joins: newJoins }
                  })}
                  t={t}
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(config.layout_config.analytics_config?.widgets || []).map((widget: any, idx: number) => (
                  <div key={widget.id || idx} className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between group shadow-sm hover:border-indigo-300 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                         {widget.type === 'kpi' ? <Maximize2 className="w-5 h-5" /> : <Layout className="w-5 h-5" />}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-neutral-900 dark:text-white">{widget.title}</h5>
                        <p className="text-[9px] text-neutral-400 uppercase font-black">{widget.type} • {widget.calc} ({getFieldName(widget.field) || 'Toda Tabela'})</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                       <button onClick={() => { setEditingWidget(widget); setIsWidgetModalOpen(true); }} className="p-2 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                       <button onClick={() => handleDeleteWidget(widget.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                
                <button 
                  onClick={handleAddWidget}
                  className="p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-neutral-400 hover:text-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all group"
                >
                  <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Adicionar Widget de BI</span>
                </button>
              </div>
            </div>
          )}
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
                  {relationalTree.flatMap((m: any) => m.fields).map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {getFieldName(f.id)} ({f.data_type})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-400 font-medium italic ml-1">{t('wizard.layout.mindmap.central_desc', 'Este campo será a raiz do seu mapa mental. Os campos selecionados na Zona 02 formarão os próximos níveis na ordem definida.')}</p>
              </div>
            </div>
          )}

          {/* ZONA: RELACIONAMENTOS (APENAS PARA MESTRE-DETALHE) - USANDO COMPONENTE PADRÃO */}
          {config.logic_type === 'master_detail' && (
            <JoinsEditor 
              joins={config.layout_config.joins || []}
              models={models.filter(m => config.selected_models.includes(m.id))}
              onUpdate={(newJoins) => setConfig({
                ...config,
                layout_config: { ...config.layout_config, joins: newJoins }
              })}
              t={t}
            />
          )}

          {/* ZONA: FILTROS */}
          {(config.logic_type.includes('pesquisa') || config.logic_type === 'kanban' || config.logic_type === 'mapa_mental' || config.logic_type === 'master_detail' || config.logic_type === 'analytics') && (
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
              <DroppableZone id="droppable-filter" className="grid grid-cols-7 gap-3 min-h-[80px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-start">
                {config.layout_config.filter_fields.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium w-full text-center italic">{t('wizard.layout.subtitle')}</p>
                ) : (
                  <SortableContext items={config.layout_config.filter_fields.map((id: string) => `filter-${id}`)} strategy={rectSortingStrategy}>
                    {config.layout_config.filter_fields.map((id: string) => (
                      <SortableFieldChip
                        key={`filter-${id}`}
                        id={`filter-${id}`}
                        itemValue={id}
                        toggleField={toggleField}
                        zoneType="filter"
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
                      </SortableFieldChip>
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

            <DroppableZone id="droppable-grid" className="grid grid-cols-7 gap-3 min-h-[100px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-start">
              {config.layout_config.grid_fields.length === 0 ? (
                <p className="text-xs text-neutral-400 font-medium w-full text-center italic">{t('wizard.layout.subtitle')}</p>
              ) : (
                <SortableContext items={config.layout_config.grid_fields.map((id: string) => `grid-${id}`)} strategy={rectSortingStrategy}>
                  {config.layout_config.grid_fields.map((id: string) => (
                    <SortableFieldChip
                      key={`grid-${id}`}
                      id={`grid-${id}`}
                      itemValue={id}
                      toggleField={toggleField}
                      zoneType="grid"
                      onEdit={() => { setEditingFieldId(id); setEditingFieldZone('grid'); setIsDrawerOpen(true); }}
                    >
                      <span
                        style={{
                          fontFamily: getFieldMeta(id, 'grid').label?.font,
                          fontSize: getFieldMeta(id, 'grid').label?.size,
                          color: getFieldMeta(id, 'grid').label?.color || undefined
                        }}
                        className={cn(
                          "text-[10px] font-black tracking-wider",
                          !getFieldMeta(id, 'grid').label?.font && "uppercase"
                        )}
                      >
                        {getFieldMeta(id, 'grid').label?.text || getFieldName(id)}
                      </span>
                    </SortableFieldChip>
                  ))}
                </SortableContext>
              )}
            </DroppableZone>
          </div>

          {/* ZONA: FORMULÁRIO (RECURSIVO) */}
          {(config.logic_type.includes('cadastro') || config.logic_type === 'master_detail') && (
            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-4 shadow-sm">
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

              <div className="space-y-6 pt-2">
                {relationalTree.map((node: any, nIdx: number) => renderModelZone(node, 0, nIdx))}
              </div>
            </div>
          )}
          </div>
        </div>

        <DragOverlay zIndex={1000}>
          {activeId ? (
            activeId.startsWith('table-source-') ? (
              <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-indigo-500 p-4 shadow-2xl opacity-90 scale-105 flex items-center justify-between w-80">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                  <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-[0.15em]">
                    {models.find((m: any) => m.id === activeId.replace('table-source-', ''))?.display_name || 'Tabela'}
                  </span>
                </div>
              </div>
            ) : activeId.startsWith('source-') ? (
              <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border-2 border-indigo-500 shadow-2xl opacity-90 scale-105 flex items-center justify-between w-72">
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                  {(() => {
                    const fid = activeId.replace('source-', '')
                    for (const m of models) {
                      const f = m.fields.find((f: any) => f.id === fid)
                      if (f) return f.display_name || f.db_column_name
                    }
                    return 'Campo'
                  })()}
                </span>
                <Plus className="w-3.5 h-3.5 text-indigo-500" />
              </div>
            ) : null
          ) : null}
        </DragOverlay>
      </DndContext>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={`${t('wizard.layout.drawer.title')}: ${editingFieldId ? getFieldName(editingFieldId) : ''}`}
      >
        {currentFieldMeta && (
          <div className="space-y-10 pb-20">
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

      {/* Widget Editor Modal */}
      <Modal
        isOpen={isWidgetModalOpen}
        onClose={() => setIsWidgetModalOpen(false)}
        title="Configurar Widget de BI"
      >
        <div className="space-y-6">
          <div className="space-y-3">
             <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Título do Widget</label>
             <input 
               type="text" 
               value={editingWidget?.title || ''} 
               onChange={e => setEditingWidget({...editingWidget, title: e.target.value})}
               className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-3 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold text-neutral-900 dark:text-white"
               placeholder="Ex: Total de Vendas"
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Tipo de Gráfico</label>
               <select 
                 value={editingWidget?.type || 'kpi'} 
                 onChange={e => setEditingWidget({...editingWidget, type: e.target.value})}
                 className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-2.5 focus:border-indigo-600 outline-none transition-all text-sm font-bold text-neutral-900 dark:text-white"
               >
                 <option value="kpi">KPI (Número)</option>
                 <option value="bar">Gráfico de Barras</option>
                 <option value="pie">Gráfico de Pizza</option>
                 <option value="line">Gráfico de Linha</option>
               </select>
            </div>
            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Tabela Fonte</label>
               <select 
                 value={editingWidget?.model_id || ''} 
                 onChange={e => setEditingWidget({...editingWidget, model_id: e.target.value})}
                 className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-2.5 focus:border-indigo-600 outline-none transition-all text-sm font-bold text-neutral-900 dark:text-white"
               >
                 <option value="">Selecione...</option>
                 {models.map((m: any) => (
                   <option key={m.id} value={m.id}>{m.display_name || m.db_table_name}</option>
                 ))}
               </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Cálculo / Operação</label>
               <select 
                 value={editingWidget?.calc || 'COUNT'} 
                 onChange={e => setEditingWidget({...editingWidget, calc: e.target.value})}
                 className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-2.5 focus:border-indigo-600 outline-none transition-all text-sm font-bold text-neutral-900 dark:text-white"
               >
                 <option value="COUNT">Contagem (COUNT)</option>
                 <option value="SUM">Soma (SUM)</option>
                 <option value="AVG">Média (AVG)</option>
                 <option value="MIN">Mínimo (MIN)</option>
                 <option value="MAX">Máximo (MAX)</option>
               </select>
            </div>
            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Campo do Valor</label>
               <select 
                 value={editingWidget?.field || ''} 
                 onChange={e => setEditingWidget({...editingWidget, field: e.target.value})}
                 className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-2.5 focus:border-indigo-600 outline-none transition-all text-sm font-bold text-neutral-900 dark:text-white"
               >
                 <option value="">(Toda a Tabela)</option>
                 {models.find((m: any) => m.id === editingWidget?.model_id)?.fields.map((f: any) => (
                   <option key={f.id} value={f.id}>{f.display_name || f.db_column_name}</option>
                 ))}
               </select>
            </div>
          </div>

          {editingWidget?.type !== 'kpi' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
               <div className="space-y-3">
                 <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Relacionamentos (JOINS Locais)</label>
                 <JoinsEditor 
                   joins={editingWidget?.joins || []}
                   models={models}
                   onUpdate={(newJoins) => setEditingWidget({...editingWidget, joins: newJoins})}
                   t={t}
                 />
                 <p className="text-[9px] text-neutral-400 font-medium italic px-2">Defina aqui como as tabelas se conectam para esta análise.</p>
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Agrupar por (Dimensão)</label>
                  <select 
                    value={editingWidget?.group_by || ''} 
                    onChange={e => setEditingWidget({...editingWidget, group_by: e.target.value})}
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-4 py-2.5 focus:border-indigo-600 outline-none transition-all text-sm font-bold text-neutral-900 dark:text-white"
                  >
                    <option value="">Selecione o campo de agrupamento...</option>
                    <optgroup label="Tabela Principal">
                      {models.find((m: any) => m.id === editingWidget?.model_id)?.fields?.map((f: any) => (
                        <option key={f.id} value={f.db_column_name}>{f.display_name || f.db_column_name}</option>
                      ))}
                    </optgroup>
                    
                    {/* Joins Locais do Widget */}
                    {(editingWidget?.joins || []).map((join: any, idx: number) => {
                      const primaryModel = models.find((m: any) => String(m.id) === String(editingWidget?.model_id))
                      const primaryModelName = primaryModel?.db_table_name?.toLowerCase()
                      const jFrom = join.from?.toLowerCase()
                      const relTableName = jFrom === primaryModelName ? join.to : join.from
                      if (!relTableName || relTableName.toLowerCase() === primaryModelName) return null
                      const relModel = models.find((m: any) => m.db_table_name?.toLowerCase() === relTableName.toLowerCase())
                      if (!relModel) return null
                      return (
                        <optgroup key={`local-${idx}`} label={`Relacionada (Local): ${relModel.display_name || relModel.db_table_name}`}>
                          {relModel.fields?.map((f: any) => (
                            <option key={f.id} value={`${relTableName}.${f.db_column_name}`}>{f.display_name || f.db_column_name}</option>
                          ))}
                        </optgroup>
                      )
                    })}

                    {/* Fallback para Joins Globais */}
                    {(config.layout_config.joins || []).map((join: any, idx: number) => {
                      const primaryModel = models.find((m: any) => String(m.id) === String(editingWidget?.model_id))
                      const primaryModelName = primaryModel?.db_table_name?.toLowerCase()
                      const jFrom = join.from?.toLowerCase()
                      const relTableName = jFrom === primaryModelName ? join.to : join.from
                      if (!relTableName || relTableName.toLowerCase() === primaryModelName) return null
                      const relModel = models.find((m: any) => m.db_table_name?.toLowerCase() === relTableName.toLowerCase())
                      if (!relModel) return null
                      return (
                        <optgroup key={`global-${idx}`} label={`Relacionada (Global): ${relModel.display_name || relModel.db_table_name}`}>
                          {relModel.fields?.map((f: any) => (
                            <option key={f.id} value={`${relTableName}.${f.db_column_name}`}>{f.display_name || f.db_column_name}</option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>
               </div>
            </div>
          )}

          <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
             <button onClick={() => setIsWidgetModalOpen(false)} className="flex-1 px-4 py-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
             <button onClick={() => handleSaveWidget(editingWidget)} className="flex-1 px-4 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">Salvar Widget</button>
          </div>
        </div>
      </Modal>
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
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${field.id}`,
    data: { fieldId: field.id }
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "py-2.5 px-4 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl flex items-center justify-between group cursor-grab active:cursor-grabbing hover:border-indigo-200 dark:hover:border-indigo-800/50 hover:shadow-md transition-all",
        isDragging && "opacity-20 grayscale"
      )}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">{field.display_name || field.db_column_name}</span>
        <span className="text-[8px] font-black font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md opacity-60 uppercase">{field.data_type}</span>
      </div>
    </div>
  )
}

function DroppableZone({ id, children, className }: any) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div 
      ref={setNodeRef} 
      className={cn(
        className, 
        "transition-all duration-300 relative",
        isOver && "bg-indigo-100/50 dark:bg-indigo-900/30 border-indigo-500 border-solid scale-[1.02] shadow-[0_0_40px_rgba(99,102,241,0.15)] ring-4 ring-indigo-500/10"
      )}
    >
      {isOver && (
        <div className="absolute inset-0 bg-indigo-500/5 pointer-events-none rounded-[inherit] animate-pulse"></div>
      )}
      {children}
    </div>
  )
}

function DraggableTableHeader({ model, isCollapsed, onToggle }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `table-source-${model.id}`,
    data: { tableId: model.id, isTable: true }
  })

  return (
    <div 
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Se estiver arrastando, não ativa o toggle
        if (isDragging) return;
        onToggle();
      }}
      className={cn(
        "sticky top-0 z-20 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md px-5 py-4 flex items-center justify-between cursor-pointer group/header border-b border-neutral-100 dark:border-neutral-800/50 shadow-sm transition-all",
        isDragging && "opacity-20 grayscale"
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

function SortableFieldChip({ id, itemValue, toggleField, onEdit, children, zoneType }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition,
    ...(isDragging ? { opacity: 0.5, zIndex: 50, position: 'relative' } : {})
  }

  const colorClasses = {
    filter: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20',
    grid: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20',
    form: 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
  }

  const activeColor = colorClasses[zoneType as keyof typeof colorClasses] || colorClasses.filter

  return (
    <div
      ref={setNodeRef}
      style={style as any}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2 text-white rounded-xl shadow-lg group cursor-pointer transition-all select-none w-full min-w-0",
        activeColor
      )}
    >
      <div className="flex-1 min-w-0 truncate">
        {children}
      </div>
      <Trash2
        className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer hover:text-red-200 transition-colors"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); toggleField(itemValue, `${zoneType}_fields`); }}
      />
    </div>
  )
}

function DraggableItem({ id, children, className }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: id
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(className, isDragging && "opacity-20 grayscale")}
    >
      {children}
    </div>
  )
}
