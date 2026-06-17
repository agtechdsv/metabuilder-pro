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
import { useCustomActionsState } from './hooks/useCustomActionsState';
import { ActionModalGeneralTab } from './ActionModalGeneralTab';
import { ActionModalTriggerTab } from './ActionModalTriggerTab';
import { useDraggable, useDroppable } from '@dnd-kit/core'

export function CustomActionsEditor({
  config, setConfig, models, useCases, bpmWorkflows, relations, getFieldName, t, isDownloadsActive
}: any) {
  const params = useParams()
  const { workspace_slug, project_slug } = params as { workspace_slug: string, project_slug: string }
  const {
    isActionModalOpen, setIsActionModalOpen,
    editingAction, setEditingAction,
    editingActionIndex, setEditingActionIndex,
    isIconPickerOpen, setIsIconPickerOpen,
    activeModalTab, setActiveModalTab,
    handleSaveAction,
    handleDeleteAction
  } = useCustomActionsState(config, setConfig);

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
              <ActionModalGeneralTab
                editingAction={editingAction}
                setEditingAction={setEditingAction}
                isIconPickerOpen={isIconPickerOpen}
                setIsIconPickerOpen={setIsIconPickerOpen}
                t={t}
                config={config}
                models={models}
                useCases={useCases}
                relations={relations}
              />
            )}
    
            {/* Trigger Tab */}
            
            {activeModalTab === 'trigger' && (
              <ActionModalTriggerTab
                editingAction={editingAction}
                setEditingAction={setEditingAction}
                t={t}
                config={config}
                models={models}
                useCases={useCases}
                relations={relations}
                isDownloadsActive={isDownloadsActive}
              />
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
