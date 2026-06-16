import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import FormulaBuilder from '../../../FormulaBuilder'
import {
  Settings2, Database, Layout, MousePointer2, Plus, Trash2,
  CheckCircle2, AlertCircle, Loader2, Search, Pencil, RefreshCcw,
  Table, GripVertical, SlidersHorizontal, ArrowRightLeft, ArrowRight,
  Type, Palette, Maximize2, Lock, Type as FontIcon, Share2, Columns,
  Settings, LayoutGrid, Wand2, Terminal, RotateCcw, Link, Layers,
  Activity, History, Gauge, BarChart3, BarChartHorizontal, Calendar,
  Download, Zap, Globe, Copy, FileText, FileSpreadsheet, Workflow,
  Check, X, Eye, EyeOff, ChevronDown, ChevronUp
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { IconPicker } from '../../../IconPicker'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { getModelsWithRelations } from '@/lib/relationPathFinder'
import { useDraggable, useDroppable } from '@dnd-kit/core'

export function StepActions({ config, setConfig, models, useCases, isDownloadsActive, bpmWorkflows, relations = [] }: any) {
  const params = useParams()
  const { workspace_slug, project_slug } = params as { workspace_slug: string, project_slug: string }
  const { t } = useI18n()
  const [isActionModalOpen, setIsActionModalOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<any>(null)
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null)
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false)
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'trigger' | 'appearance' | 'bpm'>('general')
  const [selectedButtonConfig, setSelectedButtonConfig] = useState<any>(null)
  const [isButtonPropertiesOpen, setIsButtonPropertiesOpen] = useState(false)

  const isButtonDisabledByModel = (btnId: string) => {
    const masterId = config.selected_models?.[0]
    if (!masterId) return false
    const masterModel = models.find((m: any) => m.id === masterId)
    if (!masterModel) return false
    if (btnId === 'add' && masterModel.can_create === false) return true
    if (btnId === 'edit' && masterModel.can_update === false) return true
    if (btnId === 'delete' && masterModel.can_delete === false) return true
    return false
  }

  const getFieldName = (id: string) => {
    for (const m of models) {
      const f = m.fields?.find((f: any) => f.id === id)
      if (f) {
        return f.display_name || f.db_column_name
      }
    }
    return id
  }

  const getGroupedFields = () => {
    const layout = config.layout_config || {}
    const filterIds = layout.filter_fields || []
    const gridIds = layout.grid_fields || []
    const formIds = layout.form_fields || []
    const masterId = layout.master_model_id || config.selected_models?.[0] || ''

    const filterFields: any[] = []
    const gridFields: any[] = []
    const masterFields: any[] = []
    const detailFields: any[] = []

    models.forEach((m: any) => {
      m.fields?.forEach((f: any) => {
        if (filterIds.includes(f.id)) filterFields.push(f)
        if (gridIds.includes(f.id)) gridFields.push(f)
        if (formIds.includes(f.id)) {
          if (m.id === masterId) masterFields.push(f)
          else detailFields.push(f)
        }
      })
    })
    return { filterFields, gridFields, masterFields, detailFields }
  }

  const handleSaveAction = (actionToSave: any) => {
    // Generate backwards compatibility flat arrays
    const action = { ...actionToSave };
    if (action.placements && Array.isArray(action.placements)) {
      const flatContexts = new Set<string>();
      const flatGroupFields = new Set<string>();
      
      action.placements.forEach((p: any) => {
        p.contexts?.forEach((c: string) => {
          if (p.location === 'search') {
            flatContexts.add(c);
          } else if (p.location === 'master') {
            if (c === 'global_top') flatContexts.add('master_top');
            else if (c === 'field_group') flatContexts.add('field_group');
            else flatContexts.add(c);
          } else if (p.location.startsWith('detail:')) {
            if (c === 'global_top') flatContexts.add('detail_top');
            else if (c === 'row') flatContexts.add('detail_row');
            else if (c === 'field_group') flatContexts.add('field_group');
            else flatContexts.add(c);
          } else if (p.location.startsWith('slot:')) {
            flatContexts.add(c);
          }
        });
        
        p.group_fields?.forEach((f: string) => {
          if (p.location === 'master') flatGroupFields.add(`master:${f}`);
          else if (p.location.startsWith('detail:')) flatGroupFields.add(`detail:${f}`);
          else flatGroupFields.add(f);
        });
      });
      
      action.contexts = Array.from(flatContexts);
      action.group_fields = Array.from(flatGroupFields);
      if (action.contexts.length > 0) action.context = action.contexts[0];
      if (action.group_fields.length > 0) action.group_field = action.group_fields[0];
    }

    const currentActions = config.layout_config.custom_actions || []
    const isNew = !currentActions.some((a: any) => a.id === action.id)
    const newActions = isNew
      ? [...currentActions, { ...action, id: action.id || Math.random().toString(36).substr(2, 9) }]
      : currentActions.map((a: any) => a.id === action.id ? action : a)

    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        custom_actions: newActions
      }
    })
    setIsActionModalOpen(false)
    setEditingAction(null)
  }

  const handleDeleteAction = (id: string) => {
    setConfig({
      ...config,
      layout_config: {
        ...config.layout_config,
        custom_actions: (config.layout_config.custom_actions || []).filter((a: any) => a.id !== id)
      }
    })
  }

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

  const groupedFields = getGroupedFields()

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="space-y-2">
        <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 dark:text-white">{t('wizard.actions.title')}</h2>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('wizard.actions.subtitle')}</p>
      </div>

      {config.logic_type !== 'personalizado' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2 ml-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.actions.interface_buttons')}</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfig({
                    ...config,
                    buttons_config: config.buttons_config.map((b: any) =>
                      (b.id !== 'export' && !isButtonDisabledByModel(b.id)) ? { ...b, visible: true } : b
                    )
                  })
                }}
                className="text-[9px] font-bold px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors uppercase tracking-wider"
              >
                Selecionar Todos
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfig({
                    ...config,
                    buttons_config: config.buttons_config.map((b: any) =>
                      (b.id !== 'export' && !isButtonDisabledByModel(b.id)) ? { ...b, visible: false } : b
                    )
                  })
                }}
                className="text-[9px] font-bold px-2 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors uppercase tracking-wider"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {config.buttons_config.filter((b: any) => b.id !== 'export').map((btn: any) => {
              const isDisabled = isButtonDisabledByModel(btn.id)
              return (
                <div key={btn.id} className="relative group/btn w-full">
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setConfig({
                        ...config,
                        buttons_config: config.buttons_config.map((b: any) =>
                          b.id === btn.id ? { ...b, visible: !b.visible } : b
                        )
                      })
                    }}
                    className={cn(
                      "w-full p-4 rounded-[1.5rem] border transition-all flex flex-col items-center justify-center gap-3 min-h-[108px] relative",
                      btn.visible
                        ? "bg-white dark:bg-neutral-955 border-indigo-600 shadow-lg shadow-indigo-500/5"
                        : "bg-neutral-50/50 dark:bg-neutral-900/30 border-neutral-200 dark:border-neutral-800 opacity-50",
                      isDisabled && "opacity-30 cursor-not-allowed hover:border-neutral-200 dark:hover:border-neutral-800"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center transition-colors",
                      btn.visible ? "bg-indigo-500 text-white" : "bg-neutral-200 dark:bg-neutral-800 text-neutral-500"
                    )}
                      style={btn.visible ? {
                        backgroundColor: btn.bg_color || undefined,
                        color: btn.text_color || undefined
                      } : undefined}
                    >
                      {btn.icon === 'search' && <Search className="w-5 h-5" />}
                      {btn.icon === 'refresh-ccw' && <RefreshCcw className="w-5 h-5" />}
                      {btn.icon === 'plus' && <Plus className="w-5 h-5" />}
                      {btn.icon === 'pencil' && <Pencil className="w-5 h-5" />}
                      {btn.icon === 'trash' && <Trash2 className="w-5 h-5" />}
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-black transition-all truncate max-w-full px-2",
                        (btn.custom_label !== undefined && btn.custom_label !== '') ? "" : "capitalize tracking-wider"
                      )}
                      style={btn.visible ? {
                        fontFamily: (btn.font_family && btn.font_family !== 'Inter (PadrÃ£o)') ? btn.font_family : undefined,
                        fontSize: btn.font_size || undefined,
                        color: btn.text_color || undefined,
                        textTransform: (btn.text_transform !== undefined ? (btn.text_transform !== 'none' ? btn.text_transform : undefined) : 'capitalize') as any
                      } : undefined}
                    >
                      {btn.custom_label !== undefined && btn.custom_label !== '' ? btn.custom_label : (t(btn.labelKey) || btn.label)}
                    </span>
                  </button>

                  {/* Settings Trigger Icon */}
                  {!isDisabled && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedButtonConfig({
                          ...btn,
                          custom_label: btn.custom_label !== undefined ? btn.custom_label : (t(btn.labelKey) || btn.label),
                          font_family: btn.font_family || 'Inter (PadrÃ£o)',
                          font_size: btn.font_size || '10px',
                          text_color: btn.text_color || '',
                          bg_color: btn.bg_color || '',
                          text_transform: btn.text_transform || 'capitalize'
                        });
                        setIsButtonPropertiesOpen(true);
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 opacity-0 group-hover/btn:opacity-100 focus:opacity-100 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all cursor-pointer z-10"
                      title="Propriedades do BotÃ£o"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.custom_actions')}</label>
          <button
            onClick={() => {
              setEditingAction({
                id: Math.random().toString(36).substr(2, 9),
                label: t('wizard.actions.new_action'),
                icon: 'Zap',
                color: 'indigo',
                trigger_type: 'usecase',
                context: 'row',
                sql_query: '',
                usecase_slug: '',
                usecase_params: '',
                usecase_open_mode: 'page',
                rest_url: '',
                rest_method: 'POST',
                rest_body: ''
              })
              setActiveModalTab('general')
              setIsActionModalOpen(true)
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('wizard.actions.add_action')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(config.layout_config.custom_actions || []).length === 0 ? (
            <div className="col-span-full p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-[2rem] flex flex-col items-center justify-center text-neutral-400">
              <Zap className="w-6 h-6 mb-2 opacity-50" />
              <p className="text-[10px] font-black uppercase tracking-widest">{t('wizard.actions.no_custom_actions')}</p>
            </div>
          ) : (
            (config.layout_config.custom_actions || []).map((action: any) => (
              <div key={action.id} className="p-5 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl bg-${action.color}-100 dark:bg-${action.color}-900/30 text-${action.color}-600 dark:text-${action.color}-400`}>
                    {action.icon === 'Zap' && <Zap className="w-5 h-5" />}
                    {action.icon === 'Link' && <Link className="w-5 h-5" />}
                    {action.icon === 'Database' && <Database className="w-5 h-5" />}
                    {action.icon === 'Globe' && <Globe className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-white">{action.label}</h4>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wider">
                      {action.trigger_type} â€¢ {(() => {
                        const activeContexts: string[] = action.contexts
                          ? (Array.isArray(action.contexts) ? action.contexts : [action.contexts])
                          : (action.context ? [action.context] : ['row']);
                        return activeContexts.map(c => {
                          if (c === 'row') return t('wizard.actions.contexts.row');
                          if (c === 'bulk') return t('wizard.actions.contexts.bulk');
                          if (c === 'master_top') return t('wizard.actions.contexts.master_top');
                          if (c === 'detail_top') return t('wizard.actions.contexts.detail_top');
                          if (c === 'detail_row') return t('wizard.actions.contexts.detail_row');
                          return c;
                        }).join(', ');
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingAction(action); setActiveModalTab('general'); setIsActionModalOpen(true); }} className="p-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl hover:bg-indigo-100"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteAction(action.id)} className="p-2 text-red-600 bg-red-50 dark:bg-red-900/30 rounded-xl hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>



      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.action_interface_label')}</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'drawer', title: t('wizard.actions.interface_options.drawer_title'), desc: t('wizard.actions.interface_options.drawer_desc'), icon: Layout },
            { id: 'modal', title: t('wizard.actions.interface_options.modal_title'), desc: t('wizard.actions.interface_options.modal_desc'), icon: Maximize2 },
            { id: 'page', title: t('wizard.actions.interface_options.page_title'), desc: t('wizard.actions.interface_options.page_desc'), icon: Layout }
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

      <div className="space-y-6">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.export_data_title', 'ExportaÃ§Ã£o de Dados')}</label>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              const isExportVisible = config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false;
              setConfig({
                ...config,
                buttons_config: config.buttons_config.map((b: any) =>
                  b.id === 'export' ? { ...b, visible: !isExportVisible } : b
                )
              });
            }}
            className={cn(
              "w-full p-6 rounded-[2rem] border-2 text-left transition-all relative group overflow-hidden flex items-center justify-between",
              (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false)
                ? 'border-indigo-600 bg-indigo-600/5 shadow-xl shadow-indigo-500/10'
                : 'border-neutral-100 dark:border-neutral-800/50 hover:border-neutral-200 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/30'
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-2xl transition-all",
                (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'bg-indigo-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
              )}>
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-neutral-900 dark:text-white">{t('wizard.actions.export_data_bg', 'ExportaÃ§Ã£o de Dados (Background)')}</h4>
                <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed">{t('wizard.actions.export_data_desc', 'Permite que os usuÃ¡rios exportem os dados desta tela com processamento assÃ­ncrono.')}</p>
              </div>
            </div>
            <div className={cn(
              "w-12 h-6 rounded-full p-1 transition-all relative cursor-pointer flex items-center",
              (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'bg-indigo-600' : 'bg-neutral-300 dark:bg-neutral-700'
            )}>
              <div className={cn(
                "w-4 h-4 bg-white rounded-full transition-all shadow-md transform",
                (config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) ? 'translate-x-6' : 'translate-x-0'
              )} />
            </div>
          </button>

          {(config.buttons_config.find((b: any) => b.id === 'export')?.visible !== false) && (
            <div className="p-6 bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 fade-in duration-300">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{t('wizard.actions.allowed_formats', 'Formatos Permitidos')}</label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { id: 'xlsx', label: 'Excel (XLSX)', icon: Table, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20' },
                  { id: 'csv', label: 'CSV', icon: Table, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10', border: 'border-indigo-200 dark:border-indigo-500/20' },
                  { id: 'json', label: 'JSON', icon: Database, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20' },
                  { id: 'pdf', label: 'PDF', icon: Layout, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20' },
                  { id: 'ofx', label: 'OFX (Finance)', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/20' }
                ].map(fmt => {
                  const isSelected = (config.layout_config.export_formats || ['xlsx', 'csv', 'json']).includes(fmt.id);
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => {
                        const current = config.layout_config.export_formats || ['xlsx', 'csv', 'json'];
                        const next = isSelected ? current.filter((f: string) => f !== fmt.id) : [...current, fmt.id];
                        setConfig({
                          ...config,
                          layout_config: { ...config.layout_config, export_formats: next }
                        });
                      }}
                      className={cn(
                        "p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center",
                        isSelected ? cn(fmt.border, fmt.bg) : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-transparent opacity-50 grayscale"
                      )}
                    >
                      <fmt.icon className={cn("w-5 h-5", isSelected ? fmt.color : "text-neutral-400")} />
                      <span className={cn("text-[9px] font-black uppercase tracking-wider", isSelected ? fmt.color : "text-neutral-500")}>{fmt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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

      <Modal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        title={editingAction?.id ? t('wizard.actions.custom_action_edit') : t('wizard.actions.custom_action_new')}
        size="2xl"
      >
        {editingAction && (
          <div className="space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar p-1">
            {/* Nav Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 -mx-1 mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setActiveModalTab('general')}
                className={cn(
                  "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                  activeModalTab === 'general'
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                <span className={cn(
                  "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                  activeModalTab === 'general' ? "bg-indigo-600 border-indigo-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
                )}>1</span>
                {t('wizard.actions.tab_identification')}
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('trigger')}
                className={cn(
                  "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                  activeModalTab === 'trigger'
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                <span className={cn(
                  "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                  activeModalTab === 'trigger' ? "bg-indigo-600 border-indigo-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
                )}>2</span>
                {t('wizard.actions.tab_behavior')}
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('bpm')}
                className={cn(
                  "px-5 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2",
                  activeModalTab === 'bpm'
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                )}
              >
                <span className={cn(
                  "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] border",
                  activeModalTab === 'bpm' ? "bg-emerald-600 border-emerald-600 text-white font-bold" : "border-neutral-300 dark:border-neutral-700"
                )}>3</span>
                {t('wizard.actions.tab_bpm')}
              </button>
            </div>

            {/* General Tab */}
            {activeModalTab === 'general' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Left: Button properties */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.button_name')}</label>
                    <input
                      type="text"
                      value={editingAction.label}
                      onChange={e => setEditingAction({ ...editingAction, label: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.icon')}</label>
                    <button
                      type="button"
                      onClick={() => setIsIconPickerOpen(true)}
                      className="w-full flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <div className="flex items-center gap-3">
                        <DynamicIcon icon={editingAction.icon || 'Zap'} className="w-5 h-5 text-indigo-500" />
                        <span>{editingAction.icon || t('wizard.actions.select_icon_placeholder')}</span>
                      </div>
                      <span className="text-[10px] uppercase text-neutral-400 font-bold">{t('wizard.actions.change')}</span>
                    </button>
                    {isIconPickerOpen && (
                      <IconPicker
                        currentIcon={editingAction.icon || 'Zap'}
                        onSelect={icon => {
                          setEditingAction({ ...editingAction, icon })
                          setIsIconPickerOpen(false)
                        }}
                        onClose={() => setIsIconPickerOpen(false)}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.color')}</label>
                    <select
                      value={editingAction.color}
                      onChange={e => setEditingAction({ ...editingAction, color: e.target.value })}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="indigo">{t('wizard.actions.colors.indigo')}</option>
                      <option value="emerald">{t('wizard.actions.colors.emerald')}</option>
                      <option value="red">{t('wizard.actions.colors.red')}</option>
                      <option value="amber">{t('wizard.actions.colors.amber')}</option>
                      <option value="purple">{t('wizard.actions.colors.purple')}</option>
                    </select>
                  </div>
                </div>

                {/* Right: Context checkboxes */}
                <div className="lg:col-span-7 space-y-4">
                  {(() => {
                    const availableLocations = (() => {
                      const locs = [];
                      if (config.logic_type === 'pesquisa_cadastro') {
                        const masterUc = useCases?.find((uc: any) => uc.slug === config.layout_config.master_use_case_slug);
                        locs.push({ id: 'search', label: 'Tela de Pesquisa (Lista)', modelId: masterUc?.model_id || '', depth: 0 });
                      }
                      
                      if (config.logic_type === 'pesquisa_cadastro' || config.logic_type === 'personalizado') {
                        const rootId = config.layout_config.master_model_id || config.selected_models?.[0];
                        const rootModel = models.find((m: any) => m.id === rootId);
                        const masterLabel = (config.layout_config as any).master_tab_title || rootModel?.display_name || rootModel?.db_table_name || 'Mestre';
                        locs.push({ id: 'master', label: `Aba Mestre (${masterLabel})`, modelId: rootId || '', depth: 0 });
                      }

                      if (config.logic_type === 'pesquisa_cadastro') {
                        const rootId = config.layout_config.master_model_id || config.selected_models?.[0];
                        const rootModel = models.find((m: any) => m.id === rootId);
                        const maxDepth = config.layout_config?.max_relation_depth || 2;
                        
                        const buildTree = (modelId: string, depth: number, visited: Set<string>): any[] => {
                          if (depth >= maxDepth + 1) return [];
                          const childRelations = relations.filter((r: any) => r.to_model_id === modelId && !visited.has(r.from_model_id));
                          return childRelations.map((r: any) => {
                            const childModel = models.find((m: any) => m.id === r.from_model_id);
                            if (!childModel) return null;
                            const newVisited = new Set(visited);
                            newVisited.add(r.from_model_id);
                            return { ...childModel, children: buildTree(childModel.id, depth + 1, newVisited) };
                          }).filter(Boolean);
                        };
                        
                        const localFormTree = rootModel ? [{ ...rootModel, children: buildTree(rootId, 1, new Set([rootId])) }] : [];
                        
                        const modelHasFields = (node: any, isMaster: boolean = false) => {
                          const formFields = config.layout_config?.form_fields || [];
                          const fieldsOfThisModel = formFields.filter((fid: string) => {
                            if (fid.startsWith('virt_')) {
                              const meta = (config.layout_config?.fields_metadata || {})[fid] || {};
                              return meta.virtual_model_id === node.id || (!meta.virtual_model_id && isMaster);
                            }
                            return node.fields?.some((f: any) => f.id === fid);
                          });
                          return fieldsOfThisModel.length > 0;
                        };

                        const traverseTree = (nodes: any[], currentDepth: number) => {
                          nodes.forEach((node: any) => {
                            if (currentDepth > 0) {
                              const isUsed = modelHasFields(node, false);
                              if (isUsed) {
                                const typeLabel = currentDepth === 1 ? 'Aba Detalhe' : 'Aba Sub-Detalhe';
                                const customTitle = (config.layout_config as any).details_tab_titles?.[node.id];
                                const nodeLabel = customTitle || node.display_name || node.db_table_name || node.name;
                                locs.push({ id: `detail:${node.id}`, label: `${typeLabel} (${nodeLabel})`, modelId: node.id, depth: currentDepth });
                              }
                            }
                            if (node.children && Array.isArray(node.children)) {
                              traverseTree(node.children, currentDepth + 1);
                            }
                          });
                        };
                        traverseTree(localFormTree, 0);
                      }

                      if (config.logic_type === 'personalizado') {
                        (config.layout_config.custom_slots || []).forEach((slot: any) => {
                          const slotUc = useCases?.find((uc: any) => uc.slug === slot.use_case_slug);
                          locs.push({ id: `slot:${slot.id}`, label: `Aba ${slot.title} (${slotUc?.name || 'Desconhecido'})`, modelId: slotUc?.model_id || '', depth: 0 });
                        });
                      }
                      return locs;
                    })();

                    const placements = editingAction.placements || [];

                    const toggleContext = (locId: string, ctx: string) => {
                      const currentPlacements = [...placements];
                      const pIndex = currentPlacements.findIndex(p => p.location === locId);
                      if (pIndex > -1) {
                        const p = { ...currentPlacements[pIndex], contexts: [...currentPlacements[pIndex].contexts] };
                        if (p.contexts.includes(ctx)) {
                          p.contexts = p.contexts.filter((c: string) => c !== ctx);
                          if (p.contexts.length === 0) {
                            currentPlacements.splice(pIndex, 1);
                          } else {
                            currentPlacements[pIndex] = p;
                          }
                        } else {
                          p.contexts.push(ctx);
                          currentPlacements[pIndex] = p;
                        }
                      } else {
                        currentPlacements.push({ location: locId, contexts: [ctx], group_fields: [] });
                      }
                      setEditingAction({ ...editingAction, placements: currentPlacements });
                    };

                    const toggleGroupField = (locId: string, field: string) => {
                      const currentPlacements = [...placements];
                      const pIndex = currentPlacements.findIndex(p => p.location === locId);
                      if (pIndex > -1) {
                        const p = { ...currentPlacements[pIndex], group_fields: [...(currentPlacements[pIndex].group_fields || [])] };
                        if (p.group_fields.includes(field)) {
                          p.group_fields = p.group_fields.filter((f: string) => f !== field);
                        } else {
                          p.group_fields.push(field);
                        }
                        currentPlacements[pIndex] = p;
                        setEditingAction({ ...editingAction, placements: currentPlacements });
                      }
                    };

                    return (
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">
                          Locais de RenderizaÃ§Ã£o <span className="normal-case font-normal">(SeleÃ§Ã£o MÃºltipla)</span>
                        </label>
                        <div className="space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2 pb-2">
                          {availableLocations.map(loc => {
                            const p = placements.find((pl: any) => pl.location === loc.id);
                            const isActive = !!p && p.contexts.length > 0;
                            const isSearch = loc.id === 'search';
                            
                            const renderOptions = [];
                            if (isSearch) {
                              renderOptions.push({ value: 'global_top', label: 'AÃ§Ã£o Global (Topo da Pesquisa)' });
                              renderOptions.push({ value: 'row', label: 'AÃ§Ã£o de Linha (Grid)' });
                              renderOptions.push({ value: 'bulk', label: 'AÃ§Ã£o em Massa (Multi-seleÃ§Ã£o)' });
                            } else {
                              renderOptions.push({ value: 'global_top', label: 'AÃ§Ã£o Global (Topo)' });
                              if (loc.id !== 'master') {
                                renderOptions.push({ value: 'row', label: 'AÃ§Ã£o de Linha (Grid/Lista)' });
                              }
                              renderOptions.push({ value: 'field_group', label: 'Agrupado ao Campo' });
                            }

                            return (
                              <div key={loc.id} style={{ marginLeft: loc.depth ? `${loc.depth * 1.5}rem` : '0' }} className={cn("border rounded-xl transition-all overflow-hidden relative", isActive ? "border-indigo-500 shadow-md ring-1 ring-indigo-500/20" : "border-neutral-200 dark:border-neutral-800")}>
                                {loc.depth > 0 && (
                                  <div className={cn("absolute top-0 left-0 bottom-0 w-1", loc.depth === 1 ? "bg-amber-500 dark:bg-amber-700" : "bg-amber-400 dark:bg-amber-600")}></div>
                                )}
                                <div className={cn("p-3 flex items-center gap-3 bg-neutral-50 dark:bg-neutral-900")}>
                                  <div className="flex-1 flex items-center gap-2">
                                    <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-indigo-500" : "bg-neutral-300 dark:bg-neutral-700")} />
                                    <span className={cn("text-xs font-bold", isActive ? "text-indigo-700 dark:text-indigo-400" : "text-neutral-600 dark:text-neutral-400")}>{loc.label}</span>
                                  </div>
                                </div>
                                <div className="p-3 bg-white dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                                  <div className="grid grid-cols-1 gap-1.5">
                                    {renderOptions.map(opt => {
                                      const isChecked = p ? p.contexts.includes(opt.value) : false;
                                      return (
                                        <label key={opt.value} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800">
                                          <div
                                            onClick={(e) => { e.preventDefault(); toggleContext(loc.id, opt.value); }}
                                            className={cn(`w-4 h-4 rounded border-2 flex items-center justify-center transition-all cursor-pointer flex-shrink-0`, isChecked ? 'bg-indigo-600 border-indigo-600' : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900')}
                                          >
                                            {isChecked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                          </div>
                                          <span className={cn("text-xs font-semibold", isChecked ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400")}>{opt.label}</span>
                                        </label>
                                      );
                                    })}
                                  </div>

                                  {p?.contexts.includes('field_group') && (
                                    <div className="p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded-xl space-y-3 mt-2 animate-in fade-in slide-in-from-top-2">
                                      <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-[0.1em] text-indigo-500">Campos Alvo</label>
                                        <div className="max-h-40 overflow-y-auto custom-scrollbar border border-indigo-100 dark:border-indigo-900/30 rounded-lg bg-white dark:bg-neutral-950 p-2 space-y-1">
                                          {(() => {
                                            const targetModel = models.find((m: any) => m.id === loc.modelId);
                                            if (!targetModel || !targetModel.fields || targetModel.fields.length === 0) {
                                              return <p className="text-[10px] text-neutral-400 italic p-2">Nenhum campo encontrado no model.</p>;
                                            }
                                            return targetModel.fields.map((f: any) => {
                                              const val = f.db_column_name;
                                              const isChecked = p.group_fields?.includes(val) || false;
                                              return (
                                                <label key={f.id} className="flex items-center gap-2 cursor-pointer group p-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-md">
                                                  <input type="checkbox" checked={isChecked} onChange={() => toggleGroupField(loc.id, val)} className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900" />
                                                  <span className="text-xs text-neutral-700 dark:text-neutral-300 group-hover:text-indigo-600 transition-colors truncate">{f.display_name || f.db_column_name}</span>
                                                </label>
                                              );
                                            });
                                          })()}
                                        </div>
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-[0.1em] text-indigo-500">PosiÃ§Ã£o no Input</label>
                                        <div className="flex gap-2">
                                          <button type="button" onClick={() => setEditingAction({ ...editingAction, group_position: 'left' })} className={cn("flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-md transition-all border", (editingAction.group_position || 'right') === 'left' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50')}>Esquerda</button>
                                          <button type="button" onClick={() => setEditingAction({ ...editingAction, group_position: 'right' })} className={cn("flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded-md transition-all border", (editingAction.group_position || 'right') === 'right' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50')}>Direita</button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Trigger Tab */}
            {activeModalTab === 'trigger' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.trigger_type')}</label>
                  <div className="flex p-1 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setEditingAction({ ...editingAction, trigger_type: 'sql' })}
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'sql' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
                    >
                      {t('wizard.actions.sql_procedure')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAction({ ...editingAction, trigger_type: 'usecase' })}
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'usecase' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
                    >
                      {t('wizard.actions.trigger_usecase')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAction({ ...editingAction, trigger_type: 'rest' })}
                      className={cn("flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", editingAction.trigger_type === 'rest' ? 'bg-white dark:bg-neutral-800 shadow text-indigo-600' : 'text-neutral-500')}
                    >
                      {t('wizard.actions.trigger_rest')}
                    </button>
                  </div>
                </div>

                {editingAction.trigger_type === 'sql' && (
                  <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.sql_command')}</label>
                    <p className="text-[9px] text-neutral-500 ml-1 mb-2">{t('wizard.actions.sql_variables_hint', 'VocÃª pode usar variÃ¡veis usando chaves duplas: {{id}}')}</p>
                    <textarea
                      value={editingAction.sql_query}
                      onChange={e => setEditingAction({ ...editingAction, sql_query: e.target.value })}
                      className="w-full h-32 bg-neutral-950 text-indigo-400 font-mono text-sm p-4 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                      placeholder="CALL sp_aprovar_pedido({{id}});"
                    />
                  </div>
                )}

                {editingAction.trigger_type === 'usecase' && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.target_usecase')}</label>
                        <select
                          value={editingAction.usecase_slug}
                          onChange={e => setEditingAction({ ...editingAction, usecase_slug: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                        >
                          <option value="">{t('wizard.actions.select_usecase')}</option>
                          {isDownloadsActive && <option value="downloads">ðŸ“ Central de Downloads</option>}
                          {useCases?.filter((uc: any) => uc.slug !== config.slug).map((uc: any) => (
                            <option key={uc.slug} value={uc.slug}>{uc.name} ({uc.slug})</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.open_mode', 'Modo de Abertura')}</label>
                        <select
                          value={editingAction.usecase_open_mode || 'page'}
                          onChange={e => setEditingAction({ ...editingAction, usecase_open_mode: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                        >
                          <option value="page">{t('wizard.actions.open_modes.page', 'Mesma Tela (NavegaÃ§Ã£o PadrÃ£o)')}</option>
                          <option value="modal">{t('wizard.actions.open_modes.modal', 'Modal (Centralizado)')}</option>
                          <option value="drawer">{t('wizard.actions.open_modes.drawer', 'Drawer (Lateral)')}</option>
                        </select>
                      </div>
                    </div>

                    {editingAction.usecase_open_mode === 'modal' && (
                      <div className="space-y-4 mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 ml-1">Tamanho da Modal</label>
                          <select
                            value={editingAction.usecase_modal_size || 'md'}
                            onChange={e => setEditingAction({ ...editingAction, usecase_modal_size: e.target.value })}
                            className="w-full bg-white dark:bg-neutral-955 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                          >
                            <option value="sm">Pequeno (max. 384px)</option>
                            <option value="md">MÃ©dio (max. 672px) - PadrÃ£o</option>
                            <option value="lg">Grande (max. 896px)</option>
                            <option value="full">Tela Cheia (95% da tela)</option>
                            <option value="custom">Personalizado (em pixels ou %)</option>
                          </select>
                        </div>

                        {editingAction.usecase_modal_size === 'custom' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 ml-1">Largura</label>
                              <input
                                type="text"
                                value={editingAction.usecase_modal_width || ''}
                                onChange={e => setEditingAction({ ...editingAction, usecase_modal_width: e.target.value })}
                                placeholder="ex: 800, 800px, 90vw..."
                                className="w-full bg-white dark:bg-neutral-955 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 ml-1">Altura</label>
                              <input
                                type="text"
                                value={editingAction.usecase_modal_height || ''}
                                onChange={e => setEditingAction({ ...editingAction, usecase_modal_height: e.target.value })}
                                placeholder="ex: 600, 600px, 80vh..."
                                className="w-full bg-white dark:bg-neutral-955 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.fields_as_params', 'Mapeamento de ParÃ¢metros (De : Para)')}</label>
                        <div className="space-y-2 p-4 bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl">

                          {/* Table Header */}
                          <div className="flex gap-4 px-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                            <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                              Origem {(() => {
                                const sourceModels = models?.filter((m: any) => config.selected_models?.includes(m.id)) || []
                                return sourceModels[0] ? `(Tabela: ${sourceModels[0].db_table_name})` : ''
                              })()}
                            </div>
                            <div className="flex-1 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                              Destino {(() => {
                                const destUsecase = useCases?.find((uc: any) => uc.slug === editingAction.usecase_slug)
                                const destConfig = destUsecase?.draft_config || destUsecase?.config || {}
                                const destModelIds = destUsecase?.model_id ? [destUsecase.model_id] : (destConfig.selected_models || [])
                                const destModels = models?.filter((m: any) => destModelIds.includes(m.id)) || []
                                return destModels[0] ? `(Tabela: ${destModels[0].db_table_name})` : ''
                              })()}
                            </div>
                            <div className="w-8"></div>
                          </div>

                          {/* Rows */}
                          {(() => {
                            const rawMappings = editingAction.usecase_selected_fields || []
                            const normalizedMappings = rawMappings.map((f: any) => {
                              if (typeof f === 'string') return { source: f, target: f }
                              return f
                            })

                            const sourceModels = models?.filter((m: any) => config.selected_models?.includes(m.id)) || []
                            const destUsecase = useCases?.find((uc: any) => uc.slug === editingAction.usecase_slug)
                            const destConfig = destUsecase?.draft_config || destUsecase?.config || {}
                            const destModelIds = destUsecase?.model_id ? [destUsecase.model_id] : (destConfig.selected_models || [])
                            const destModels = models?.filter((m: any) => destModelIds.includes(m.id)) || []

                            const maxRelDepth = config.layout_config?.max_relation_depth || 2;
                            const sourceGroups = getModelsWithRelations(sourceModels, relations, models, maxRelDepth);
                            const destGroups = getModelsWithRelations(destModels, relations, models, maxRelDepth);

                            return (
                              <>
                                {normalizedMappings.map((mapping: any, index: number) => (
                                  <div key={index} className="flex gap-4 items-center animate-in fade-in slide-in-from-top-2">
                                    <select
                                      value={mapping.source || ''}
                                      onChange={(e) => {
                                        const next = [...normalizedMappings]
                                        next[index] = { ...next[index], source: e.target.value }
                                        setEditingAction({ ...editingAction, usecase_selected_fields: next })
                                      }}
                                      className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
                                    >
                                      <option value="">Selecione para inserir...</option>
                                      {sourceGroups.map((g: any, i: number) => (
                                        <optgroup key={i} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                                          {g.model.fields?.map((f: any) => (
                                            <option key={f.id} value={`${g.prefix}${f.db_column_name}`} className="text-neutral-800 dark:text-neutral-200 normal-case">
                                              {String(f.db_column_name).toLowerCase()}
                                            </option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>

                                    <select
                                      value={mapping.target || ''}
                                      onChange={(e) => {
                                        const next = [...normalizedMappings]
                                        next[index] = { ...next[index], target: e.target.value }
                                        setEditingAction({ ...editingAction, usecase_selected_fields: next })
                                      }}
                                      className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-rose-500"
                                    >
                                      <option value="">Selecione para inserir...</option>
                                      {destGroups.map((g: any, i: number) => (
                                        <optgroup key={i} label={g.label} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 normal-case">
                                          {g.model.fields?.map((f: any) => (
                                            <option key={f.id} value={`${g.prefix}${f.db_column_name}`} className="text-neutral-800 dark:text-neutral-200 normal-case">
                                              {String(f.db_column_name).toLowerCase()}
                                            </option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = normalizedMappings.filter((_: any, i: number) => i !== index)
                                        setEditingAction({ ...editingAction, usecase_selected_fields: next })
                                      }}
                                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 text-neutral-400 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAction({
                                      ...editingAction,
                                      usecase_selected_fields: [...normalizedMappings, { source: '', target: '' }]
                                    })
                                  }}
                                  className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Adicionar ParÃ¢metro
                                </button>
                              </>
                            )
                          })()}

                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.additional_params', 'ParÃ¢metros Adicionais Fixos (Filtros na URL)')}</label>
                        <p className="text-[9px] text-neutral-500 ml-1 mb-2">{t('wizard.actions.additional_params_hint', 'Ex: status=ativo&tipo=1')}</p>
                        <input
                          type="text"
                          value={editingAction.usecase_params}
                          onChange={e => setEditingAction({ ...editingAction, usecase_params: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono focus:border-indigo-500 outline-none transition-all"
                          placeholder="status=ativo"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editingAction.trigger_type === 'rest' && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300 bg-neutral-50 dark:bg-neutral-900/50 p-4 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <div className="flex gap-4">
                      <div className="space-y-2 w-1/3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.method', 'MÃ©todo')}</label>
                        <select
                          value={editingAction.rest_method}
                          onChange={e => setEditingAction({ ...editingAction, rest_method: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div className="space-y-2 flex-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.api_url', 'URL da API / Webhook')}</label>
                        <input
                          type="text"
                          value={editingAction.rest_url}
                          onChange={e => setEditingAction({ ...editingAction, rest_url: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-955 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-mono focus:border-indigo-500 outline-none transition-all"
                          placeholder="https://api.exemplo.com/hook/{{id}}"
                        />
                      </div>
                    </div>
                    {['POST', 'PUT', 'PATCH'].includes(editingAction.rest_method) && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.api_body', 'Body (JSON Payload)')}</label>
                        <textarea
                          value={editingAction.rest_body}
                          onChange={e => setEditingAction({ ...editingAction, rest_body: e.target.value })}
                          className="w-full h-32 bg-neutral-955 text-indigo-400 font-mono text-xs p-4 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          placeholder={'{\n  "id": "{{id}}",\n  "status": "aprovado"\n}'}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* BPM / AutomaÃ§Ã£o Tab */}
            {activeModalTab === 'bpm' && (
              <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Workflow className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 mb-1">{t('wizard.actions.bpm_integration_title', 'IntegraÃ§Ã£o com BPM')}</h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                        {t('wizard.actions.bpm_integration_desc', 'Selecione quais fluxos automatizados (BPM) serÃ£o disparados quando o usuÃ¡rio clicar neste botÃ£o. VocÃª tambÃ©m pode configurar esta ligaÃ§Ã£o diretamente na tela de AutomaÃ§Ãµes.')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">{t('wizard.actions.available_workflows', 'Workflows DisponÃ­veis')}</label>
                    <div className="grid grid-cols-1 gap-2 p-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                      {bpmWorkflows.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-xs text-neutral-500">{t('wizard.actions.no_workflows', 'Nenhum fluxo de automaÃ§Ã£o criado neste projeto.')}</p>
                          <Link href={`/admin/${workspace_slug}/${project_slug}/automations`} target="_blank" className="text-xs text-emerald-600 hover:underline font-bold mt-2 inline-block">
                            {t('wizard.actions.create_first_flow', 'Criar Primeiro Fluxo')}
                          </Link>
                        </div>
                      ) : (
                        bpmWorkflows.map((workflow: any) => {
                          const linkedWorkflows = editingAction.linked_bpm_workflows || [];
                          const isChecked = linkedWorkflows.includes(workflow.id);
                          return (
                            <label key={workflow.id} className={cn(
                              "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2",
                              isChecked
                                ? "bg-white dark:bg-neutral-800 border-emerald-500 shadow-sm"
                                : "bg-white dark:bg-neutral-800 border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
                            )}>
                              <div className={cn(
                                "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all",
                                isChecked ? "bg-emerald-500 text-white" : "border-2 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                              )}>
                                {isChecked && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm font-bold truncate transition-colors", isChecked ? "text-emerald-700 dark:text-emerald-400" : "text-neutral-700 dark:text-neutral-300")}>
                                  {workflow.name}
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...linkedWorkflows, workflow.id]
                                    : linkedWorkflows.filter((id: string) => id !== workflow.id);
                                  setEditingAction({ ...editingAction, linked_bpm_workflows: next });
                                }}
                              />
                            </label>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800 mt-6">
              <button type="button" onClick={() => setIsActionModalOpen(false)} className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all">{t('common.cancel', 'Cancelar')}</button>
              <button type="button" onClick={() => handleSaveAction(editingAction)} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">{t('wizard.actions.save_action', 'Salvar AÃ§Ã£o')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Button Properties Modal */}
      <Modal
        isOpen={isButtonPropertiesOpen}
        onClose={() => setIsButtonPropertiesOpen(false)}
        title={`Propriedades do BotÃ£o: ${selectedButtonConfig ? (selectedButtonConfig.id === 'search' ? 'Pesquisar' : selectedButtonConfig.id === 'clear' ? 'Limpar' : selectedButtonConfig.id === 'view' ? 'Visualizar' : selectedButtonConfig.id === 'add' ? 'Novo Registro' : selectedButtonConfig.id === 'edit' ? 'Editar' : selectedButtonConfig.id === 'delete' ? 'Excluir' : selectedButtonConfig.label) : ''}`}
        size="md"
      >
        {selectedButtonConfig && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Texto de ExibiÃ§Ã£o</label>
              <input
                type="text"
                value={selectedButtonConfig.custom_label}
                onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, custom_label: e.target.value })}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                placeholder={t(selectedButtonConfig.labelKey) || selectedButtonConfig.label}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Fonte</label>
                <select
                  value={selectedButtonConfig.font_family}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, font_family: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                >
                  <option value="Inter">Inter (PadrÃ£o)</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Outfit">Outfit</option>
                  <option value="JetBrains Mono">Mono (JetBrains)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Tamanho</label>
                <input
                  type="text"
                  value={selectedButtonConfig.font_size}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, font_size: e.target.value })}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
                  placeholder="Ex: 10px"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">TransformaÃ§Ã£o do Texto</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'none', label: 'Normal', example: 'Aa' },
                  { value: 'uppercase', label: 'UPPER', example: 'AA' },
                  { value: 'capitalize', label: 'Iniciais', example: 'Aa' },
                  { value: 'lowercase', label: 'lower', example: 'aa' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedButtonConfig({ ...selectedButtonConfig, text_transform: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all",
                      (selectedButtonConfig.text_transform || 'capitalize') === opt.value
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600"
                        : "border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-indigo-300"
                    )}
                  >
                    <span
                      className="text-base font-black"
                      style={{ textTransform: opt.value as any, fontStyle: opt.value === 'none' ? 'italic' : 'normal' }}
                    >
                      {opt.example}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-wider">{opt.label}</span>
                  </button>
                ))}
              </div>
              {/* Live preview */}
              <div className="mt-3 flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                <span
                  className="text-sm font-bold text-neutral-700 dark:text-neutral-300"
                  style={{
                    textTransform: ((selectedButtonConfig.text_transform || 'capitalize') !== 'none' ? selectedButtonConfig.text_transform : undefined) as any,
                    fontFamily: (selectedButtonConfig.font_family && selectedButtonConfig.font_family !== 'Inter (PadrÃ£o)') ? selectedButtonConfig.font_family : undefined,
                    fontSize: selectedButtonConfig.font_size || undefined,
                    color: selectedButtonConfig.text_color || undefined,
                    backgroundColor: selectedButtonConfig.bg_color || undefined,
                  }}
                >
                  {selectedButtonConfig.custom_label || 'Preview do BotÃ£o'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Cor do Texto</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={selectedButtonConfig.text_color || '#ffffff'}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, text_color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0 shrink-0"
                />
                <input
                  type="text"
                  value={selectedButtonConfig.text_color}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, text_color: e.target.value })}
                  placeholder="Hexadecimal da cor do texto (ex: #ffffff)"
                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 ml-1">Cor do BotÃ£o (Fundo)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={selectedButtonConfig.bg_color || '#6366f1'}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, bg_color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer overflow-hidden border-none p-0 shrink-0"
                />
                <input
                  type="text"
                  value={selectedButtonConfig.bg_color}
                  onChange={e => setSelectedButtonConfig({ ...selectedButtonConfig, bg_color: e.target.value })}
                  placeholder="Hexadecimal da cor de fundo (ex: #6366f1)"
                  className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800 mt-6">
              <button
                type="button"
                onClick={() => setIsButtonPropertiesOpen(false)}
                className="flex-1 px-4 py-3 bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 rounded-2xl font-black text-[10px] capitalize tracking-wider hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfig({
                    ...config,
                    buttons_config: config.buttons_config.map((b: any) =>
                      b.id === selectedButtonConfig.id ? selectedButtonConfig : b
                    )
                  });
                  setIsButtonPropertiesOpen(false);
                }}
                className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] capitalize tracking-wider hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </Modal>



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
  const { t } = useI18n()
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
        // Se estiver arrastando, nÃ£o ativa o toggle
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
          <span className="text-[8px] font-bold text-indigo-500/0 group-hover:text-indigo-500 transition-all uppercase tracking-widest leading-none mt-1">{t('wizard.layout.drag_to_add_all', 'Arraste para add tudo')}</span>
        </div>
      </div>
      <div className="p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-400 group-hover/header:text-indigo-500 group-hover/header:bg-indigo-50 dark:group-hover/header:bg-indigo-500/10 transition-all">
        {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </div>
    </div>
  )
}


