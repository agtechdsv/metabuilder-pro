import React from 'react';
import { Loader2, Pencil, Plus, Trash2, ChevronDown, ChevronUp, PanelRight, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActionContexts } from '@/lib/customActionsHelper';
import { getActionIcon, getActionColorClasses, getFontFamily, getFontSize, applyMask, parseMaskedNumber, parseFixedOptions } from './RecordFormUtils';
import { RecordFormField } from './RecordFormField';
import { FileUploaderInput } from '@/components/runtime/FileUploaderInput';
import { useI18n } from '@/i18n/I18nContext';

interface RecordFormDetailSectionProps {
  tableName: string;
  parentData?: any;
  titleNode?: any;
  hideToolbar?: boolean;
  expandedDetails: any;
  setExpandedDetails: (val: any) => void;
  loadingSubDetails: any;
  setLoadingSubDetails: (val: any) => void;
  fetchSubDetailsForRecord: (record: any, table: string, pkCol: string, pkVal: any) => Promise<any>;
  formData: any;
  setFormData: (val: any) => void;
  fields: any[];
  joins: any[];
  detailFields: any[];
  customActions?: any[];
  onCustomAction?: (action: any, context?: any) => void;
  relationalOptions: Record<string, any[]>;
  project?: any;
  detailsInterfaceTypes?: Record<string, string>;
  detailsTabTitles?: Record<string, string>;
  dictionary?: Record<string, string>;
  detailsItemTitles?: Record<string, string>;
  onAddDetail?: (tableName: string, parentId?: any) => void;
  onEditDetail?: (detail: any) => void;
  onDeleteDetail?: (detail: any) => void;
  buildActionContext: (masterData: any, parentData?: any, parentTableName?: string, detailData?: any, detailTableName?: string) => any;
  tabsStyleConfig?: any;
  t: (key: string, defaultText?: string) => string;
  mode: 'create' | 'edit' | 'view';
  isPageMode?: boolean;
}

export function RecordFormDetailSection(props: RecordFormDetailSectionProps) {
  const { language } = useI18n();
  const dateLocale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';

  const {
    tableName,
    parentData = props.formData,
    titleNode,
    hideToolbar,
    expandedDetails,
    setExpandedDetails,
    loadingSubDetails,
    setLoadingSubDetails,
    fetchSubDetailsForRecord,
    formData,
    setFormData,
    fields,
    joins,
    detailFields,
    customActions = [],
    onCustomAction,
    relationalOptions,
    project,
    detailsInterfaceTypes = {},
    detailsTabTitles,
    dictionary = {},
    detailsItemTitles,
    onAddDetail,
    onEditDetail,
    onDeleteDetail,
    buildActionContext,
    tabsStyleConfig,
    t,
    mode,
    isPageMode
  } = props;

    const targetModel = project?.models?.find((m: any) => {
      const tbl = (m.db_table_name || m.table_name || '').toLowerCase();
      return tbl === tableName?.toLowerCase();
    })
    const modelId = targetModel?.id || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id
    const displayLabel = detailsTabTitles?.[modelId || ''] || dictionary[modelId || ''] || targetModel?.display_name || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.display_model_name || tableName

    return (
      <div className="space-y-2">
        {!hideToolbar && (
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
          {titleNode ?? <div />}
          {/* lado direito: todos os controles */}
          <div className="flex items-center gap-1">
            {customActions.filter(a => getActionContexts(a, 'detail:' + modelId).includes('global_top')).map(action => {
              const colors = getActionColorClasses(action.color)
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onCustomAction?.(action, buildActionContext(formData, parentData !== formData ? parentData : undefined, parentData !== formData ? parentData.model_name : undefined))}
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

            {/* Expande/Recolhe Tudo */}
            {(parentData?._details || []).some((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase()) && (
              <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={async () => {
                    const currentDetails = (parentData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase())
                    const pkField = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' }
                    const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                    const newState = { ...expandedDetails }
                    currentDetails.forEach((d: any, idx: number) => {
                      const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                      newState[`detail-${tableName}-${dPk}`] = true
                    })
                    setExpandedDetails(newState)
                    const fetches = currentDetails
                      .filter((d: any) => !d._details || d._details.length === 0)
                      .map((d: any, idx: number) => {
                        const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                        const key = `detail-${tableName}-${dPk}`
                        if (!loadingSubDetails[key]) {
                          setLoadingSubDetails((prev: any) => ({ ...prev, [key]: true }))
                          return fetchSubDetailsForRecord(d, tableName, pkCol, dPk)
                            .finally(() => setLoadingSubDetails((prev: any) => ({ ...prev, [key]: false })))
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
                    const currentDetails = (parentData?._details || []).filter((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase())
                    const pkField = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' }
                    const pkCol = pkField.db_column_name.split('.').pop() || 'id'
                    const newState = { ...expandedDetails }
                    currentDetails.forEach((d: any, idx: number) => {
                      const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`
                      newState[`detail-${tableName}-${dPk}`] = false
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

            {/* Adicionar registro */}
            <button
              type="button"
              onClick={() => {
                if (true) {
                  const newTempId = `temp-${Date.now()}`
                  const newRecord = { id: newTempId, model_name: tableName, _isNew: true }
                  setFormData((prev: any) => ({ ...prev, _details: [...(prev._details || []), newRecord] }))
                  setExpandedDetails((prev: any) => ({ ...prev, [`detail-${tableName}-${newTempId}`]: true }))
                  
                  // Foco no primeiro campo do novo item
                  setTimeout(() => {
                    const container = document.getElementById(`detail-container-detail-${tableName}-${newTempId}`)
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

            {/* Abrir Modal/Drawer */}
            {true && (
              <button
                type="button"
                onClick={() => onAddDetail?.(tableName, parentData.id || parentData.ID)}
                title={detailsInterfaceTypes[modelId || ''] === 'drawer' ? t('common.open_drawer', 'Abrir Gaveta') : t('common.open_modal', 'Abrir Modal')}
                className="p-1.5 bg-neutral-50 dark:bg-neutral-800 text-neutral-400 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
              >
                {detailsInterfaceTypes[modelId || ''] === 'drawer' ? <PanelRight className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
        )}

        <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {(() => {
            const seenIds = new Set();
            const detailsToRender = (parentData?._details || [])
              .filter((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase());
            
            console.log('[RecordForm Render] detailsToRender for', tableName, 'is', detailsToRender.length, 'items', { detailsToRender, parentDetails: parentData?._details });

            return detailsToRender.map((detail: any, idx: number) => {
              const pkField = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase()).find(f => f.is_primary_key) || { db_column_name: 'id' };
              const pkCol = pkField.db_column_name.split('.').pop() || 'id';
              const detailIdValue = detail[pkCol] || detail[pkCol.toUpperCase()] || detail.id || detail.ID || `idx-${idx}`;
              const uniqueKey = `detail-${tableName}-${detailIdValue}`;

              if (seenIds.has(uniqueKey)) return null;
              seenIds.add(uniqueKey);

              return (
                <div key={uniqueKey} id={`detail-container-${uniqueKey}`} className={cn("flex flex-col gap-1 rounded-2xl transition-all duration-300", expandedDetails[uniqueKey] ? "bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20 p-0.5" : "")}>
                  <div className={cn(
                    "py-2.5 px-3 border rounded-xl flex items-center justify-between group animate-in fade-in slide-in-from-top-2 duration-300 transition-all",
                    expandedDetails[uniqueKey]
                      ? "bg-white dark:bg-neutral-900 border-indigo-200 dark:border-indigo-800 shadow-lg shadow-indigo-500/5"
                      : "bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-800"
                  )}>
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "text-xs font-bold transition-colors",
                        expandedDetails[uniqueKey] ? "text-indigo-600 dark:text-indigo-400" : "text-neutral-700 dark:text-neutral-200"
                      )}>
                        {(() => {
                          if (detail._isNew || String(detailIdValue).startsWith('temp-')) {
                            return t('common.new_record', 'Novo Registro');
                          }
                          const detailModelId = project?.models?.find((m: any) => {
                            const tbl = (m.db_table_name || m.table_name || '').toLowerCase();
                            return tbl === tableName?.toLowerCase();
                          })?.id;
                          const customField = detailsItemTitles?.[detailModelId || ''];
                          if (customField) {
                            let val: any;
                            
                            if (customField.includes('.')) {
                              const parts = customField.split('.');
                              val = detail[customField] ?? detail[parts[0]]?.[parts[1]] ?? detail[parts[1]];
                            } else {
                              val = detail[customField];
                            }
                            
                            // Tradução Automática: Se o campo for um relacionamento (Combo), troca o ID pelo Label
                            const baseField = customField.includes('.') ? customField.split('.')[0] : customField;
                            const safeBase = baseField?.toLowerCase()?.trim() || '';
                            let matchedByRelLabel = false;
                            
                            const checkMatch = (f: any) => {
                               const fName = f.db_column_name?.toLowerCase()?.trim() || '';
                               const fLabel = f.display_name?.toLowerCase()?.trim() || f.label?.toLowerCase()?.trim() || '';
                               
                               if (fName === safeBase || fName.endsWith(`.${safeBase}`) || fName.endsWith(`_${safeBase}`)) return true;
                               if (fLabel && (fLabel === safeBase || fLabel.includes(safeBase) || safeBase.includes(fLabel))) return true;
                               
                               // Check if it's a relational field whose label matches the requested title field
                               const comp = f.config?.form_config?.component || f.config?.component || f.widget_options?.component;
                               if (comp && comp.options_type === 'relational') {
                                  const relLabel = comp.rel_label?.toLowerCase() || '';
                                  const relTable = comp.rel_table?.toLowerCase() || '';
                                  
                                  if (relLabel && (relLabel === safeBase || safeBase.includes(relLabel))) {
                                     matchedByRelLabel = true;
                                     return true;
                                  }
                                  
                                  const singularRelTable = relTable.endsWith('s') ? relTable.slice(0, -1) : relTable;
                                  if (singularRelTable && safeBase.includes(singularRelTable) && (safeBase.includes('nome') || safeBase.includes('titulo'))) {
                                     matchedByRelLabel = true;
                                     return true;
                                  }
                               }
                               return false;
                            };
                            
                            let titleFieldDef = detailFields.find(checkMatch) || fields.find(checkMatch);
                            if (!titleFieldDef && project?.models && detailModelId) {
                               const model = project.models.find((m: any) => m.id === detailModelId);
                               if (model && model.ui_fields) {
                                  titleFieldDef = model.ui_fields.find(checkMatch);
                               }
                            }
                            
                            if (titleFieldDef) {
                               // If matched by rel_label, we need to extract the foreign key ID first
                               if (matchedByRelLabel || val === undefined) {
                                  val = detail[titleFieldDef.db_column_name];
                               }
                               
                               if (val !== undefined && val !== null) {
                                  const opts = relationalOptions[titleFieldDef.id] || [];
                                  const matchedOpt = opts.find(o => String(o.value) === String(val));
                                  if (matchedOpt && matchedOpt.label) {
                                     val = matchedOpt.label;
                                  }
                               }
                            }
                            
                            // Tentar inferir se a string parece uma ISO date de qualquer forma (fallback robusto)
                            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
                               try {
                                  const d = new Date(val);
                                  if (!isNaN(d.getTime())) {
                                     const tType = titleFieldDef?.config?.form_config?.component?.type || titleFieldDef?.config?.component?.type;
                                     if (tType === 'date' || val.endsWith('T00:00:00.000Z')) {
                                       val = new Intl.DateTimeFormat(dateLocale, { timeZone: 'UTC' }).format(d);
                                     } else {
                                       val = new Intl.DateTimeFormat(dateLocale, { dateStyle: 'short', timeStyle: 'short' }).format(d);
                                     }
                                  }
                               } catch (e) {
                                  console.error('Date formatting error:', e);
                               }
                            }
                            // Resiliência de objeto aninhado:
                            if ((val === undefined || val === null || val === '') && customField) {
                               const targetProp = customField.includes('.') ? customField.split('.')[1] : customField;
                               const targetLower = targetProp?.toLowerCase();
                               if (targetLower) {
                                 for (const key of Object.keys(detail)) {
                                   if (detail[key] && typeof detail[key] === 'object') {
                                     const nestedObj = detail[key];
                                     const matchKey = Object.keys(nestedObj).find(k => k?.toLowerCase() === targetLower);
                                     if (matchKey) {
                                       val = nestedObj[matchKey];
                                       break;
                                     }
                                   }
                                 }
                               }
                            }

                            if (val !== undefined && val !== null && val !== '') {
                              if (typeof val === 'object') {
                                return String(val.display_name || val.name || val.nome || val.titulo || val.title || val.id || JSON.stringify(val));
                              }
                              return String(val);
                            }
                          } else {
                            // Se não há customField, procura em objetos aninhados se existe algo com cara de título
                            for (const key of Object.keys(detail)) {
                               if (detail[key] && typeof detail[key] === 'object' && !Array.isArray(detail[key])) {
                                 const nested = detail[key];
                                 const possibleVal = nested.display_name || nested.name || nested.nome || nested.titulo || nested.title || nested.label;
                                 if (possibleVal) return String(possibleVal);
                               }
                            }
                          }
                          return detail.display_name || detail.name || detail.nome || detail.titulo || detail.label || `Item #${idx + 1}`;
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 transition-all">
                      {/* Botão de Cortina (Na Lista) */}
                      {true && (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const willExpand = !expandedDetails[uniqueKey]
                            setExpandedDetails((prev: any) => ({
                              ...prev,
                              [uniqueKey]: willExpand
                            }));
                            // Lazy load sub-detalhes ao expandir pela primeira vez
                            if (willExpand && !loadingSubDetails[uniqueKey] && (!detail._details || detail._details.length === 0)) {
                              setLoadingSubDetails((prev: any) => ({ ...prev, [uniqueKey]: true }))
                              await fetchSubDetailsForRecord(detail, tableName, pkCol, detailIdValue)
                              setLoadingSubDetails((prev: any) => ({ ...prev, [uniqueKey]: false }))
                            }
                          }}
                          className={cn(
                            "p-1.5 rounded-lg shadow-sm transition-all",
                            loadingSubDetails[uniqueKey]
                              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 animate-pulse cursor-wait"
                              : expandedDetails[uniqueKey]
                                ? "bg-indigo-600 text-white"
                                : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                          )}
                        >
                          {loadingSubDetails[uniqueKey]
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-300", expandedDetails[uniqueKey] && "rotate-180")} />
                          }
                        </button>
                      )}
                      {customActions.filter(a => getActionContexts(a, 'detail:' + modelId).includes('row')).map(action => {
                        const colors = getActionColorClasses(action.color)
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCustomAction?.(action, buildActionContext(formData, parentData !== formData ? parentData : undefined, parentData !== formData ? parentData.model_name : undefined, detail, tableName)); }}
                            className={cn(
                              "p-1.5 rounded-lg border transition-all shadow-sm bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700",
                              colors.text,
                              colors.hover
                            )}
                            title={action.label}
                          >
                            {getActionIcon(action.icon, "w-3.5 h-3.5")}
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditDetail?.(detail); }}
                        className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 shadow-sm transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Se o registro é novo (ainda não salvo no banco), apenas remove da lista local
                          if (detail._isNew || String(detailIdValue).startsWith('temp-')) {
                            setFormData((prev: any) => ({
                              ...prev,
                              _details: (prev._details || []).filter((_d: any, _i: number) => {
                                const _pk = pkField.db_column_name.split('.').pop() || 'id';
                                const _dPk = _d[_pk] || _d[_pk.toUpperCase()] || _d.id || _d.ID || `idx-${_i}`;
                                return String(_dPk) !== String(detailIdValue);
                              })
                            }));
                          } else {
                            // Registro persistido: chama o fluxo normal de exclusão
                            onDeleteDetail?.(detail);
                          }
                        }}
                        className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 shadow-sm transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Efeito Cortina (Edição In-place) */}
                  {expandedDetails[uniqueKey] && (
                    <div className="p-6 bg-white dark:bg-neutral-950 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 animate-in slide-in-from-top-2 duration-300 space-y-8 shadow-inner">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        {(() => {
                          const detailFieldsForThisModel = fields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase());
                          return detailFieldsForThisModel.map(field => {
                            const fieldConfig = field.config?.form_config || field.config || {};
                            const gridSpan = parseInt(isPageMode ? (fieldConfig.component?.gridSpan || 12) : (fieldConfig.component?.modalGridSpan || fieldConfig.component?.gridSpan || 12)) || 12;
                            const colSpanClass = {
                              1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4',
                              5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8',
                              9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12'
                            }[gridSpan] || 'md:col-span-12';
                            let width = fieldConfig.component?.width || '100%';
                            
                            if (typeof width === 'string' && width.endsWith('col')) {
                              const colWidth = parseFloat(width.replace('col', ''));
                              if (!isNaN(colWidth) && gridSpan > 0) {
                                width = `${(colWidth / gridSpan) * 100}%`;
                              } else {
                                width = '100%';
                              }
                            }

                            return (
                            <div key={field.id} className={cn("space-y-1.5 col-span-1", colSpanClass)} style={{ width: width }}>
                              <label 
                                style={{
                                  fontFamily: getFontFamily(field.config?.label?.font),
                                  fontSize: getFontSize(field.config?.label?.size),
                                  color: field.config?.label?.color,
                                  fontWeight: field.config?.label?.bold ? 'bold' : undefined,
                                  fontStyle: field.config?.label?.italic ? 'italic' : undefined,
                                  textTransform: field.config?.label?.uppercase ? 'uppercase' : undefined,
                                }}
                                className="text-[10px] font-black tracking-widest text-neutral-400"
                              >
                                {field.display_name}
                              </label>
                              {(() => {
                                const baseCol = field.db_column_name.split('.').pop() || field.db_column_name;
                                const rawValue = detail[baseCol] || detail[baseCol.toUpperCase()] || detail[field.db_column_name] || '';

                                const fieldConfig = field.config?.form_config || field.config || {};
                                const type = fieldConfig.component?.type || 'text';
                                const maskStr = fieldConfig.content?.mask;
                                const isDateType = type === 'date' || type === 'datetime-local' || type === 'datetime' || type === 'time';
                                const isInlineDisabled = mode === 'view' || field.is_primary_key || fieldConfig.content?.readonly === true;

                                const handleInlineChange = (rawVal: any) => {
                                  let newVal = rawVal;
                                  if (maskStr && typeof rawVal === 'string' && !isDateType) {
                                    if (maskStr === '0.000' || maskStr === '0.000,00') {
                                      newVal = parseMaskedNumber(rawVal, maskStr);
                                    } else {
                                      newVal = applyMask(rawVal, maskStr);
                                    }
                                  }

                                  // Se parentData for o formData principal, atualizamos o topo
                                  if (parentData === formData) {
                                    const newDetails = (formData._details || []).map((d: any) => {
                                      const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`;
                                      if (dPk === detailIdValue && d.model_name === tableName) {
                                        return { ...d, [baseCol]: newVal };
                                      }
                                      return d;
                                    });
                                    setFormData({ ...formData, _details: newDetails });
                                  } else {
                                    // Se parentData for um registro de detalhe, atualizamos dentro dele (recursivo)
                                    const newParentDetails = (parentData._details || []).map((d: any) => {
                                      const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID || `idx-${idx}`;
                                      if (dPk === detailIdValue && d.model_name === tableName) {
                                        return { ...d, [baseCol]: newVal };
                                      }
                                      return d;
                                    });

                                    // Agora precisamos atualizar este parentData dentro do formData._details original
                                    const updatedParentData = { ...parentData, _details: newParentDetails };
                                    const newTopDetails = (formData._details || []).map((td: any) => {
                                      // Encontrar o parentData original. Precisamos do seu PK.
                                      // Como não temos o nome da tabela do pai aqui, assumimos que id/ID resolvem ou comparamos o objeto todo
                                      if (td === parentData || (td.id && td.id === parentData.id) || (td.ID && td.ID === parentData.ID)) {
                                        return updatedParentData;
                                      }
                                      return td;
                                    });
                                    setFormData({ ...formData, _details: newTopDetails });
                                  }
                                };


                                if (type === 'textarea') {
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <textarea
                                        value={rawValue || ''}
                                        onChange={(e) => handleInlineChange(e.target.value)}
                                        disabled={isInlineDisabled}
                                        rows={fieldConfig.content?.rows || 3}
                                        className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder={fieldConfig.content?.placeholder || t('runtime.type_here', 'Digite aqui...')}
                                      />
                                      {field.db_column_name.startsWith('virt_') && (
                                        <div className="text-[10px] text-orange-500">
                                          DEBUG VIRT: val={rawValue}, detail_keys={Object.keys(detail).filter(k=>k.startsWith('virt_')).join(',')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                if (['select', 'Combo (Select)'].includes(type)) {
                                  let options = relationalOptions[field.id] || parseFixedOptions(fieldConfig.component?.options);
                                  if (fieldConfig.component?.depends_on && fieldConfig.component?.filter_column) {
                                    const depName = fieldConfig.component.depends_on;
                                    const depBase = depName.split('.').pop() || depName;
                                    let depValue = detail[depName] ?? detail[depBase] ?? detail[depBase.toUpperCase()];
                                    if (depValue === undefined || depValue === null) {
                                      depValue = formData[depName] ?? formData[depBase];
                                    }
                                    if (depValue !== undefined && depValue !== null && depValue !== '') {
                                      options = options.filter((o: any) => String(o.filter_value) === String(depValue));
                                    } else {
                                      options = [];
                                    }
                                  }
                                  return (
                                    <div className="flex flex-col gap-1">
                                      <select
                                        value={rawValue || ''}
                                        onChange={(e) => handleInlineChange(e.target.value)}
                                        disabled={isInlineDisabled}
                                        className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        <option value="">Selecione...</option>
                                        {options.map((opt: any) => (
                                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                      </select>
                                      {/* Removed debug info */}
                                    </div>
                                  );
                                }

                                if (['radio', 'Radio Buttons'].includes(type)) {
                                  let options = relationalOptions[field.id] || parseFixedOptions(fieldConfig.component?.options);
                                  if (fieldConfig.component?.depends_on && fieldConfig.component?.filter_column) {
                                    const depName = fieldConfig.component.depends_on;
                                    const depBase = depName.split('.').pop() || depName;
                                    let depValue = detail[depName] ?? detail[depBase] ?? detail[depBase.toUpperCase()];
                                    if (depValue === undefined || depValue === null) {
                                      depValue = formData[depName] ?? formData[depBase];
                                    }
                                    if (depValue !== undefined && depValue !== null && depValue !== '') {
                                      options = options.filter((o: any) => String(o.filter_value) === String(depValue));
                                    } else {
                                      options = [];
                                    }
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-4 pt-1">
                                      {options.map((opt: any, i: number) => (
                                        <label key={i} className="flex items-center gap-2 cursor-pointer group/opt">
                                          <div
                                            onClick={() => !isInlineDisabled && handleInlineChange(opt.value)}
                                            className={cn(
                                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                                              String(rawValue) === String(opt.value) ? 'border-indigo-600 bg-indigo-600' : 'border-neutral-300 dark:border-neutral-700'
                                            )}
                                          >
                                            {String(rawValue) === String(opt.value) && <div className="w-2 h-2 bg-white rounded-full" />}
                                          </div>
                                          <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover/opt:text-indigo-600 transition-colors">{opt.label}</span>
                                        </label>
                                      ))}
                                    </div>
                                  );
                                }
                                
                                if (['checkbox', 'Checkbox Group'].includes(type)) {
                                  let options = relationalOptions[field.id] || parseFixedOptions(fieldConfig.component?.options);
                                  if (fieldConfig.component?.depends_on && fieldConfig.component?.filter_column) {
                                    const depName = fieldConfig.component.depends_on;
                                    const depBase = depName.split('.').pop() || depName;
                                    let depValue = detail[depName] ?? detail[depBase] ?? detail[depBase.toUpperCase()];
                                    if (depValue === undefined || depValue === null) {
                                      depValue = formData[depName] ?? formData[depBase];
                                    }
                                    if (depValue !== undefined && depValue !== null && depValue !== '') {
                                      options = options.filter((o: any) => String(o.filter_value) === String(depValue));
                                    } else {
                                      options = [];
                                    }
                                  }
                                  return (
                                    <div className="flex flex-wrap gap-4 pt-1">
                                      {options.map((opt: any, i: number) => {
                                        const checked = Array.isArray(rawValue) ? rawValue.includes(opt.value) : String(rawValue).split(',').includes(String(opt.value));
                                        return (
                                          <label key={i} className="flex items-center gap-2 cursor-pointer group/opt">
                                            <div
                                              onClick={() => {
                                                if (isInlineDisabled) return;
                                                let currentValues = Array.isArray(rawValue) ? [...rawValue] : (rawValue ? String(rawValue).split(',') : []);
                                                if (checked) {
                                                  currentValues = currentValues.filter((v: any) => String(v) !== String(opt.value));
                                                } else {
                                                  currentValues.push(opt.value);
                                                }
                                                handleInlineChange(currentValues.join(','));
                                              }}
                                              className={cn(
                                                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                                checked ? 'border-indigo-600 bg-indigo-600' : 'border-neutral-300 dark:border-neutral-700'
                                              )}
                                            >
                                              {checked && <div className="w-2 h-2 bg-white" style={{ clipPath: 'polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)' }} />}
                                            </div>
                                            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 group-hover/opt:text-indigo-600 transition-colors">{opt.label}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                if (['image_uploader', 'document_uploader', 'file_uploader'].includes(type)) {
                                  return (
                                    <div className="pt-1">
                                      <FileUploaderInput
                                        value={rawValue || ''}
                                        onChange={handleInlineChange}
                                        type={type === 'image_uploader' ? 'image' : type === 'document_uploader' ? 'document' : 'any'}
                                        disabled={isInlineDisabled}
                                      />
                                    </div>
                                  );
                                }

                                let displayValue = rawValue;
                                if (maskStr && !isDateType) {
                                  displayValue = applyMask(rawValue, maskStr);
                                } else if (isDateType && rawValue && typeof rawValue === 'string') {
                                  const dateStr = rawValue.replace(' ', 'T');
                                  if (type === 'date') displayValue = dateStr.substring(0, 10);
                                  else if (type === 'datetime-local' || type === 'datetime') displayValue = dateStr.substring(0, 16);
                                }

                                return (
                                  <input
                                    type={
                                      type === 'date' ? 'date' :
                                        (type === 'datetime-local' || type === 'datetime') ? 'datetime-local' :
                                          type === 'time' ? 'time' :
                                            maskStr ? 'text' :
                                              type === 'number' ? 'number' : 'text'
                                    }
                                    value={displayValue}
                                    onChange={(e) => handleInlineChange(e.target.value)}
                                    disabled={isInlineDisabled}
                                    className="w-full px-4 py-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                );
                              })()}
                            </div>
                          );
                          });
                        })()}
                      </div>

                      {/* SUB-DETALHES RECURSIVOS NA CORTINA */}
                      {(() => {
                        const subTables = Array.from(new Set(
                          fields
                            .filter(f => joins.some(j => j.from?.toLowerCase() === tableName.toLowerCase() && j.to?.toLowerCase() === f.model_name?.toLowerCase()))
                            .map(f => f.model_name)
                        ));

                        if (subTables.length > 0) {
                          return (
                            <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-6">
                              {subTables.map(st => {
                                const stTargetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === st?.toLowerCase());
                                const stModelId = stTargetModel?.id || fields.find(f => f.model_name?.toLowerCase() === st?.toLowerCase())?.model_id;
                                const stTitle = detailsTabTitles?.[stModelId || ''] || dictionary?.[stModelId || ''] || stTargetModel?.display_name || fields.find(f => f.model_name?.toLowerCase() === st?.toLowerCase())?.display_model_name || st;
                                
                                return (
                                  <div key={st} className="pl-4 border-l-2 border-indigo-100 dark:border-indigo-900/30">
                                    {<RecordFormDetailSection 
    tableName={st} 
    parentData={detail} 
    titleNode={(
                                      <div className="flex items-center gap-2 mb-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
                                        <h3
                                          style={{
                                            fontFamily: getFontFamily(tabsStyleConfig?.label?.font),
                                            fontSize: getFontSize(tabsStyleConfig?.label?.size),
                                            ...(tabsStyleConfig?.label?.color ? { color: tabsStyleConfig.label.color } : {})
                                          }}
                                          className="text-[10px] font-black tracking-[0.2em] text-neutral-800 dark:text-neutral-200 uppercase"
                                        >
                                          {stTitle}
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
    detailsInterfaceTypes={detailsInterfaceTypes}
    detailsItemTitles={detailsItemTitles}
    detailsTabTitles={detailsTabTitles}
    dictionary={dictionary}
    onAddDetail={onAddDetail}
    onEditDetail={onEditDetail}
    onDeleteDetail={onDeleteDetail}
    buildActionContext={buildActionContext}
    tabsStyleConfig={tabsStyleConfig}
    t={t}
    mode={mode}
  />}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              );
            });
          })()}
          {(!(parentData?._details || []).some((d: any) => d.model_name?.toLowerCase() === tableName?.toLowerCase())) && (
            <div className="py-12 text-center border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-3xl">
              <p className="text-xs text-neutral-400 italic">Nenhum registro de {(() => {
                const targetModel = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase());
                const modelId = targetModel?.id || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.model_id
                return detailsTabTitles?.[modelId || ''] || dictionary[modelId || ''] || targetModel?.display_name || fields.find(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())?.display_model_name || tableName
              })()} encontrado.</p>
            </div>
          )}
        </div>
      </div>
    )
}
