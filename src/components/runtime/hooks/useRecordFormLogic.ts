import { useState, useEffect, useRef } from 'react'
import { evaluateFormula } from '@/lib/formulaEvaluator'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'

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
  isPageMode?: boolean;
}

export function useRecordFormLogic(props: UseRecordFormLogicProps) {
  const {
    mode, fields, initialData, onSave, onCancel, logicType, masterModelId, masterModelName,
    joins = [], initialTab = 'master', detailsItemTitles, projectId, secretToken,
    tunnelChannel, isTunnelReady, project, refreshTrigger, isPageMode = false
  } = props;
  const [formData, setFormData] = useState<any>(initialData || {})
  const [activeTab, setActiveTab] = useState<'master' | string>(initialTab)
  const { toast } = useToast()

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
    if (isEmbedded && isPageMode) {
      window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
    } else {
      onCancel()
    }
  }

  // Busca sub-detalhes de um registro sob demanda (lazy loading)
  // chamado ao expandir a cortina de um detalhe pela primeira vez
  const fetchSubDetailsForRecord = async (detail: any, tableName: string, pkCol: string, pkValue: any) => {
    let subJoins = joins.filter((j: any) => j.from?.toLowerCase() === tableName?.toLowerCase())

    if (subJoins.length === 0) return

    const supabaseClient = createClient()
    const allSubDetails: any[] = []

    for (const join of subJoins) {
      if (!pkValue) continue

      let data: any[] = []

      if (projectId && project?.db_type !== 'postgres') {
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
        // Fallback to direct fetch or supabase query
        try {
             // Auto-join ALL foreign keys of the sub-model so the UI fallback can find titles!
             const uniqueJoins: any[] = []
             const detailModel = (project as any)?.models?.find((m: any) => {
               const tbl = (m.db_table_name || m.table_name || '').toLowerCase();
               return tbl === join.to?.toLowerCase();
             })
             
             if (detailModel && detailModel.fields) {
                detailModel.fields.forEach((f: any) => {
                   let relatedTable = f.foreign_key_table || f.widget_options?.component?.rel_table || f.config?.component?.rel_table || f.config?.form_config?.component?.rel_table;
                   if (!relatedTable && f.db_column_name?.toLowerCase().endsWith('_id')) {
                      const base = f.db_column_name.toLowerCase().replace(/_id$/, '');
                      if ((project as any)?.models?.some((m: any) => (m.db_table_name || m.table_name) === base + 's')) relatedTable = base + 's';
                      else if ((project as any)?.models?.some((m: any) => (m.db_table_name || m.table_name) === base + 'es')) relatedTable = base + 'es';
                      else if ((project as any)?.models?.some((m: any) => (m.db_table_name || m.table_name) === base)) relatedTable = base;
                   }
                   const isValidModel = relatedTable ? (project as any)?.models?.some((m: any) => (m.db_table_name || m.table_name) === relatedTable) : false;
                   if (relatedTable && isValidModel && !uniqueJoins.find((j: any) => j.to === relatedTable)) {
                      uniqueJoins.push({
                         from: join.to,
                         localKey: f.db_column_name,
                         to: relatedTable,
                         foreignKey: f.foreign_key_column || 'id'
                      });
                   }
                });
             }

             console.log(`[DEBUG RecordFormLogic] Fetching sub-details for ${join.to} uniqueJoins:`, uniqueJoins)

          if (project?.db_type === 'postgres') {
             const url = new URL(`${window.location.origin}/api/${join.to}`)
             url.searchParams.set(`filter_${join.foreignKey}`, String(pkValue))
             if (uniqueJoins.length > 0) {
               url.searchParams.set('joins', JSON.stringify(uniqueJoins))
             }
             const res = await fetch(url.toString())
             const json = await res.json()
             if (json.data) data = json.data
          } else {
            let selectStr = '*'
            if (uniqueJoins.length > 0) {
              selectStr = '*, ' + uniqueJoins.map((j: any) => `${j.to}(*)`).join(', ')
            }
            const { data: directData } = await (supabaseClient as any)
              .from(join.to)
              .select(selectStr)
              .eq(join.foreignKey, String(pkValue))
            if (directData) data = directData
          }
        } catch (err) {
          console.error(`[MetaBuilder] Error fetching details directly from ${join.to}:`, err)
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

      const fieldsToFetch = [...fields]
      console.log(`[MetaBuilder:RecordForm] detailsItemTitles:`, detailsItemTitles);
      if (detailsItemTitles && project?.models) {
        Object.entries(detailsItemTitles).forEach(([mId, fieldName]) => {
          const baseName = fieldName.includes('.') ? fieldName.split('.')[0] : fieldName
          const safeBase = baseName?.toLowerCase()?.trim() || ''
          const model = project.models.find((m: any) => String(m.id) === String(mId))
          console.log(`[MetaBuilder:RecordForm] Checking detailsItemTitles for mId: ${mId}, safeBase: ${safeBase}, modelFound: ${!!model}`);
          if (model && model.fields) {
            const field = model.fields.find((f: any) => {
              const fName = f.db_column_name?.toLowerCase()?.trim() || ''
              const fLabel = f.display_name?.toLowerCase()?.trim() || f.label?.toLowerCase()?.trim() || ''
              if (fName === safeBase || fName.endsWith(`.${safeBase}`) || fName.endsWith(`_${safeBase}`)) return true;
              if (fLabel && (fLabel === safeBase || fLabel.includes(safeBase) || safeBase.includes(fLabel))) return true;
              const strippedName = fName.replace(/_id$/, '');
              if (strippedName === safeBase || safeBase.includes(strippedName) || strippedName.includes(safeBase.replace(/s$/, ''))) return true;
              const comp = f.config?.form_config?.component || f.config?.component || f.widget_options?.component;
              if (comp && comp.rel_table && comp.options_type !== 'enumeration') {
                  const relLabel = comp.rel_label?.toLowerCase() || '';
                  const relTable = comp.rel_table?.toLowerCase() || '';
                  if (relLabel && (relLabel === safeBase || safeBase.includes(relLabel))) return true;
                  const singularRelTable = relTable.endsWith('s') ? relTable.slice(0, -1) : relTable;
                  if (singularRelTable && safeBase.includes(singularRelTable) && (safeBase.includes('nome') || safeBase.includes('titulo'))) return true;
              }
              return false;
            })
            console.log(`[MetaBuilder:RecordForm] Field found for ${mId}:`, field?.db_column_name);
            if (field && !fieldsToFetch.find(f => f.id === field.id)) {
              fieldsToFetch.push({ ...field, model_id: model.id, model_name: model.db_table_name || model.table_name })
            }
          }
        })
      }

      console.log(`[MetaBuilder:RecordForm] fetchAllRelational trigger. fieldsToFetch mapped count: ${fieldsToFetch.length} | project db_type: ${project?.db_type}`);

      for (const field of fieldsToFetch) {
        const comp = field.config?.form_config?.component || field.config?.component || field.widget_options?.component;
        const isRelationalComp = comp && (
           comp.rel_table || 
           (['select', 'radio', 'checkbox', 'Combo (Select)', 'Radio Buttons', 'Checkbox Group'].includes(comp.type)) || 
           comp.options_type === 'relational' || 
           comp.options_type === 'enumeration'
        );
        if (isRelationalComp && comp.rel_table && comp.options_type !== 'enumeration') {
          try {
            if (projectId && project?.db_type !== 'postgres') {
              const queryId = crypto.randomUUID()
              const filterCol = comp.filter_column ? `, "${comp.filter_column}"` : ''
              const rawQuery = `SELECT "${comp.rel_label}", "${comp.rel_value}"${filterCol} FROM "${comp.rel_table}"`

              const schemaToUse = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === comp.rel_table?.toLowerCase())?.db_schema_name || project?.slug || 'public'
              console.log(`[MetaBuilder:RecordForm] Fetching relational options for ${comp.rel_table} with schemaName:`, schemaToUse)
              console.log(`[MetaBuilder:RecordForm] Query:`, rawQuery)

              const data = await new Promise<any[]>((resolve, reject) => {
                const isTemporary = !tunnelChannel || !isTunnelReady
                const channelName = `tunnel:${projectId}`
                const channel = isTemporary ? supabase.channel(channelName) : tunnelChannel
                let resolved = false
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
                       supabase.removeChannel(channel)
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
                channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
                channel.on('broadcast', { event: 'sql_result' }, handleResult)

                const sendPayload = {
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
                  value: item[comp.rel_value] || item[comp.rel_value.toLowerCase()] || item[comp.rel_value.toUpperCase()],
                  filter_value: comp.filter_column ? (item[comp.filter_column] || item[comp.filter_column.toLowerCase()] || item[comp.filter_column.toUpperCase()]) : undefined
                }))
              }
            } else {
              // Direct query or Postgres API fallback
              let relData = null
              if (project?.db_type === 'postgres') {
                 const res = await fetch(`/api/${comp.rel_table}?limit=1000`)
                 const json = await res.json()
                 if (json.data) relData = json.data
              } else {
                 const { data } = await (supabase as any).from(comp.rel_table).select('*').order(comp.rel_column)
                 relData = data
              }
              
              if (relData) {
                newOptions[field.id] = relData.map((item: any) => ({
                  label: item[comp.rel_label],
                  value: item[comp.rel_value],
                  filter_value: comp.filter_column ? item[comp.filter_column] : undefined
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
      
      // Auto-fill reverse dependencies (e.g. virtual category fields based on loaded product ID)
      setFormData((prev: any) => {
        let changed = false;
        const nextData = { ...prev };
        
        for (const field of fields) {
          const comp = field.config?.form_config?.component || field.config?.component || field.widget_options?.component;
          if (comp?.depends_on && comp?.filter_column && newOptions[field.id]) {
            const depName = comp.depends_on;
            const depBase = depName.split('.').pop() || depName;
            const fieldBase = field.db_column_name.split('.').pop() || field.db_column_name;
            
            // Check master fields
            const masterVal = nextData[field.db_column_name] || nextData[fieldBase];
            if (masterVal) {
              const currentDep = nextData[depName] ?? nextData[depBase] ?? nextData[depBase.toUpperCase()];
              if (currentDep === undefined || currentDep === null || currentDep === '') {
                const opt = newOptions[field.id].find((o: any) => String(o.value) === String(masterVal));
                if (opt && opt.filter_value) {
                  nextData[depName] = opt.filter_value;
                  nextData[depBase] = opt.filter_value;
                  changed = true;
                }
              }
            }

            // Check detail rows
            if (nextData._details && Array.isArray(nextData._details)) {
              nextData._details = nextData._details.map((row: any) => {
                let rowChanged = false;
                const newRow = { ...row };
                const fieldModelName = field.model_name || (field.db_column_name?.includes('.') ? field.db_column_name.split('.')[0] : null);
                if (row.model_name?.toLowerCase() === fieldModelName?.toLowerCase()) {
                  const rowVal = newRow[field.db_column_name] || newRow[fieldBase] || newRow[fieldBase.toUpperCase()];
                  if (rowVal) {
                    const isLocalDep = fields.some(f => (f.model_name?.toLowerCase() === row.model_name?.toLowerCase()) && (f.db_column_name === depName || f.id === depName));
                    
                    let currentDep = newRow[depName] ?? newRow[depBase] ?? newRow[depBase.toUpperCase()];
                    if (!isLocalDep) {
                      currentDep = currentDep ?? nextData[depName] ?? nextData[depBase];
                    }

                    if (currentDep === undefined || currentDep === null || currentDep === '') {
                      const opt = newOptions[field.id].find((o: any) => String(o.value) === String(rowVal));
                      if (opt && opt.filter_value) {
                        newRow[depName] = opt.filter_value;
                        newRow[depBase] = opt.filter_value;
                        rowChanged = true;
                        changed = true;
                      }
                    }
                  }
                }
                return rowChanged ? newRow : row;
              });
            }
          }
        }
        
        return changed ? nextData : prev;
      });
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
  // Só mostramos como aba as tabelas que são FILHAS DIRETAS do mestre atual no array de JOINS ou via heurística
  const effectiveJoins = Array.isArray(joins) && joins.length > 0 ? joins : (() => {
    if (!project?.models || !masterModelName) return [];
    const parentModelDef = project.models.find((m: any) => m.db_table_name?.toLowerCase() === masterModelName?.toLowerCase());
    if (!parentModelDef) return [];
    const heuristicJoins: any[] = [];
    for (const childModel of project.models) {
      if (childModel.id === parentModelDef.id) continue;
      const fkField = childModel.fields?.find((f: any) => {
            const fName = (f.db_column_name || '').toLowerCase();
            const pName = (parentModelDef.db_table_name || '').toLowerCase();
            const fTbl = (f.foreign_key_table || '').toLowerCase();
            return fTbl === pName ||
              fName === `${pName}_id` ||
              (pName.endsWith('s') && fName === `${pName.slice(0, -1)}_id`) ||
              (pName.endsWith('es') && fName === `${pName.slice(0, -2)}_id`);
          });
      if (fkField) {
        heuristicJoins.push({
          from: parentModelDef.db_table_name,
          to: childModel.db_table_name
        });
      }
    }
    return heuristicJoins;
  })();

  const detailTables = Array.from(new Set(
    detailFields
      .filter((f: any) => {
        if (masterModelName && f.model_name?.toLowerCase().trim() === masterModelName?.toLowerCase().trim()) return false;
        // Se não houver joins nem mesmo na heurística, mostra tudo (fallback antigo)
        if (effectiveJoins.length === 0) return true;
        // Verifica se existe um join de masterModelName -> f.model_name
        return effectiveJoins.some((j: any) => (j.from?.toLowerCase() === masterModelName?.toLowerCase()) && j.to?.toLowerCase() === f.model_name?.toLowerCase())
      })
      .map((f: any) => f.model_name || 'Details')
  ))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let payloadToSave = { ...formData }
    
    // ======== BPM SYNC EVENT ========
    // Se o túnel estiver pronto e tivermos os dados necessários, disparamos o fluxo síncrono.
    if (projectId && project?.db_type !== 'postgres' && tunnelChannel && isTunnelReady && masterModelName) {
      const eventType = mode === 'create' ? 'BEFORE_INSERT' : 'BEFORE_UPDATE';
      const queryId = crypto.randomUUID();
      
      try {
        const syncData = await new Promise<any>((resolve, reject) => {
          let resolved = false;
          
          const handleResult = (payload: any) => {
             if (payload.payload?.queryId === queryId) {
                resolved = true;
                cleanup();
                if (payload.payload.success) {
                   resolve(payload.payload.data ? payload.payload.data[0] : null);
                } else {
                   reject(new Error(payload.payload.error || 'Ação bloqueada pelo fluxo BPM.'));
                }
             }
          };

          const cleanup = () => {
             try {
                const bindings = tunnelChannel.bindings?.broadcast;
                if (Array.isArray(bindings)) {
                   const cleanBindings = bindings.filter((b: any) => {
                      const match = b.callback === handleResult;
                      if (match && tunnelChannel.channelAdapter) {
                         tunnelChannel.channelAdapter.off('broadcast', b.ref);
                      }
                      return !match;
                   });
                   tunnelChannel.bindings.broadcast = cleanBindings;
                }
             } catch(err) {}
          };

          tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult);
          tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult);
          
          tunnelChannel.send({
             type: 'broadcast',
             event: 'sql_query',
             payload: {
                queryId,
                action: 'trigger_bpm_sync',
                tableName: masterModelName,
                eventType,
                rowData: payloadToSave,
                token: secretToken
             }
          });
          
          setTimeout(() => {
             if (!resolved) {
                resolved = true;
                cleanup();
                console.warn(`[BPM] Timeout esperando validação síncrona do BPM (queryId: ${queryId}). Prosseguindo para não travar a tela...`);
                resolve(payloadToSave); // Continua se der timeout
             }
          }, 1000); // Reduzido de 8000 para 1000ms para evitar travamento da UI
        });
        
        if (syncData) {
           payloadToSave = syncData;
           if (payloadToSave._bpmMessage) {
              toast(payloadToSave._bpmMessage, 'info');
              delete payloadToSave._bpmMessage;
           }
        }
      } catch (err: any) {
        // Bloqueio! Ação abortada pelo BPM.
        toast(err.message, 'error');
        return; // ABORT SAVE
      }
    }
    // ======== END BPM SYNC EVENT ========

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
