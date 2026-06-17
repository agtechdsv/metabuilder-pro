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
import { SqlQuerySection } from './SqlQuerySection'
import { ButtonsConfig } from './ButtonsConfig'
import { IconPicker } from '../../../IconPicker'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { getModelsWithRelations } from '@/lib/relationPathFinder'
import { useDraggable, useDroppable } from '@dnd-kit/core'

export function CustomActionsEditor({
  config, setConfig, models, useCases, bpmWorkflows, relations, getFieldName, t, isDownloadsActive
}: any) {
  const params = useParams()
  const { workspace_slug, project_slug } = params as { workspace_slug: string, project_slug: string }
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

  return (
    <>
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
    </>
  )
}
