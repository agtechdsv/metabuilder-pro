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
import { CustomActionModal } from './CustomActionModal';
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



      <CustomActionModal
        isActionModalOpen={isActionModalOpen}
        setIsActionModalOpen={setIsActionModalOpen}
        editingAction={editingAction}
        setEditingAction={setEditingAction}
        activeModalTab={activeModalTab}
        setActiveModalTab={setActiveModalTab}
        isIconPickerOpen={isIconPickerOpen}
        setIsIconPickerOpen={setIsIconPickerOpen}
        handleSaveAction={handleSaveAction}
        bpmWorkflows={bpmWorkflows}
        workspace_slug={workspace_slug}
        project_slug={project_slug}
        config={config}
        models={models}
        useCases={useCases}
        relations={relations}
        t={t}
        isDownloadsActive={isDownloadsActive}
      />
    </>
  )
}
