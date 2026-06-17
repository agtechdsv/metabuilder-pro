import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

interface UseRecordFormRelationalProps {
  fields: any[]
  isTunnelReady?: boolean
  tunnelChannel?: any
  project?: any
  projectId?: string
  secretToken?: string
  refreshTrigger?: number
}

export function useRecordFormRelational({
  fields,
  isTunnelReady,
  tunnelChannel,
  project,
  projectId,
  secretToken = 'test-token',
  refreshTrigger = 0
}: UseRecordFormRelationalProps) {
  const [relationalOptions, setRelationalOptions] = useState<Record<string, any[]>>({})

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
                  label: item[comp.rel_label] || item[comp.rel_label?.toLowerCase()] || item[comp.rel_label?.toUpperCase()],
                  value: item[comp.rel_value] || item[comp.rel_value?.toLowerCase()] || item[comp.rel_value?.toUpperCase()]
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

  return { relationalOptions }
}
