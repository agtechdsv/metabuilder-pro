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
  RefreshCcw
} from 'lucide-react'
import { useParams } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

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
          default_view: initialData.layout_config?.default_view || 'list'
        },
        buttons_config: (() => {
          const defaults = [
            { id: 'search', label: 'Pesquisar', icon: 'search', action: 'search', visible: true },
            { id: 'clear', label: 'Limpar', icon: 'refresh-ccw', action: 'clear', visible: true },
            { id: 'view', label: 'Visualizar', icon: 'search', action: 'view', visible: true },
            { id: 'add', label: 'Adicionar', icon: 'plus', action: 'create', visible: true },
            { id: 'edit', label: 'Editar', icon: 'edit', action: 'pencil', action_key: 'update', visible: true },
            { id: 'delete', label: 'Excluir', icon: 'trash', action_key: 'delete', visible: true }
          ]
          if (!initialData.buttons_config) return defaults
          // Merge: Keep existing visible states, but ensure all default IDs exist
          return defaults.map(def => {
            const existing = initialData.buttons_config.find((b: any) => b.id === def.id)
            return existing ? existing : { ...def, visible: false }
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
      default_view: 'list'
    },
    buttons_config: [
      { id: 'search', label: 'Pesquisar', icon: 'search', action: 'search', visible: true },
      { id: 'clear', label: 'Limpar', icon: 'refresh-ccw', action: 'clear', visible: true },
      { id: 'view', label: 'Visualizar', icon: 'search', action: 'view', visible: true },
      { id: 'add', label: 'Adicionar', icon: 'plus', action: 'create', visible: true },
      { id: 'edit', label: 'Editar', icon: 'edit', action: 'pencil', action_key: 'update', visible: true },
      { id: 'delete', label: 'Excluir', icon: 'trash', action_key: 'delete', visible: true }
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
    { id: 1, title: 'Lógica', icon: <Settings2 className="w-4 h-4" /> },
    { id: 2, title: 'Tabelas', icon: <Database className="w-4 h-4" /> },
    { id: 3, title: 'Campos & Layout', icon: <Layout className="w-4 h-4" /> },
    { id: 4, title: 'Ações & Query', icon: <MousePointer2 className="w-4 h-4" /> }
  ]

  const nextStep = () => {
    // Validação Passo 2: Tabelas
    if (currentStep === 2 && config.selected_models.length === 0) {
      toast('Selecione pelo menos uma tabela para continuar.', 'error')
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
          toast('Selecione pelo menos um campo para a Listagem (Grid).', 'error')
          return
        }
        if (has_arguments && !hasFilter) {
          toast('Você habilitou argumentos. Selecione pelo menos um campo de Filtro.', 'error')
          return
        }
      }

      if (logic_type === 'cadastro') {
        if (!hasForm) {
          toast('Selecione pelo menos um campo para o Formulário.', 'error')
          return
        }
      }

      if (logic_type === 'pesquisa_cadastro') {
        if (!hasGrid) {
          toast('Selecione pelo menos um campo para a Listagem (Grid).', 'error')
          return
        }
        if (!hasForm) {
          toast('Selecione pelo menos um campo para o Formulário.', 'error')
          return
        }
        if (has_arguments && !hasFilter) {
          toast('Você habilitou argumentos. Selecione pelo menos um campo de Filtro.', 'error')
          return
        }
      }
    }

    setCurrentStep(prev => Math.min(prev + 1, steps.length))
  }
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  const handleSave = async () => {
    if (!config.name || !config.slug) {
      toast('Por favor, preencha o nome e o slug da tela.', 'error')
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
        if (!componentMap[fid]) {
          componentMap[fid] = {
            view_id: view.id,
            field_id: fid,
            component_type: zone, // Usa a primeira zona como tipo inicial
            label: '',
            config: { zones: [zone] }
          }
        } else {
          if (!componentMap[fid].config.zones.includes(zone)) {
            componentMap[fid].config.zones.push(zone)
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
      toast('Erro ao salvar caso de uso: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-neutral-500">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-600" />
      <p className="text-sm font-bold animate-pulse">Carregando Builder...</p>
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
              <h1 className="text-lg font-black tracking-tight">Use Case Builder</h1>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase font-black tracking-[0.2em]">{initialData ? 'Editando Caso de Uso' : 'Novo Caso de Uso'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? (initialData ? 'Atualizando...' : 'Salvando...') : (initialData ? 'Atualizar Caso de Uso' : 'Finalizar Caso de Uso')}
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 px-8 py-6 rounded-[2.5rem]">
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
                    "w-10 h-10 rounded-2xl border-2 flex items-center justify-center font-black text-sm transition-all shadow-sm",
                    currentStep === step.id ? 'border-indigo-600 bg-indigo-600 text-white rotate-3 shadow-indigo-500/20' : 
                    currentStep > step.id ? 'border-indigo-600 bg-indigo-600/10' : 'border-neutral-200 dark:border-neutral-800'
                  )}>
                    {currentStep > step.id ? <CheckCircle2 className="w-6 h-6" /> : step.id}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] hidden sm:block">{step.title}</span>
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
      <div className="mt-12 min-h-[500px]">
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
      <div className="fixed bottom-8 left-0 right-0 flex justify-center px-6 z-40">
        <div className="w-full max-w-4xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 p-4 rounded-[2.5rem] flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <button 
            onClick={prevStep}
            disabled={currentStep === 1}
            className={cn(
              "flex items-center gap-2 px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-0",
              currentStep === steps.length 
                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xl" 
                : "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
            )}
          >
            <ChevronLeft className="w-4 h-4" /> Passo Anterior
          </button>

          <button 
            onClick={currentStep === steps.length ? handleSave : nextStep}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-2 px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl",
              currentStep === steps.length 
                ? "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
                : "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-neutral-900/10 dark:shadow-white/5"
            )}
          >
            {currentStep === steps.length ? (
              isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {initialData ? 'Atualizando...' : 'Salvando...'}</>
              ) : (
                <>{initialData ? 'Atualizar Caso de Uso' : 'Finalizar Caso de Uso'} <Save className="w-4 h-4 ml-1" /></>
              )
            ) : (
              <>Próximo Passo <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- SUB-COMPONENTES DE PASSOS ---

function StepLogic({ config, setConfig }: any) {
  const types = [
    { id: 'pesquisa', title: 'Pesquisa', desc: 'Focado em busca e visualização de dados.' },
    { id: 'pesquisa_cadastro', title: 'Pesquisa + Cadastro', desc: 'Fluxo completo: busca, listagem e formulário.' },
    { id: 'cadastro', title: 'Apenas Cadastro', desc: 'Formulário direto para inserção de dados.' }
  ]

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-3">
        <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">Qual a lógica do seu caso de uso?</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">Defina o comportamento principal desta tela no MetaBuilder.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {types.map(t => (
          <button
            key={t.id}
            onClick={() => setConfig({...config, logic_type: t.id})}
            className={cn(
              "p-10 rounded-[3rem] border-2 text-left transition-all group relative overflow-hidden",
              config.logic_type === t.id 
                ? 'border-indigo-600 bg-indigo-600/5 shadow-2xl shadow-indigo-500/10 scale-[1.02]' 
                : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
            )}
          >
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all shadow-sm",
              config.logic_type === t.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-indigo-600'
            )}>
              <Layout className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-xl mb-3">{t.title}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="p-10 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-[3.5rem] border border-neutral-200 dark:border-neutral-800 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Nome da Tela</label>
            <input 
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
              placeholder="Ex: Gestão de Contratos"
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 focus:border-indigo-600 outline-none transition-all shadow-sm text-sm font-bold"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">URL Amigável (Slug)</label>
            <div className="flex items-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-6 py-4 focus-within:border-indigo-600 transition-all shadow-sm">
              <span className="text-neutral-400 mr-2 font-bold">/</span>
              <input 
                type="text" 
                value={config.slug}
                onChange={e => setConfig({...config, slug: e.target.value.toLowerCase().replace(/\s/g, '-')})}
                placeholder="contratos"
                className="w-full bg-transparent outline-none text-sm font-bold"
              />
            </div>
          </div>
        </div>

        {config.logic_type.includes('pesquisa') && (
          <div className="flex items-center gap-4 p-6 bg-white dark:bg-neutral-950/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 group cursor-pointer hover:border-indigo-500/30 transition-all" onClick={() => setConfig({...config, has_arguments: !config.has_arguments})}>
            <div className={cn(
              "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
              config.has_arguments ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-neutral-200 dark:border-neutral-800'
            )}>
              {config.has_arguments && <CheckCircle2 className="w-4 h-4" />}
            </div>
            <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Habilitar Argumentos (Filtros de pesquisa na URL)</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StepTables({ config, setConfig, models }: any) {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
       <div className="space-y-3">
        <h2 className="text-4xl font-extrabold tracking-tight">Quais tabelas compõem este caso?</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">Você pode selecionar uma ou mais tabelas. A lógica de Join será configurada a seguir.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {models.map((m: any) => {
          const isSelected = config.selected_models.includes(m.id)
          return (
            <button
              key={m.id}
              onClick={() => {
                const newSelected = isSelected 
                  ? config.selected_models.filter((id: string) => id !== m.id)
                  : [...config.selected_models, m.id]
                setConfig({...config, selected_models: newSelected})
              }}
              className={cn(
                "p-8 rounded-[2.5rem] border-2 text-left transition-all relative group",
                isSelected 
                  ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10' 
                  : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <div className={cn(
                  "p-3 rounded-xl transition-all",
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                )}>
                  <Database className="w-6 h-6" />
                </div>
                {isSelected && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/40"><CheckCircle2 className="w-4 h-4" /></div>}
              </div>
              <h4 className="font-bold text-lg text-neutral-900 dark:text-white">{m.display_name || m.db_table_name}</h4>
              <p className="text-[10px] text-neutral-400 font-mono mt-1 uppercase tracking-widest">{m.db_table_name}</p>
            </button>
          )
        })}
      </div>

      {config.selected_models.length > 1 && (
        <div className="p-8 bg-amber-500/5 border border-amber-500/20 rounded-[2.5rem] flex items-center gap-6 text-amber-600 dark:text-amber-400 animate-bounce-subtle">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-6 h-6 shrink-0" />
          </div>
          <p className="text-sm font-bold">Você selecionou <strong>{config.selected_models.length} tabelas</strong>. No próximo passo, definiremos as relações (Joins) entre elas.</p>
        </div>
      )}
    </div>
  )
}

function StepLayout({ config, setConfig, models }: any) {
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

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
       <div className="space-y-3">
        <h2 className="text-4xl font-extrabold tracking-tight">Desenhe o Layout da Tela</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">Organize os campos em zonas específicas. Um campo pode estar em mais de uma zona.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Lista de Campos Disponíveis */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] sticky top-28">
            <h4 className="text-[10px] font-black uppercase text-neutral-400 mb-8 flex items-center gap-3 tracking-[0.2em]">
              <Database className="w-4 h-4" /> Campos Disponíveis
            </h4>
            <div className="space-y-8 max-h-[55vh] overflow-y-auto pr-4 custom-scrollbar">
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
                            title={!config.has_arguments ? "Habilite argumentos no passo 1" : ""}
                          >
                            Filtro
                          </button>
                          <button 
                            onClick={() => toggleField(f.id, 'grid_fields')}
                            className={cn(
                              "flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter transition-all",
                              config.layout_config.grid_fields.includes(f.id) ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:bg-neutral-200'
                            )}
                          >
                            Grid
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
                            Form
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visualização de Zonas */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* ZONA: FILTROS */}
          {config.logic_type.includes('pesquisa') && (
            <div className="p-10 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[3rem] space-y-8 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Zona 01: Filtros de Pesquisa</h4>
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 rounded-full text-[10px] font-black tracking-widest">{config.layout_config.filter_fields.length} campos</span>
              </div>
              <div className="flex flex-wrap gap-3 min-h-[80px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] items-center">
                {config.layout_config.filter_fields.length === 0 ? (
                  <p className="text-xs text-neutral-400 font-medium w-full text-center italic">Arraste ou selecione campos para os filtros...</p>
                ) : (
                  config.layout_config.filter_fields.map((id: string) => (
                    <div key={id} className="flex items-center gap-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 group">
                      {getFieldName(id)}
                      <Trash2 className="w-3.5 h-3.5 cursor-pointer hover:text-red-300 transition-colors" onClick={() => toggleField(id, 'filter_fields')} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="p-10 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[3rem] space-y-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.3em]">Zona 02: Listagem (Grid/Tabela)</h4>
                <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl w-fit">
                  {[
                    { id: 'list', label: 'Tabela' },
                    { id: 'card', label: 'Cards' },
                    { id: 'both', label: 'Ambos' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setConfig({
                        ...config,
                        layout_config: { ...config.layout_config, display_type: opt.id }
                      })}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
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

              {/* Se for AMBOS, permite escolher o padrão */}
              {config.layout_config.display_type === 'both' && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-[0.2em]">Padrão de Entrada</h4>
                  <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-1 rounded-xl w-fit">
                    {[
                      { id: 'list', label: 'Lista' },
                      { id: 'card', label: 'Cards' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setConfig({
                          ...config,
                          layout_config: { ...config.layout_config, default_view: opt.id }
                        })}
                        className={cn(
                          "px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                          (config.layout_config.default_view || 'list') === opt.id 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[10px] font-black tracking-widest">{config.layout_config.grid_fields.length} campos</span>
            </div>
            <div className="min-h-[120px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
              {config.layout_config.grid_fields.length === 0 ? (
                <div className="h-full flex items-center justify-center italic text-xs text-neutral-400 font-medium">Selecione campos para exibir na tabela de resultados...</div>
              ) : (
                <div className="w-full overflow-hidden rounded-[1.5rem] border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 font-black uppercase text-neutral-400 tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Campo</th>
                        <th className="px-6 py-4 w-12 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {config.layout_config.grid_fields.map((id: string) => (
                        <tr key={id} className="group hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-bold text-neutral-700 dark:text-neutral-200">{getFieldName(id)}</td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => toggleField(id, 'grid_fields')} className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-neutral-400 transition-all">
                              <Trash2 className="w-4 h-4" />
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
            <div className="p-10 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[3rem] space-y-8 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-[0.3em]">Zona 03: Formulário de Edição</h4>
                <span className="px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full text-[10px] font-black tracking-widest">{config.layout_config.form_fields.length} campos</span>
              </div>
              <div className="min-h-[120px] p-6 bg-neutral-50 dark:bg-neutral-950/30 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
                {config.layout_config.form_fields.length === 0 ? (
                  <div className="h-full flex items-center justify-center italic text-xs text-neutral-400 font-medium">Quais campos poderão ser preenchidos pelo usuário?</div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    {config.layout_config.form_fields.map((id: string) => (
                      <div key={id} className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between group shadow-sm hover:border-amber-500/30 transition-all">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">{getFieldName(id)}</span>
                          <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em]">Input Text</span>
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
    </div>
  )
}

function StepActions({ config, setConfig }: any) {
  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
       <div className="space-y-3">
        <h2 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">Query & Ações Finais</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg">Configure como os dados serão recuperados e quais botões estarão disponíveis.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Estratégia de Dados</h4>
          <div className="space-y-6">
            <button 
              onClick={() => setConfig({...config, query_type: 'dynamic'})}
              className={cn(
                "w-full p-8 rounded-[2.5rem] border-2 text-left transition-all",
                config.query_type === 'dynamic' ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10' : 'border-neutral-100 dark:border-neutral-800/50 bg-white dark:bg-neutral-900/30'
              )}
            >
              <h5 className="font-bold text-lg mb-2">Query Dinâmica (Automática)</h5>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">O MetaBuilder gera os Joins e Selects baseado nas relações das tabelas.</p>
            </button>
            <button 
              onClick={() => setConfig({...config, query_type: 'custom'})}
              className={cn(
                "w-full p-8 rounded-[2.5rem] border-2 text-left transition-all",
                config.query_type === 'custom' ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10' : 'border-neutral-100 dark:border-neutral-800/50 bg-white dark:bg-neutral-900/30'
              )}
            >
              <h5 className="font-bold text-lg mb-2">Query Manual (SQL)</h5>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium leading-relaxed">Você escreve o SQL puro para maior controle e performance.</p>
            </button>
          </div>

          {config.query_type === 'custom' && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-2">SQL Query Editor</label>
              <textarea 
                value={config.custom_query}
                onChange={e => setConfig({...config, custom_query: e.target.value})}
                className="w-full h-56 bg-neutral-900 text-indigo-400 font-mono text-xs p-8 rounded-[2rem] border border-neutral-800 outline-none focus:border-indigo-600 transition-all shadow-2xl"
                placeholder="SELECT * FROM table1 JOIN table2..."
              />
            </div>
          )}
        </div>

        <div className="space-y-8">
          <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.3em]">Botões da Interface</h4>
          <div className="space-y-4">
            {config.buttons_config.map((btn: any) => (
              <div key={btn.id} className="flex items-center justify-between p-6 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-[2rem] shadow-sm hover:border-indigo-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-neutral-500">
                    {btn.id === 'search' && <Search className="w-5 h-5" />}
                    {btn.id === 'clear' && <RefreshCcw className="w-5 h-5" />}
                    {btn.id === 'view' && <Search className="w-5 h-5" />}
                    {btn.id === 'add' && <Plus className="w-5 h-5" />}
                    {btn.id === 'edit' && <Pencil className="w-5 h-5" />}
                    {btn.id === 'delete' && <Trash2 className="w-5 h-5" />}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">{btn.label}</span>
                    <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">{btn.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div 
                    onClick={() => {
                      const newButtons = config.buttons_config.map((b: any) => 
                        b.id === btn.id ? { ...b, visible: !b.visible } : b
                      )
                      setConfig({ ...config, buttons_config: newButtons })
                    }}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all cursor-pointer",
                      btn.visible ? 'bg-indigo-600' : 'bg-neutral-200 dark:bg-neutral-800'
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md",
                      btn.visible ? 'left-7' : 'left-1'
                    )} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
