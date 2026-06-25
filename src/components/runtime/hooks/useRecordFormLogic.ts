import { useState, useEffect, useRef } from 'react'
import { evaluateFormula } from '@/lib/formulaEvaluator'
import { createClient } from '@/utils/supabase/client'

export interface UseRecordFormLogicProps {
  mode: 'create' | 'edit' | 'view';
  fields: any[];
  initialData?: any;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  logicType?: string;
  masterModelId?: string;
  masterModelName?: string;
  joins?: any[];
  initialTab?: string;
  detailsItemTitles?: Record<string, string>;
  projectId?: string;
  secretToken?: string;
  tunnelChannel?: any;
  isTunnelReady?: boolean;
  project?: any;
  refreshTrigger?: number;
}

export function useRecordFormLogic(props: UseRecordFormLogicProps) {
  const {
    mode, fields, initialData, onSave, onCancel, logicType, masterModelId, masterModelName,
    joins = [], initialTab = 'master', detailsItemTitles, projectId, secretToken,
    tunnelChannel, isTunnelReady, project, refreshTrigger
  } = props;
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
            const res = await fetch(`/api/enumerations?id=${comp.rel_table}`)
            if (res.ok) {
              const result = await res.json()
              if (result.data && result.data.values) {
                newOptions[field.id] = result.data.values.map((v: any) => ({
                  label: v.description || v.value,
                  value: v.value
                }))
              }
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

    const mainModelName = masterModelName || project?.models?.find((m: any) => m.id === masterModelId)?.db_table_name;

    const evaluateRowFormulas = (rowData: any, parentData: any, isMaster: boolean): { row: any, hasChanges: boolean } => {
      let currentRow = { ...rowData };
      let hasChanges = false;

      // 1. Evaluate children first (bottom-up)
      if (currentRow._details && Array.isArray(currentRow._details)) {
        let subHasChanges = false;
        const newDetails = currentRow._details.map((subRow: any) => {
          const result = evaluateRowFormulas(subRow, currentRow, false);
          if (result.hasChanges) subHasChanges = true;
          return result.row;
        });
        
        if (subHasChanges) {
          currentRow._details = newDetails;
          hasChanges = true;
        }
      }

      // 2. Build local detailsData for this row
      const rowDetailsData: Record<string, any[]> = {};
      (currentRow._details || []).forEach((d: any) => {
        const tName = d.model_name || d.model;
        if (tName) {
          if (!rowDetailsData[tName]) rowDetailsData[tName] = [];
          rowDetailsData[tName].push(d);
        }
      });

      // 3. Evaluate formulas for THIS row
      const currentRowName = isMaster ? mainModelName : (currentRow.model_name || currentRow.model);
      
      fields.forEach(field => {
        const tokens = field.config?.content?.formula_tokens || [];
        if (tokens.length === 0) return;

        const isMasterZone = !field.model_name || !mainModelName || field.model_name.toLowerCase() === mainModelName.toLowerCase();

        // Check if this field belongs to this row
        if (isMaster) {
          if (!isMasterZone) return;
        } else {
          const detailTableName = field.model_name;
          if (currentRowName?.toLowerCase() !== detailTableName?.toLowerCase()) return;
        }

        const mappedRow = { ...parentData, ...currentRow };
        if (currentRowName) {
          Object.keys(currentRow).forEach(k => {
            mappedRow[`${currentRowName}.${k}`] = currentRow[k];
          });
        }

        const computedValue = evaluateFormula(tokens, mappedRow, rowDetailsData, currentRow, currentRowName);
        if (computedValue !== null && computedValue !== undefined && String(computedValue) !== String(currentRow[field.db_column_name])) {
          currentRow[field.db_column_name] = computedValue;
          hasChanges = true;
        }
      });

      return { row: currentRow, hasChanges };
    };

    const result = evaluateRowFormulas(formData, formData, true);
    
    if (result.hasChanges) {
      setFormData(result.row);
    }
  }, [formData, fields]);
  return {
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
  };
}
