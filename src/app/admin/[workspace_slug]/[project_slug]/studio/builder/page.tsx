'use client'

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
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Download
} from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { HeaderActions } from '@/components/layout/HeaderActions'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'

/**
 * MetaBuilder Studio - Advanced Use Case Builder
 * Um Wizard completo para criação de lógicas de negócio
 */
export default function UseCaseBuilder() {
  const { t } = useI18n()
  const params = useParams()
  const router = useRouter()
  const { workspace_slug, project_slug } = params
  const supabase = createClient()
  const { toast } = useToast()

  // Estados do Wizard
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [models, setModels] = useState<any[]>([])

  // Configuração da View sendo criada
  const [config, setConfig] = useState({
    name: '',
    slug: '',
    logic_type: 'pesquisa_cadastro', // pesquisa, pesquisa_cadastro, cadastro
    has_arguments: true,
    selected_models: [] as string[],
    tables_config: [] as any[],
    query_type: 'dynamic',
    custom_query: '',
    layout_config: {
      filter_fields: [] as string[],
      grid_fields: [] as string[],
      form_fields: [] as string[],
      grouping_type: 'sections' // sections, tabs
    },
    buttons_config: [
      { id: 'add', label: t('dashboard.projects.studio.wizard.buttons.add'), icon: 'plus', action: 'create', visible: true },
      { id: 'edit', label: t('dashboard.projects.studio.wizard.buttons.edit'), icon: 'edit', action: 'update', visible: true },
      { id: 'delete', label: t('dashboard.projects.studio.wizard.buttons.delete'), icon: 'trash', action: 'delete', visible: true },
      { id: 'export', label: 'Exportar Dados', icon: 'download', action: 'export', visible: true }
    ]
  })

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
    { id: 1, title: t('dashboard.projects.studio.builder.logic_step'), icon: <Settings2 className="w-4 h-4" /> },
    { id: 2, title: t('dashboard.projects.studio.builder.tables_step'), icon: <Database className="w-4 h-4" /> },
    { id: 3, title: t('dashboard.projects.studio.builder.layout_step'), icon: <Layout className="w-4 h-4" /> },
    { id: 4, title: t('dashboard.projects.studio.builder.actions_step'), icon: <MousePointer2 className="w-4 h-4" /> }
  ]

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length))
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  const handleSave = async () => {
    if (!config.name || !config.slug) {
      toast(t('dashboard.projects.studio.builder.fill_name_slug'), 'error')
      return
    }

    setIsSaving(true)
    try {
      // 1. Criar/Atualizar a View Principal
      const { data: view, error: viewError } = await supabase
        .from('ui_views')
        .upsert({
          project_id: (await supabase.from('projects').select('id').eq('slug', project_slug).single()).data?.id,
          name: config.name,
          slug: config.slug,
          logic_type: config.logic_type,
          has_arguments: config.has_arguments,
          tables_config: config.selected_models, // Simplificado para o MVP: apenas IDs das tabelas
          query_type: config.query_type,
          custom_query: config.custom_query,
          layout_config: config.layout_config,
          buttons_config: config.buttons_config,
          view_type: 'advanced_use_case'
        }, { onConflict: 'slug' }) // No MVP, usamos slug como conflito único por projeto
        .select()
        .single()

      if (viewError) throw viewError

      // 2. Limpar componentes antigos desta view antes de reinserir (Rebuild)
      await supabase.from('ui_components').delete().eq('view_id', view.id)

      // 3. Inserir componentes por zona
      const componentsToInsert: any[] = []

      // Filtros
      config.layout_config.filter_fields.forEach((fid: string) => {
        componentsToInsert.push({ view_id: view.id, field_id: fid, component_type: 'filter', label: '', config: { zone: 'filter' } })
      })

      // Grid
      config.layout_config.grid_fields.forEach((fid: string) => {
        componentsToInsert.push({ view_id: view.id, field_id: fid, component_type: 'column', label: '', config: { zone: 'grid' } })
      })

      // Form
      config.layout_config.form_fields.forEach((fid: string) => {
        componentsToInsert.push({ view_id: view.id, field_id: fid, component_type: 'input', label: '', config: { zone: 'form' } })
      })

      if (componentsToInsert.length > 0) {
        const { error: compError } = await supabase.from('ui_components').insert(componentsToInsert)
        if (compError) throw compError
      }

      router.push(`/admin/${workspace_slug}/${project_slug}/studio`)
    } catch (err: any) {
      console.error(err)
      toast(t('dashboard.projects.studio.builder.error_save') + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">{t('dashboard.projects.studio.config.loading_studio')}</div>

  return (
    <div className="min-h-screen bg-white dark:bg-[#080808] text-neutral-900 dark:text-white selection:bg-indigo-500/30">

      {/* Top Navigation */}
      <nav className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/50 dark:bg-neutral-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href={`/admin/${workspace_slug}/${project_slug}/studio`} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-800 mx-1"></div>
          <div>
            <h1 className="text-sm font-bold">{t('dashboard.projects.studio.builder.title')}</h1>
            <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">{t('dashboard.projects.studio.builder.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? t('dashboard.projects.studio.builder.saving') : t('dashboard.projects.studio.builder.finish_builder')}
          </button>
          <HeaderActions />
        </div>
      </nav>

      {/* Stepper Progress Bar */}
      <div className="bg-neutral-50 dark:bg-neutral-900/30 border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div
                className={`flex items-center gap-3 transition-all ${currentStep >= step.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-neutral-400'}`}
              >
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all ${currentStep === step.id ? 'border-indigo-600 bg-indigo-600 text-white' : currentStep > step.id ? 'border-indigo-600 bg-indigo-600/10' : 'border-neutral-300 dark:border-neutral-700'}`}>
                  {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </div>
                <span className="text-xs font-black uppercase tracking-widest hidden sm:block">{step.title}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex-1 mx-4 h-px bg-neutral-200 dark:border-neutral-800"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <main className="max-w-6xl mx-auto p-10 min-h-[calc(100vh-160px)] flex flex-col">

        <div className="flex-1">
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

        {/* Footer Navigation */}
        <div className="mt-auto pt-10 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all disabled:opacity-0"
          >
            <ChevronLeft className="w-4 h-4" /> {t('dashboard.projects.studio.builder.back_step')}
          </button>

          <button
            onClick={nextStep}
            disabled={currentStep === steps.length}
            className="flex items-center gap-2 px-8 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl text-xs font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            {t('dashboard.projects.studio.builder.next_step')} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </main>
    </div>
  )
}

// --- SUB-COMPONENTES DE PASSOS ---

function StepLogic({ config, setConfig }: any) {
  const { t } = useI18n()
  const types = [
    { id: 'pesquisa', title: t('dashboard.projects.studio.builder.logic_research_only'), desc: t('dashboard.projects.studio.builder.logic_research_only_desc') },
    { id: 'pesquisa_cadastro', title: t('dashboard.projects.studio.builder.logic_research_registration'), desc: t('dashboard.projects.studio.builder.logic_research_registration_desc') },
    { id: 'cadastro', title: t('dashboard.projects.studio.builder.logic_registration_only'), desc: t('dashboard.projects.studio.builder.logic_registration_only_desc') }
  ]

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight">{t('dashboard.projects.studio.builder.step_logic_title')}</h2>
        <p className="text-neutral-500">{t('dashboard.projects.studio.builder.step_logic_desc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {types.map(t => (
          <button
            key={t.id}
            onClick={() => setConfig({ ...config, logic_type: t.id })}
            className={`p-8 rounded-[2.5rem] border-2 text-left transition-all group ${config.logic_type === t.id ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10' : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-all ${config.logic_type === t.id ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover:text-neutral-600'}`}>
              <Layout className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-2">{t.title}</h3>
            <p className="text-sm text-neutral-500 leading-relaxed">{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="p-8 bg-neutral-50 dark:bg-neutral-900/50 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('dashboard.projects.studio.builder.screen_name')}</label>
            <input
              type="text"
              value={config.name}
              onChange={e => setConfig({ ...config, name: e.target.value })}
              placeholder={t('dashboard.projects.studio.builder.screen_name_placeholder') || 'Ex: Gestão de Contratos'}
              className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-5 py-4 focus:border-indigo-600 outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('dashboard.projects.studio.builder.slug_label')}</label>
            <div className="flex items-center bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-5 py-4 focus-within:border-indigo-600 transition-all">
              <span className="text-neutral-400 mr-2">/</span>
              <input
                type="text"
                value={config.slug}
                onChange={e => setConfig({ ...config, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                placeholder="contratos"
                className="w-full bg-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {config.logic_type.includes('pesquisa') && (
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <input
              type="checkbox"
              id="args"
              checked={config.has_arguments}
              onChange={e => setConfig({ ...config, has_arguments: e.target.checked })}
              className="w-5 h-5 rounded-md accent-indigo-600"
            />
            <label htmlFor="args" className="text-sm font-medium cursor-pointer">{t('dashboard.projects.studio.builder.enable_args')}</label>
          </div>
        )}
      </div>
    </div>
  )
}

function StepTables({ config, setConfig, models }: any) {
  const { t } = useI18n()
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight">{t('dashboard.projects.studio.builder.step_tables_title')}</h2>
        <p className="text-neutral-500">{t('dashboard.projects.studio.builder.step_tables_desc')}</p>
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
              className={`p-6 rounded-3xl border-2 text-left transition-all relative ${isSelected ? 'border-indigo-600 bg-indigo-600/5' : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <Database className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-neutral-400'}`} />
                {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
              </div>
              <h4 className="font-bold text-sm">{m.display_name || m.db_table_name}</h4>
              <p className="text-[10px] text-neutral-400 font-mono mt-1">{m.db_table_name}</p>
            </button>
          )
        })}
      </div>

      {config.selected_models.length > 1 && (
        <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] flex items-center gap-4 text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="text-sm font-medium">{t('dashboard.projects.studio.builder.multi_tables_alert').replace('{count}', config.selected_models.length.toString())}</p>
        </div>
      )}
    </div>
  )
}

function StepLayout({ config, setConfig, models }: any) {
  const { t } = useI18n()
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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight">{t('dashboard.projects.studio.builder.step_layout_title')}</h2>
        <p className="text-neutral-500">{t('dashboard.projects.studio.builder.step_layout_desc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Lista de Campos Disponíveis */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] sticky top-24">
            <h4 className="text-[10px] font-black uppercase text-neutral-400 mb-6 flex items-center gap-2">
              <Database className="w-3 h-3" /> {t('dashboard.projects.studio.builder.available_fields')}
            </h4>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {selectedModelsData.map((m: any) => (
                <div key={m.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                    <span className="text-[10px] font-black text-neutral-900 dark:text-white uppercase tracking-widest">{m.display_name || m.db_table_name}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {m.fields.map((f: any) => (
                      <div key={f.id} className="group p-3 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs flex flex-col gap-3 hover:border-indigo-500/50 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{f.display_name || f.db_column_name}</span>
                          <span className="text-[10px] font-mono text-neutral-400">{f.data_type}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleField(f.id, 'filter_fields')}
                            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all ${config.layout_config.filter_fields.includes(f.id) ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}
                          >
                            Filtro
                          </button>
                          <button
                            onClick={() => toggleField(f.id, 'grid_fields')}
                            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all ${config.layout_config.grid_fields.includes(f.id) ? 'bg-emerald-600 text-white' : 'bg-neutral-100 dark:border-neutral-800 text-neutral-400'}`}
                          >
                            Grid
                          </button>
                          <button
                            onClick={() => toggleField(f.id, 'form_fields')}
                            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter transition-all ${config.layout_config.form_fields.includes(f.id) ? 'bg-amber-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}
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
        <div className="lg:col-span-8 space-y-6">

          {/* ZONA: FILTROS */}
          {config.logic_type.includes('pesquisa') && (
            <div className="p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-[0.2em]">{t('dashboard.projects.studio.builder.zone_filter')}</h4>
                <span className="text-[10px] font-bold text-neutral-400">{config.layout_config.filter_fields.length} {t('dashboard.projects.studio.config.fields_detected')}</span>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-neutral-50 dark:bg-neutral-950/50 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl items-center">
                {config.layout_config.filter_fields.length === 0 ? (
                  <p className="text-[10px] text-neutral-400 italic w-full text-center">{t('dashboard.projects.studio.builder.no_fields_selected')}</p>
                ) : (
                  config.layout_config.filter_fields.map((id: string) => (
                    <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold">
                      {getFieldName(id)}
                      <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-200" onClick={() => toggleField(id, 'filter_fields')} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ZONA: GRID */}
          <div className="p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em]">{t('dashboard.projects.studio.builder.zone_grid')}</h4>
              <span className="text-[10px] font-bold text-neutral-400">{config.layout_config.grid_fields.length} {t('dashboard.projects.studio.config.fields_detected')}</span>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[100px] p-4 bg-neutral-50 dark:bg-neutral-950/50 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl items-center">
              {config.layout_config.grid_fields.length === 0 ? (
                <p className="text-[10px] text-neutral-400 italic w-full text-center">{t('dashboard.projects.studio.builder.no_fields_selected')}</p>
              ) : (
                <div className="w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                  <table className="w-full text-[10px] text-left">
                    <thead className="bg-neutral-100 dark:bg-neutral-800 font-black uppercase text-neutral-500">
                      <tr>
                        <th className="px-4 py-2">Campo</th>
                        <th className="px-4 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {config.layout_config.grid_fields.map((id: string) => (
                        <tr key={id}>
                          <td className="px-4 py-3 font-bold">{getFieldName(id)}</td>
                          <td className="px-4 py-3 text-right">
                            <Trash2 className="w-3 h-3 text-neutral-400 hover:text-red-500 cursor-pointer" onClick={() => toggleField(id, 'grid_fields')} />
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
            <div className="p-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[2.5rem] space-y-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-[0.2em]">{t('dashboard.projects.studio.builder.zone_form')}</h4>
                <span className="text-[10px] font-bold text-neutral-400">{config.layout_config.form_fields.length} {t('dashboard.projects.studio.config.fields_detected')}</span>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[100px] p-4 bg-neutral-50 dark:bg-neutral-950/50 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl items-center">
                {config.layout_config.form_fields.length === 0 ? (
                  <p className="text-[10px] text-neutral-400 italic w-full text-center">{t('dashboard.projects.studio.builder.no_fields_selected')}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 w-full">
                    {config.layout_config.form_fields.map((id: string) => (
                      <div key={id} className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between group">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold">{getFieldName(id)}</span>
                          <span className="text-[8px] text-neutral-400 uppercase tracking-tighter">Input Text</span>
                        </div>
                        <Trash2 className="w-3 h-3 text-neutral-300 group-hover:text-red-500 cursor-pointer" onClick={() => toggleField(id, 'form_fields')} />
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
  const { t } = useI18n()
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <h2 className="text-3xl font-extrabold tracking-tight">{t('dashboard.projects.studio.builder.step_actions_title')}</h2>
        <p className="text-neutral-500">{t('dashboard.projects.studio.builder.step_actions_desc')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <h4 className="text-xs font-black uppercase text-indigo-600">{t('dashboard.projects.studio.builder.data_strategy')}</h4>
          <div className="space-y-4">
            <button
              onClick={() => setConfig({ ...config, query_type: 'dynamic' })}
              className={`w-full p-6 rounded-3xl border-2 text-left transition-all ${config.query_type === 'dynamic' ? 'border-indigo-600 bg-indigo-600/5' : 'border-neutral-200 dark:border-neutral-800'}`}
            >
              <h5 className="font-bold text-sm">{t('dashboard.projects.studio.builder.dynamic_query')}</h5>
              <p className="text-xs text-neutral-500 mt-1">{t('dashboard.projects.studio.builder.dynamic_query_desc')}</p>
            </button>
            <button
              onClick={() => setConfig({ ...config, query_type: 'custom' })}
              className={`w-full p-6 rounded-3xl border-2 text-left transition-all ${config.query_type === 'custom' ? 'border-indigo-600 bg-indigo-600/5' : 'border-neutral-200 dark:border-neutral-800'}`}
            >
              <h5 className="font-bold text-sm">{t('dashboard.projects.studio.builder.manual_query')}</h5>
              <p className="text-xs text-neutral-500 mt-1">{t('dashboard.projects.studio.builder.manual_query_desc')}</p>
            </button>
          </div>

          {config.query_type === 'custom' && (
            <textarea
              value={config.custom_query}
              onChange={e => setConfig({ ...config, custom_query: e.target.value })}
              className="w-full h-40 bg-neutral-900 text-indigo-400 font-mono text-xs p-6 rounded-3xl border border-neutral-800 outline-none focus:border-indigo-600 transition-all"
              placeholder="SELECT * FROM table1 JOIN table2..."
            />
          )}
        </div>

        <div className="space-y-6">
          <h4 className="text-xs font-black uppercase text-indigo-600">{t('dashboard.projects.studio.builder.interface_buttons')}</h4>
          <div className="space-y-3">
            {config.buttons_config.map((btn: any) => (
              <div key={btn.id} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-500">
                    {btn.icon === 'plus' && <Plus className="w-4 h-4" />}
                    {btn.icon === 'edit' && <Pencil className="w-4 h-4" />}
                    {btn.icon === 'trash' && <Trash2 className="w-4 h-4" />}
                    {btn.icon === 'download' && <Download className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-bold">{btn.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-tighter">{btn.action}</span>
                  <input 
                    type="checkbox" 
                    checked={btn.visible} 
                    onChange={() => {
                      setConfig({
                        ...config,
                        buttons_config: config.buttons_config.map((b: any) =>
                          b.id === btn.id ? { ...b, visible: !b.visible } : b
                        )
                      })
                    }} 
                    className="w-4 h-4 accent-indigo-600 cursor-pointer" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
