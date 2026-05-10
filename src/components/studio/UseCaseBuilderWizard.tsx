'use client'
// Refined UseCaseBuilderWizard - Metadata Driven Actions Order

import { useState, useEffect } from 'react'
import {
  ArrowLeft,
  Save,
  ChevronRight,
  ChevronLeft,
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
  RotateCcw
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'
import { Drawer } from '@/components/ui/Drawer'
import { Modal } from '@/components/ui/Modal'

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

  const nextStep = () => {
    // Validação Passo 2: Tabelas
    if (currentStep === 2 && config.selected_models.length === 0) {
      toast(t('dashboard.projects.studio.config.db_fields_desc').replace('{table}', ''), 'error')
      return
    }

    // Validação Passo 3: Layout & Campos
    if (currentStep === 3) {
      const { logic_type, has_arguments, layout_config } = config
      const hasGrid = layout_config.grid_fields.length > 0
      const hasFilter = layout_config.filter_fields.length > 0
      const hasForm = layout_config.form_fields.length > 0

      if (logic_type === 'pesquisa') {
        if (!hasGrid) {
          toast(t('wizard.buttons.validation.grid_required'), 'error')
          return
        }
        if (has_arguments && !hasFilter) {
          toast(t('wizard.buttons.validation.filter_required'), 'error')
          return
        }
      }

      if (logic_type === 'cadastro') {
        if (!hasForm) {
          toast(t('wizard.buttons.validation.form_required'), 'error')
          return
        }
      }

      if (logic_type === 'pesquisa_cadastro') {
        if (!hasGrid) {
          toast(t('wizard.buttons.validation.grid_required'), 'error')
          return
        }
        if (!hasForm) {
          toast(t('wizard.buttons.validation.form_required'), 'error')
          return
        }
        if (has_arguments && !hasFilter) {
          toast(t('wizard.buttons.validation.filter_required'), 'error')
          return
        }
      }
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
        model_id: config.selected_models[0] // Define a primeira tabela como modelo principal
      }

      // Verifica se já existe uma view com este slug neste projeto
      const { data: existingView } = await supabase
        .from('ui_views')
        .select('id')
        .eq('project_id', projectData?.id)
        .eq('slug', config.slug)
        .maybeSingle()

      let view: any
      let viewError: any

      if (existingView) {
        const { data, error } = await supabase
          .from('ui_views')
          .update(viewPayload)
          .eq('id', existingView.id)
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
        const metadata = config.layout_config.fields_metadata[fid] || {}
        if (!componentMap[fid]) {
          componentMap[fid] = {
            view_id: view.id,
            field_id: fid,
            component_type: zone, // Usa a primeira zona como tipo inicial
            label: metadata.label?.text || '',
            config: {
              zones: [zone],
              ...metadata // Inclui todas as propriedades (font, size, color, mask, required) no config
            }
          }
        } else {
          if (!componentMap[fid].config.zones.includes(zone)) {
            componentMap[fid].config.zones.push(zone)
          }
          // Garante que o label e o config estejam atualizados mesmo se já existir
          componentMap[fid].label = metadata.label?.text || componentMap[fid].label
          componentMap[fid].config = { ...componentMap[fid].config, ...metadata }
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
    <div className="flex flex-col animate-in fade-in duration-500 pb-32">

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

        {config.logic_type.includes('pesquisa') && (
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
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

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
      if (f) return `${m.db_table_name}.${f.db_column_name}`
    }
    return id
  }

  const currentFieldMeta = editingFieldId ? (config.layout_config.fields_metadata[editingFieldId] || {
    label: { text: getFieldName(editingFieldId).split('.').pop(), font: 'Inter', size: '9px', color: '' },
    content: { font: 'Inter', size: '12px', color: '', mask: '', required: false }
  }) : null

  const updateMeta = (section: 'label' | 'content', key: string, value: any) => {
    if (!editingFieldId) return
    const newMeta = { ...currentFieldMeta }
    newMeta[section] = { ...newMeta[section], [key]: value }

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        fields_metadata: {
          ...config.layout_config.fields_metadata,
          [editingFieldId]: newMeta
        }
      }
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.layout.title')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.layout.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all border border-red-200 dark:border-red-900/50 shadow-sm active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 flex flex-col h-[600px]">
          <div className="p-5 border-b border-neutral-200 dark:border-neutral-800">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.layout.available_fields')}</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
            {selectedModelsData.map((m: any) => (
              <div key={m.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                  <span className="text-[11px] font-black text-neutral-900 dark:text-white uppercase tracking-[0.15em]">{m.display_name || m.db_table_name}</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {m.fields.map((f: any) => (
                    <div key={f.id} className="group p-4 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-xs flex flex-col gap-4 hover:border-indigo-500/50 transition-all shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-700 dark:text-neutral-200">{f.display_name || f.db_column_name}</span>
                        <span className="text-[9px] font-black font-mono text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md">{f.data_type}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={!config.has_arguments || config.logic_type === 'cadastro'}
                          onClick={() => toggleField(f.id, 'filter_fields')}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all",
                            config.layout_config.filter_fields.includes(f.id) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200',
                            (!config.has_arguments || config.logic_type === 'cadastro') && "opacity-20 cursor-not-allowed grayscale"
                          )}
                        >
                          {t('wizard.layout.zones.filter')}
                        </button>
                        <button
                          onClick={() => toggleField(f.id, 'grid_fields')}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all",
                            config.layout_config.grid_fields.includes(f.id) ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200'
                          )}
                        >
                          {t('wizard.layout.zones.grid')}
                        </button>
                        <button
                          disabled={config.logic_type === 'pesquisa'}
                          onClick={() => toggleField(f.id, 'form_fields')}
                          className={cn(
                            "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all",
                            config.layout_config.form_fields.includes(f.id) ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200',
                            config.logic_type === 'pesquisa' && "opacity-20 cursor-not-allowed grayscale"
                          )}
                        >
                          {t('wizard.layout.zones.form')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-3 space-y-6">
          {/* ZONA: FILTROS */}
          {config.logic_type.includes('pesquisa') && (
            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[9px] font-black uppercase text-indigo-600 tracking-[0.3em]">{t('wizard.layout.zones.zone_01')}: {t('wizard.layout.zones.filter')}</h4>
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.filter_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
              </div>
              <div className="flex flex-wrap gap-3 min-h-[80px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-center">
                {config.layout_config.filter_fields.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium w-full text-center italic">{t('wizard.layout.subtitle')}</p>
                ) : (
                  config.layout_config.filter_fields.map((id: string) => (
                    <div
                      key={id}
                      onClick={() => { setEditingFieldId(id); setIsDrawerOpen(true); }}
                      className="flex items-center gap-3 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/20 group cursor-pointer hover:bg-indigo-500 transition-all"
                    >
                      <span
                        style={{
                          fontFamily: config.layout_config.fields_metadata[id]?.label?.font,
                          fontSize: config.layout_config.fields_metadata[id]?.label?.size,
                          color: config.layout_config.fields_metadata[id]?.label?.color || undefined
                        }}
                        className={cn(
                          "text-[10px] font-black tracking-wider",
                          !config.layout_config.fields_metadata[id]?.label?.font && "uppercase"
                        )}
                      >
                        {config.layout_config.fields_metadata[id]?.label?.text || getFieldName(id)}
                      </span>
                      <Trash2
                        className="w-3.5 h-3.5 cursor-pointer hover:text-red-300 transition-colors"
                        onClick={(e) => { e.stopPropagation(); toggleField(id, 'filter_fields'); }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ZONA: GRID */}
          <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-[9px] font-black uppercase text-emerald-600 tracking-[0.3em]">{t('wizard.layout.zones.zone_02')}: {t('wizard.layout.zones.grid')}</h4>
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
              </div>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.grid_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
            </div>

            <div className="min-h-[100px] p-4 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[1.5rem]">
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
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {config.layout_config.grid_fields.map((id: string) => (
                        <tr key={id} className="group hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                          <td
                            onClick={() => { setEditingFieldId(id); setIsDrawerOpen(true); }}
                            style={{
                              fontFamily: config.layout_config.fields_metadata[id]?.label?.font,
                              fontSize: config.layout_config.fields_metadata[id]?.label?.size,
                              color: config.layout_config.fields_metadata[id]?.label?.color || undefined
                            }}
                            className={cn(
                              "px-4 py-2.5 font-bold",
                              !config.layout_config.fields_metadata[id]?.label?.color && "text-neutral-700 dark:text-neutral-200",
                              !config.layout_config.fields_metadata[id]?.label?.font && "capitalize"
                            )}
                          >
                            {config.layout_config.fields_metadata[id]?.label?.text || getFieldName(id)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button onClick={() => toggleField(id, 'grid_fields')} className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-neutral-400 transition-all">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ZONA: FORM */}
          {config.logic_type.includes('cadastro') && (
            <div className="p-4 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[1.5rem] space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[9px] font-black uppercase text-amber-600 tracking-[0.3em]">{t('wizard.layout.zones.zone_03')}: {t('wizard.layout.zones.form')}</h4>
                <span className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[9px] font-black tracking-widest">{config.layout_config.form_fields.length} {t('dashboard.projects.studio.fields_count')}</span>
              </div>
              <div className="min-h-[100px] p-4 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[1.5rem]">
                {config.layout_config.form_fields.length === 0 ? (
                  <div className="h-full flex items-center justify-center italic text-xs text-neutral-400 font-medium">{t('wizard.layout.subtitle')}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {config.layout_config.form_fields.map((id: string) => (
                      <div
                        key={id}
                        onClick={() => { setEditingFieldId(id); setIsDrawerOpen(true); }}
                        className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between group shadow-sm hover:border-indigo-500/30 transition-all cursor-pointer"
                      >
                        <div className="flex flex-col gap-1">
                          <span 
                            style={{
                              fontFamily: config.layout_config.fields_metadata[id]?.label?.font,
                              fontSize: config.layout_config.fields_metadata[id]?.label?.size,
                              color: config.layout_config.fields_metadata[id]?.label?.color || undefined
                            }}
                            className={cn(
                              "text-[10px] font-black",
                              !config.layout_config.fields_metadata[id]?.label?.color && "text-neutral-800 dark:text-neutral-200",
                              !config.layout_config.fields_metadata[id]?.label?.font && "uppercase tracking-wider"
                            )}
                          >
                            {config.layout_config.fields_metadata[id]?.label?.text || getFieldName(id)}
                          </span>
                          <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em]">{t('wizard.layout.zones.form')} Input</span>
                        </div>
                        <button onClick={() => toggleField(id, 'form_fields')} className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-neutral-400 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
