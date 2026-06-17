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
  const [formData, setFormData] = useState<any>(initialData || {})
  const [activeTab, setActiveTab] = useState<'master' | string>(initialTab)

  const formRef = useRef<HTMLFormElement>(null)
  
  useEffect(() => {
    if (mode === 'view') return;
    const timer = setTimeout(() => {
      if (formRef.current) {
        // Find the first visible and enabled input/textarea/select
        const firstInput = formRef.current.querySelector('input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled]):not([readonly])') as HTMLElement
        if (firstInput) {
          firstInput.focus()
        }
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [mode, initialData, refreshTrigger, activeTab])
  const [relationalOptions, setRelationalOptions] = useState<Record<string, any[]>>({})
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [loadingSubDetails, setLoadingSubDetails] = useState<Record<string, boolean>>({})

  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embedded') === 'true'
  const handleCancel = () => {
    if (isEmbedded) {
      window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
    } else {
      onCancel()
    }
  }

  // Busca sub-detalhes de um registro sob demanda (lazy loading)
  // chamado ao expandir a cortina de um detalhe pela primeira vez
  const fetchSubDetailsForRecord = async (detail: any, tableName: string, pkCol: string, pkValue: any) => {
    const subJoins = joins.filter((j: any) => j.from?.toLowerCase() === tableName?.toLowerCase())
    if (subJoins.length === 0) return

    const supabaseClient = createClient()
    const allSubDetails: any[] = []

    for (const join of subJoins) {
      if (!pkValue) continue

      let data: any[] = []

      if (projectId) {
        // Query via the secure data tunnel
        const queryId = crypto.randomUUID()

        console.log(`[MetaBuilder] RecordForm fetching sub-details from ${join.to} via tunnel where ${join.foreignKey} = ${pkValue}`)

        try {
          data = await new Promise<any[]>((resolve, reject) => {
            const isTemporary = !tunnelChannel || !isTunnelReady
            const channelName = `tunnel:${projectId}`
            const channel = isTemporary ? supabaseClient.channel(channelName) : tunnelChannel
            let resolved = false

            const handleResult = (payload: any) => {
              if (payload.payload?.queryId === queryId) {
                resolved = true
                cleanup()
                if (payload.payload.success) {
                  resolve(payload.payload.data || [])
                } else {
                  reject(new Error(payload.payload.error || 'Error fetching sub-details'))
                }
              }
            }

            const cleanup = () => {
              try {
                const bindings = channel.bindings?.broadcast
                if (Array.isArray(bindings)) {
                  const cleanBindings = bindings.filter((b: any) => {
                    const match = b.callback === handleResult
                    if (match && channel.channelAdapter) {
                      channel.channelAdapter.off('broadcast', b.ref)
                    }
                    return !match
                  })
                  channel.bindings.broadcast = cleanBindings
                }

                if (isTemporary) {
                  channel.unsubscribe()
                  supabaseClient.removeChannel(channel)
                }
              } catch (err) {
                console.error('[MetaBuilder] Error cleaning up channel in RecordForm:', err)
              }
            }

            channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
            channel.on('broadcast', { event: 'sql_result' }, handleResult)

            let fetchJoins = (joins || []).filter((j: any) => j.from?.toLowerCase() === join.to.toLowerCase())
          
            const modelId = project?.models?.find((m: any) => m.db_table_name === join.to)?.id
            const customField = detailsItemTitles?.[modelId || '']
            if (customField && customField.includes('.')) {
              const relatedTable = customField.split('.')[0]
              const hasJoin = fetchJoins.some((j: any) => j.to === relatedTable || j.toTable === relatedTable)
              if (!hasJoin) {
                const sourceModel = project?.models?.find((m: any) => m.db_table_name === join.to)
              const linkField = sourceModel?.fields?.find((f: any) => 
                f.foreign_key_table === relatedTable || 
                f.db_column_name === `${relatedTable}_id` ||
                (relatedTable.endsWith('s') && f.db_column_name === `${relatedTable.slice(0, -1)}_id`) ||
                (relatedTable.endsWith('es') && f.db_column_name === `${relatedTable.slice(0, -2)}_id`)
              )
              if (linkField) {
                  fetchJoins.push({
                    from: join.to,
                    local: linkField.db_column_name,
                    localKey: linkField.db_column_name,
                    to: relatedTable,
                    foreignKey: linkField.foreign_key_column || 'id',
                    type: 'left'
                  })
                }
              }
            }

            const sendPayload = {
              type: 'broadcast',
              event: 'sql_query',
              payload: {
                queryId,
                table: join.to,
                schemaName: project?.models?.find((m: any) => m.db_table_name === join.to)?.db_schema_name || project?.slug || 'public',
                action: 'select',
                token: secretToken,
                joins: fetchJoins,
                filters: { [join.foreignKey]: String(pkValue) },
                limit: 100,
                offset: 0
              }
            }

            if (isTemporary) {
              channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                  channel.send(sendPayload)
                }
              })
            } else {
              channel.send(sendPayload)
            }

            // Timeout fallback
            setTimeout(() => {
              if (!resolved) {
                resolved = true
                cleanup()
                console.warn(`[MetaBuilder] Timeout fetching sub-details in RecordForm for queryId ${queryId}`)
                resolve([])
              }
            }, 8000)
          })
        } catch (err) {
          console.error(`[MetaBuilder] Error fetching sub-details from ${join.to} via tunnel:`, err)
        }
      } else {
        // Fallback to direct supabase query
        const { data: directData } = await (supabaseClient as any)
          .from(join.to)
          .select('*')
          .eq(join.foreignKey, String(pkValue))
        if (directData) {
          data = directData
        }
      }

      if (data) {
        allSubDetails.push(...data.map((d: any) => ({ ...d, model_name: join.to })))
      }
    }

    // Injeta os sub-detalhes no registro correto dentro de formData._details
    setFormData((prev: any) => {
      const newDetails = (prev._details || []).map((d: any) => {
        const dPk = d[pkCol] || d[pkCol.toUpperCase()] || d.id || d.ID
        if (String(dPk) === String(pkValue) && d.model_name?.toLowerCase() === tableName.toLowerCase()) {
          return { ...d, _details: allSubDetails }
        }
        return d
      })
      return { ...prev, _details: newDetails }
    })
  }

  useEffect(() => {
    const fetchAllRelational = async () => {
      const supabase = createClient()
      const newOptions: Record<string, any[]> = {}

      for (const field of fields) {
        // Tenta pegar a config específica de formulário, senão usa a global
        const config = field.config?.form_config || field.config
        const comp = config?.component
        const isRelationalComp = comp?.type && (['select', 'radio', 'checkbox', 'Combo (Select)', 'Radio Buttons', 'Checkbox Group'].includes(comp.type) || comp.options_type === 'relational' || comp.options_type === 'enumeration')
        if (isRelationalComp && comp.options_type === 'relational' && comp.rel_table) {
          try {
            if (projectId) {
              if (!tunnelChannel || !isTunnelReady) continue;
              const queryId = crypto.randomUUID()
              const rawQuery = `SELECT "${comp.rel_label}", "${comp.rel_value}" FROM "${comp.rel_table}"`

              const schemaToUse = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === comp.rel_table?.toLowerCase())?.db_schema_name || project?.slug || 'public'
              console.log(`[MetaBuilder:RecordForm] Fetching relational options for ${comp.rel_table} with schemaName:`, schemaToUse)
              console.log(`[MetaBuilder:RecordForm] Query:`, rawQuery)

              const data = await new Promise<any[]>((resolve, reject) => {
                let resolved = false
                const cleanup = () => {
                  try {
                    const bindings = tunnelChannel.bindings?.broadcast
                    if (Array.isArray(bindings)) {
                      const cleanBindings = bindings.filter((b: any) => {
                        const match = b.callback === handleResult
                        if (match && tunnelChannel.channelAdapter) {
                          tunnelChannel.channelAdapter.off('broadcast', b.ref)
                        }
                        return !match
                      })
                      tunnelChannel.bindings.broadcast = cleanBindings
                    }
                  } catch (e) { }
                }

                const handleResult = (payload: any) => {
                  if (payload.payload?.queryId === queryId) {
                    resolved = true
                    cleanup()
                    console.log(`[MetaBuilder:RecordForm] Relational options for ${comp.rel_table} returned:`, payload.payload)
                    if (payload.payload.success) resolve(payload.payload.data || [])
                    else reject(new Error(payload.payload.error || 'Error fetching relational options'))
                  }
                }
                tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
                tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult)

                tunnelChannel.send({
                  type: 'broadcast',
                  event: 'sql_query',
                  payload: {
                    queryId,
                    table: comp.rel_table,
                    schemaName: schemaToUse,
                    action: 'select',
                    query: rawQuery,
                    sql: rawQuery,
                    token: secretToken,
                    joins: [],
                    limit: 1000,
                    offset: 0
                  }
                })

                setTimeout(() => {
                  if (!resolved) {
                    resolved = true
                    console.warn(`[MetaBuilder:RecordForm] Timeout fetching relational options for ${comp.rel_table}`)
                    resolve([])
                  }
                }, 8000)
              })

              if (data) {
                newOptions[field.id] = data.map(item => ({
                  label: item[comp.rel_label] || item[comp.rel_label.toLowerCase()] || item[comp.rel_label.toUpperCase()],
                  value: item[comp.rel_value] || item[comp.rel_value.toLowerCase()] || item[comp.rel_value.toUpperCase()]
                }))
              }
            } else {
              const { data } = await supabase
                .from(comp.rel_table)
                .select(`${comp.rel_label}, ${comp.rel_value}`)

              if (data) {
                newOptions[field.id] = data.map(item => ({
                  label: item[comp.rel_label],
                  value: item[comp.rel_value]
                }))
              }
            }
          } catch (err) {
            console.error(`Error fetching relational options for field ${field.id}:`, err)
          }
        } else if (isRelationalComp && comp.options_type === 'enumeration' && comp.rel_table) {
          try {
            const { data } = await supabase
              .from('project_enumerations')
              .select('values')
              .eq('id', comp.rel_table)
              .single()

            if (data && data.values) {
              newOptions[field.id] = data.values.map((v: any) => ({
                label: v.description || v.value,
                value: v.value
              }))
            }
          } catch (err) {
            console.error(`Error fetching enumeration options for field ${field.id}:`, err)
          }
        }
      }
      setRelationalOptions(newOptions)
    }

    if (fields.length > 0) {
      fetchAllRelational()
    }
  }, [fields, isTunnelReady, tunnelChannel, project, projectId, refreshTrigger])


  // Identifica quem é o mestre atual (pode ser o ID ou o Nome da tabela)
  const currentMasterId = masterModelId || fields.find((f: any) => f.model_name?.toLowerCase() === masterModelName?.toLowerCase())?.model_id

  const masterFields = fields.filter((f: any) => {
    const isMaster = !f.model_id ||
      (currentMasterId && String(f.model_id) === String(currentMasterId)) ||
      (masterModelName && f.model_name?.toLowerCase().trim() === masterModelName?.toLowerCase().trim())

    if (!isMaster) return false
    return (!!masterModelName || f.zone === 3 || f.zone === '3' || f.zone === undefined || f.zone === null)
  })

  const detailFields = fields.filter((f: any) => {
    const isMaster = (currentMasterId && String(f.model_id) === String(currentMasterId)) ||
      (masterModelName && f.model_name?.toLowerCase().trim() === masterModelName?.toLowerCase().trim())
    return f.model_id && !isMaster
  })

  // FILTRAGEM HIERÁRQUICA: 
  // Só mostramos como aba as tabelas que são FILHAS DIRETAS do mestre atual no array de JOINS
  const detailTables = Array.from(new Set(
    detailFields
      .filter((f: any) => {
        if (masterModelName && f.model_name?.toLowerCase().trim() === masterModelName?.toLowerCase().trim()) return false;
        // Se não houver joins, mostra tudo (fallback)
        if (!joins || joins.length === 0) return true
        // Verifica se existe um join de masterModelName -> f.model_name
        return joins.some((j: any) => (j.from?.toLowerCase() === masterModelName?.toLowerCase()) && j.to?.toLowerCase() === f.model_name?.toLowerCase())
      })
      .map((f: any) => f.model_name || 'Details')
  ))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const payloadToSave = { ...formData }
    Object.keys(payloadToSave).forEach(key => {
      if (key.startsWith('virt_') || fields.find((f: any) => f.db_column_name === key)?.is_virtual) {
        delete payloadToSave[key]
      }
    })

    console.log('[RecordForm] handleSubmit - payload keys:', Object.keys(payloadToSave), '| payload:', JSON.stringify(payloadToSave).slice(0, 500))
    onSave(payloadToSave)
  }

  useEffect(() => {
    const data = { ...(initialData || {}) }
    
    console.log('[RecordForm Debug] useEffect initialData trigger.', { mode, initialDetailsLength: data._details?.length, detailTables })
    
    // Inject empty details for master_detail or cadastro if not provided
    if (mode === 'create' && (!data._details || data._details.length === 0)) {
      const dDetails: any[] = []
      const newExpandedState: Record<string, boolean> = {}
      
      // Use the exact same detailTables array that determines the tabs
      detailTables.forEach(tableName => {
        const newId = crypto.randomUUID()
        dDetails.push({
          model_name: tableName,
          _isNew: true,
          id: newId
        })
        newExpandedState[`detail-${tableName}-${newId}`] = true
      })
      
      console.log('[RecordForm Debug] Injecting empty details!', { dDetails })
      data._details = dDetails
      
      // Expande automaticamente as abas recém injetadas
      setExpandedDetails(prev => ({ ...prev, ...newExpandedState }))
      
      // Foco automático no primeiro campo da tela para o novo registro
      setTimeout(() => {
        const firstInput = document.querySelector('input:not([type="hidden"]), select, textarea') as HTMLElement
        if (firstInput) firstInput.focus()
      }, 300)
    }
    
    setFormData(data)
    // Using JSON.stringify(detailTables) to safely include it as a dependency without causing loops
  }, [initialData, mode, logicType, masterModelId, fields, JSON.stringify(detailTables)])

  // Motor Reativo de Fórmulas
  useEffect(() => {
    if (!fields) return;

    let hasChanges = false;
    const newFormData = { ...formData };

    // Agrupa os detalhes pela tabela (model_name) para alimentar as funções de agregação (SOMA, etc)
    const detailsData: Record<string, any[]> = {};
    (formData._details || []).forEach((d: any) => {
      const tableName = d.model_name || d.model;
      if (tableName) {
        if (!detailsData[tableName]) detailsData[tableName] = [];
        detailsData[tableName].push(d);
      }
    });

    // Avalia todos os campos que possuem uma fórmula configurada
    fields.forEach(field => {
      const tokens = field.config?.content?.formula_tokens || [];
      if (tokens.length === 0) return;

      const mainModelName = masterModelName || project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;
      const isMasterZone = !field.model_name || !mainModelName || field.model_name.toLowerCase() === mainModelName.toLowerCase();

      if (isMasterZone) {
        const computedValue = evaluateFormula(tokens, formData, detailsData, formData, mainModelName);
        // Evita loop infinito atualizando apenas se o valor realmente mudou
        if (computedValue !== null && computedValue !== undefined && String(computedValue) !== String(formData[field.db_column_name])) {
          newFormData[field.db_column_name] = computedValue;
          hasChanges = true;
        }
      } else {
        const detailTableName = field.model_name;
        if (newFormData._details) {
          newFormData._details = newFormData._details.map((row: any) => {
            if (row.model_name?.toLowerCase() !== detailTableName?.toLowerCase() && row.model?.toLowerCase() !== detailTableName?.toLowerCase()) return row;

            const mappedRow = { ...formData, ...row };
            Object.keys(row).forEach(k => {
               mappedRow[`${detailTableName}.${k}`] = row[k];
            });

            const computedValue = evaluateFormula(tokens, mappedRow, detailsData, row, detailTableName);
            if (computedValue !== null && computedValue !== undefined && String(computedValue) !== String(row[field.db_column_name])) {
              hasChanges = true;
              return { ...row, [field.db_column_name]: computedValue };
            }
            return row;
          });
        }
      }
    });

    if (hasChanges) {
      setFormData((prev: any) => {
        const next = { ...prev };
        Object.keys(newFormData).forEach(k => {
          if (newFormData[k] !== formData[k]) {
            next[k] = newFormData[k];
          }
        });
        return next;
      });
    }
  }, [formData, fields]);

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
                      <div className={cn("grid gap-6", isPageMode ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                        {(() => {
                          const seenFields = new Set();
                          return masterFields.map(field => {
                            if (seenFields.has(field.id)) return null;
                            seenFields.add(field.id);
                            return <div key={field.id}><RecordFormField 
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


