'use client'

import { useState, useEffect, useRef } from 'react'
import { evaluateFormula } from '@/lib/formulaEvaluator'
import { Loader2, Save, Eye, Pencil, Plus, Trash2, ArrowLeft, Check, ChevronDown, ChevronUp, Zap, Link, Database, Globe, Maximize2, PanelRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nContext'
import { createClient } from '@/utils/supabase/client'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { FileUploaderInput } from '@/components/runtime/FileUploaderInput'
import { getActionContexts, getActionGroupFields } from '@/lib/customActionsHelper'

import { useRecordFormLogic } from './hooks/useRecordFormLogic';
import { RecordFormField } from './record-form/RecordFormField';
import { RecordFormDetailSection } from './record-form/RecordFormDetailSection';
import { 
  getCaseInsensitiveValue, 
  getActionIcon, 
  getFontFamily, 
  getFontSize, 
  applyMask, 
  parseMaskedNumber, 
  getActionColorClasses, 
  getBulkActionClasses,
  parseFixedOptions
} from './record-form/RecordFormUtils';


export interface RecordFormProps {
  mode: 'create' | 'edit' | 'view';
  fields: any[];
  initialData?: any;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  logicType?: string;
  masterModelId?: string;
  masterModelName?: string;
  masterTabTitle?: string;
  detailsTabTitles?: Record<string, string>;
  detailsItemTitles?: Record<string, string>;
  tabsStyleConfig?: any;
  detailsDisplayMode?: Record<string, 'tabs' | 'sections'>;
  isPageMode?: boolean;
  onEditDetail?: (detail: any) => void;
  onDeleteDetail?: (detail: any) => void;
  onAddDetail?: (tableName: string, parentId?: any) => void;
  joins?: any[];
  dictionary?: Record<string, string>;
  initialTab?: string;
  onTabChange?: (tab: string) => void;
  customActions?: any[];
  onCustomAction?: (action: any, row?: any) => void;
  detailsInlineTypes?: Record<string, boolean>;
  detailsInterfaceTypes?: Record<string, string>;
  footerBgClass?: string;
  projectId?: string;
  secretToken?: string;
  tunnelChannel?: any;
  isTunnelReady?: boolean;
  project?: any;
  refreshTrigger?: number;
  renderOnlyDetail?: string;
  hideHeader?: boolean;
  formHeaderTitle?: string;
  formHeaderSubtitleField?: string;
  projectRelations?: any[];
}

export default function RecordForm({
  mode,
  fields,
  initialData,
  onSave,
  onCancel,
  isLoading = false,
  logicType,
  masterModelId,
  masterModelName,
  detailsDisplayMode = {},
  tabsStyleConfig,
  isPageMode = false,
  onEditDetail,
  onDeleteDetail,
  onAddDetail,
  joins = [],
  dictionary = {},
  initialTab = 'master',
  onTabChange,
  customActions = [],
  onCustomAction,
  detailsInlineTypes = {},
  detailsInterfaceTypes = {},
  footerBgClass = "bg-white dark:bg-neutral-950",
  projectId,
  secretToken = 'test-token',
  tunnelChannel,
  isTunnelReady,
  project,
  masterTabTitle,
  detailsTabTitles,
  detailsItemTitles,
  refreshTrigger = 0,
  renderOnlyDetail,
  hideHeader = false,
  formHeaderTitle,
  formHeaderSubtitleField,
  projectRelations = []
}: RecordFormProps) {
  const { t } = useI18n()
  const {
    formData, setFormData,
    activeTab, setActiveTab,
    formRef,
    relationalOptions,
    expandedDetails, setExpandedDetails,
    loadingSubDetails, setLoadingSubDetails,
    currentMasterId,
    masterFields,
    detailFields,
    detailTables,
    handleSubmit,
    fetchSubDetailsForRecord,
    handleCancel
  } = useRecordFormLogic({
    mode, fields, initialData, onSave, onCancel, logicType, masterModelId, masterModelName,
    joins, initialTab, detailsItemTitles, projectId, secretToken,
    tunnelChannel, isTunnelReady, project, refreshTrigger
  });

  const titles = {
    create: t('runtime.new_record'),
    edit: t('dashboard.projects.studio.config.configure_view'),
    view: t('runtime.view')
  }

  const icons = {
    create: <Plus className="w-5 h-5 text-indigo-500" />,
    edit: <Pencil className="w-5 h-5 text-indigo-500" />,
    view: <Eye className="w-5 h-5 text-indigo-500" />
  }

  const buildActionContext = (masterData: any, parentData?: any, parentTableName?: string, detailData?: any, detailTableName?: string) => {
    // Base object starts with master data so root fields (e.g. "id") map to the master record.
    const ctx = { ...masterData };
    
    const mainModelName = masterModelName || project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;
    
    // Add explicitly prefixed master fields (e.g. "clientes.id")
    if (mainModelName && masterData) {
      Object.keys(masterData).forEach(k => {
        if (!k.startsWith('_')) {
          ctx[`${mainModelName}.${k}`] = masterData[k];
        }
      });
    }

    // Add prefixed parent fields (e.g. "projetos.id")
    if (parentTableName && parentData) {
      Object.keys(parentData).forEach(k => {
        if (!k.startsWith('_')) {
          ctx[`${parentTableName}.${k}`] = parentData[k];
        }
      });
    }

    // Add prefixed detail row fields (e.g. "tarefas.id")
    if (detailTableName && detailData) {
      Object.keys(detailData).forEach(k => {
        if (!k.startsWith('_')) {
          ctx[`${detailTableName}.${k}`] = detailData[k];
        }
      });
    }

    return ctx;
  };



  return (
    <div className={cn("flex flex-col", isPageMode ? "bg-white dark:bg-neutral-900/50 p-8 rounded-[2rem] border border-neutral-200 dark:border-neutral-800 shadow-xl" : "h-full")}>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              {(icons as any)[mode]}
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                {formHeaderTitle && formHeaderTitle.trim() !== '' ? formHeaderTitle : (titles as any)[mode]}
              </h3>
              <p className="text-[10px] font-black tracking-[0.2em] text-neutral-400">
                {mode === 'create' ? t('runtime.record_drawer.new_item') : 
                  (formHeaderSubtitleField && initialData?.[formHeaderSubtitleField] 
                    ? String(initialData[formHeaderSubtitleField]) 
                    : t('runtime.record_drawer.record_id').replace('{id}', initialData?.id || 'N/A'))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {customActions.filter((a: any) => getActionContexts(a, 'master').includes('global_top')).map((action: any) => (
              <button
                key={action.id}
                onClick={() => onCustomAction?.(action, buildActionContext(formData))}
                type="button"
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs capitalize tracking-wider transition-all shadow-lg",
                  getBulkActionClasses(action.color)
                )}
              >
                {getActionIcon(action.icon)}
                {action.label}
              </button>
            ))}

            {isPageMode && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all"
              >
                <ArrowLeft className="w-4 h-4" /> {t('runtime.back_to_list', 'Voltar para Lista')}
              </button>
            )}
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex-1 flex flex-col">
        {/* Formulário Principal e Abas Híbridas */}
        <div className={cn("flex flex-col h-full", !isPageMode && "overflow-hidden")}>
          {(() => {
            const getModelIdForTable = (tableName: string) => {
              const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase());
              return targetModel?.id || fields.find((f: any) => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id;
            };
            const tabTables = detailTables.filter(tableName => detailsDisplayMode?.[getModelIdForTable(tableName) as string] === 'tabs');
            const sectionTables = detailTables.filter(tableName => detailsDisplayMode?.[getModelIdForTable(tableName) as string] !== 'tabs');

            return (
              <>
                {!renderOnlyDetail && tabTables.length > 0 && (
                  <div className="flex items-end mb-2 border-b border-neutral-100 dark:border-neutral-800">
                    {/* Abas (scroll horizontal) */}
                    <div className="flex items-center gap-1 overflow-x-auto flex-1 custom-scrollbar">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setActiveTab('master')
                          onTabChange?.('master')
                        }}
                        style={{
                          fontFamily: getFontFamily(tabsStyleConfig?.label?.font),
                          fontSize: getFontSize(tabsStyleConfig?.label?.size),
                          ...(activeTab === 'master' && tabsStyleConfig?.label?.color ? { color: tabsStyleConfig.label.color, borderColor: tabsStyleConfig.label.color } : {})
                        }}
                        className={cn(
                          "px-4 py-2 text-[10px] font-black tracking-widest transition-all border-b-2 whitespace-nowrap",
                          !tabsStyleConfig?.label?.color && activeTab === 'master' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                        )}
                      >
                        {masterTabTitle || t('runtime.master_details.main_data', 'Dados Principais')}
                      </button>
                      {tabTables.map(tableName => {
                        const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase());
                        const modelId = targetModel?.id || getModelIdForTable(tableName);
                        const title = detailsTabTitles?.[modelId || ''] || dictionary[modelId || ''] || targetModel?.display_name || fields.find((f: any) => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.display_model_name || tableName;
                        return (
                          <button
                            key={tableName}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setActiveTab(tableName as string)
                              onTabChange?.(tableName)
                            }}
                            style={{
                              fontFamily: getFontFamily(tabsStyleConfig?.label?.font),
                              fontSize: getFontSize(tabsStyleConfig?.label?.size),
                              ...(String(activeTab) === String(tableName) && tabsStyleConfig?.label?.color ? { color: tabsStyleConfig.label.color, borderColor: tabsStyleConfig.label.color } : {})
                            }}
                            className={cn(
                              "px-4 py-2 text-[10px] font-black tracking-widest transition-all border-b-2 whitespace-nowrap",
                              !tabsStyleConfig?.label?.color && String(activeTab) === String(tableName) ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                            )}
                          >
                            {title}
                          </button>
                        );
                      })}
                    </div>

                    {/* Botões de acao alinhados na mesma linha das abas */}
                    {activeTab !== 'master' && (() => {
                      const activeModelId = getModelIdForTable(activeTab);
                      return (
                        <div className="flex items-center gap-1 pb-2 flex-shrink-0 pl-2">
                          {customActions.filter((a: any) => getActionContexts(a, 'detail:' + activeModelId).includes('global_top')).map((action: any) => {
                            const colors = getActionColorClasses(action.color)
                            return (
                              <button
                                key={action.id}
                                type="button"
                                onClick={() => onCustomAction?.(action, buildActionContext(formData))}
                                className={cn(
                                  "p-1.5 rounded-lg border transition-all shadow-sm bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
                                  colors.text,
                                  colors.hover
                                )}
                                title={action.label}
                              >
                                {getActionIcon(action.icon, "w-4 h-4")}
                              </button>
                            )
                          })}

                          {(formData?._details || []).some((d: any) => d.model_name?.toLowerCase() === String(activeTab)?.toLowerCase()) && (
                            <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                              <button
                                type="button"
                                onClick={async () => {
                                  const currentDetails = (formData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === String(activeTab)?.toLowerCase())
                                  const pkField = fields.filter((f: any) => f.model_name?.toLowerCase() === String(activeTab)?.toLowerCase()).find((f: any) => f.is_primary_key) || { db_column_name: 'id' }
                                  const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                                  const newState = { ...expandedDetails }
                                  currentDetails.forEach((d: any, idx: number) => {
                                    const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                                    newState[`detail-${activeTab}-${dPk}`] = true
                                  })
                                  setExpandedDetails(newState)
                                  const fetches = currentDetails.filter((d: any) => !d._details || d._details.length === 0).map((d: any, idx: number) => {
                                    const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                                    const key = `detail-${activeTab}-${dPk}`
                                    if (!loadingSubDetails[key]) {
                                      setLoadingSubDetails(prev => ({ ...prev, [key]: true }))
                                      return fetchSubDetailsForRecord(d, activeTab, pkCol, dPk).finally(() => setLoadingSubDetails(prev => ({ ...prev, [key]: false })))
                                    }
                                    return Promise.resolve()
                                  })
                                  await Promise.all(fetches)
                                }}
                                title={t('common.expand_all', 'Expandir Tudo')}
                                className="p-1 hover:bg-white dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-indigo-600 transition-all"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentDetails = (formData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === String(activeTab)?.toLowerCase())
                                  const pkField = fields.filter((f: any) => f.model_name?.toLowerCase() === String(activeTab)?.toLowerCase()).find((f: any) => f.is_primary_key) || { db_column_name: 'id' }
                                  const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                                  const newState = { ...expandedDetails }
                                  currentDetails.forEach((d: any, idx: number) => {
                                    const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                                    newState[`detail-${activeTab}-${dPk}`] = false
                                  })
                                  setExpandedDetails(newState)
                                }}
                                title={t('common.collapse_all', 'Recolher Tudo')}
                                className="p-1 hover:bg-white dark:hover:bg-neutral-800 rounded text-neutral-400 hover:text-indigo-600 transition-all"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (true) {
                                const newTempId = `temp-${Date.now()}`
                                setFormData((prev: any) => ({ ...prev, _details: [...(prev._details || []), { id: newTempId, model_name: activeTab, _isNew: true }] }))
                                setExpandedDetails((prev: any) => ({ ...prev, [`detail-${activeTab}-${newTempId}`]: true }))
                                
                                // Foco no primeiro campo do novo item
                                setTimeout(() => {
                                  const container = document.getElementById(`detail-container-detail-${activeTab}-${newTempId}`)
                                  if (container) {
                                    const firstInput = container.querySelector('input:not([type="hidden"]), select, textarea') as HTMLElement
                                    if (firstInput) firstInput.focus()
                                  }
                                }, 150)
                              }
                            }}
                            className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm"
                            title={t('common.add_record', 'Adicionar')}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          {true && (
                            <button
                              type="button"
                              onClick={() => onAddDetail?.(activeTab, formData.id || formData.ID)}
                              title={detailsInterfaceTypes[activeModelId || ''] === 'drawer' ? t('common.open_drawer', 'Abrir Gaveta') : t('common.open_modal', 'Abrir Modal')}
                              className="p-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                            >
                              {detailsInterfaceTypes[activeModelId || ''] === 'drawer' ? <PanelRight className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className={cn("flex-1 space-y-12", isPageMode ? "" : "overflow-y-auto custom-scrollbar pr-2")}>
                  {!renderOnlyDetail && activeTab === 'master' && (
                    <div className="space-y-6">
                      {sectionTables.length > 0 && tabTables.length > 0 && (
                        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                          <h3 className="text-[10px] font-black tracking-[0.2em] text-neutral-800 dark:text-neutral-200">
                            {masterTabTitle || t('runtime.master_details.main_data', 'Dados Principais')}
                          </h3>
                        </div>
                      )}
                      <div className="grid gap-6 grid-cols-1 md:grid-cols-12">
                        {(() => {
                          const seenFields = new Set();
                          return masterFields.map(field => {
                            if (seenFields.has(field.id)) return null;
                            seenFields.add(field.id);
                            
                            const zoneConfig = field.config?.form_config || field.config || {};
                            const gridSpan = parseInt(isPageMode ? (zoneConfig.component?.gridSpan || 12) : (zoneConfig.component?.modalGridSpan || zoneConfig.component?.gridSpan || 12)) || 12;
                            const colSpanClass = {
                              1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4',
                              5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8',
                              9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12'
                            }[gridSpan] || 'md:col-span-12';

                            return <div key={field.id} className={cn("col-span-1", colSpanClass)}><RecordFormField 
  field={field}
  formData={formData}
  setFormData={setFormData}
  mode={mode}
  relationalOptions={relationalOptions}
  customActions={customActions}
  onCustomAction={onCustomAction}
  buildActionContext={buildActionContext}
  project={project}
  masterModelId={masterModelId}
  masterModelName={masterModelName}
  logicType={logicType}
  isPageMode={isPageMode}
  t={t}
/></div>;
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {!renderOnlyDetail && activeTab === 'master' && sectionTables.length > 0 && sectionTables.map(tableName => {
                    const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase());
                    const sectionModelId = targetModel?.id || getModelIdForTable(tableName);
                    const sectionTitle = detailsTabTitles?.[sectionModelId || ''] || dictionary[sectionModelId || ''] || targetModel?.display_name || fields.find((f: any) => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.display_model_name || tableName;
                    return (
                      <div key={tableName} className="pt-6">
                        <RecordFormDetailSection 
    tableName={tableName} 
    parentData={formData} 
    titleNode={(
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                            <h3
                              style={{
                                fontFamily: getFontFamily(tabsStyleConfig?.label?.font),
                                fontSize: getFontSize(tabsStyleConfig?.label?.size),
                                ...(tabsStyleConfig?.label?.color ? { color: tabsStyleConfig.label.color } : {})
                              }}
                              className="text-[10px] font-black tracking-[0.2em] text-neutral-800 dark:text-neutral-200"
                            >
                              {sectionTitle}
                            </h3>
                          </div>
                        )} 
    expandedDetails={expandedDetails}
    setExpandedDetails={setExpandedDetails}
    loadingSubDetails={loadingSubDetails}
    setLoadingSubDetails={setLoadingSubDetails}
    fetchSubDetailsForRecord={fetchSubDetailsForRecord}
    formData={formData}
    setFormData={setFormData}
    fields={fields}
    joins={joins}
    detailFields={detailFields}
    customActions={customActions}
    onCustomAction={onCustomAction}
    relationalOptions={relationalOptions}
    project={project}
    detailsInterfaceTypes={detailsInterfaceTypes || {}}
    detailsTabTitles={detailsTabTitles}
    dictionary={dictionary}
    detailsItemTitles={detailsItemTitles}
    onAddDetail={onAddDetail}
    onEditDetail={onEditDetail}
    onDeleteDetail={onDeleteDetail}
    buildActionContext={buildActionContext}
    tabsStyleConfig={tabsStyleConfig}
    t={t}
    mode={mode}
  />
                      </div>
                    );
                  })}

                  {!renderOnlyDetail && tabTables.length > 0 && activeTab !== 'master' && (
                    <RecordFormDetailSection 
    tableName={activeTab} 
    parentData={formData} 
    hideToolbar={true} 
    expandedDetails={expandedDetails}
    setExpandedDetails={setExpandedDetails}
    loadingSubDetails={loadingSubDetails}
    setLoadingSubDetails={setLoadingSubDetails}
    fetchSubDetailsForRecord={fetchSubDetailsForRecord}
    formData={formData}
    setFormData={setFormData}
    fields={fields}
    joins={joins}
    detailFields={detailFields}
    customActions={customActions}
    onCustomAction={onCustomAction}
    relationalOptions={relationalOptions}
    project={project}
    detailsInterfaceTypes={detailsInterfaceTypes || {}}
    detailsTabTitles={detailsTabTitles}
    dictionary={dictionary}
    detailsItemTitles={detailsItemTitles}
    onAddDetail={onAddDetail}
    onEditDetail={onEditDetail}
    onDeleteDetail={onDeleteDetail}
    buildActionContext={buildActionContext}
    tabsStyleConfig={tabsStyleConfig}
    t={t}
    mode={mode}
  />
                  )}

                  {renderOnlyDetail && <RecordFormDetailSection 
    tableName={renderOnlyDetail} 
    parentData={formData} 
    expandedDetails={expandedDetails}
    setExpandedDetails={setExpandedDetails}
    loadingSubDetails={loadingSubDetails}
    setLoadingSubDetails={setLoadingSubDetails}
    fetchSubDetailsForRecord={fetchSubDetailsForRecord}
    formData={formData}
    setFormData={setFormData}
    fields={fields}
    joins={joins}
    detailFields={detailFields}
    customActions={customActions}
    onCustomAction={onCustomAction}
    relationalOptions={relationalOptions}
    project={project}
    detailsInterfaceTypes={detailsInterfaceTypes || {}}
    detailsTabTitles={detailsTabTitles}
    dictionary={dictionary}
    detailsItemTitles={detailsItemTitles}
    onAddDetail={onAddDetail}
    onEditDetail={onEditDetail}
    onDeleteDetail={onDeleteDetail}
    buildActionContext={buildActionContext}
    tabsStyleConfig={tabsStyleConfig}
    t={t}
    mode={mode}
    isPageMode={isPageMode}
  />}
                </div>
              </>
            );
          })()}
        </div>

        <div className={cn(
          "pt-8 mt-auto border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-3 sticky bottom-0",
          footerBgClass
        )}>
          {!(logicType === 'cadastro' && isPageMode) && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-3 rounded-xl text-xs font-bold capitalize tracking-wider text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              {mode === 'view' ? t('runtime.close') : t('common.cancel')}
            </button>
          )}

          {mode !== 'view' && (
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black capitalize tracking-wider transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isLoading ? t('runtime.saving') : t('common.save')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}


