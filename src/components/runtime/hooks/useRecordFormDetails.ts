import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

interface UseRecordFormDetailsProps {
  joins: any[]
  projectId?: string
  tunnelChannel?: any
  isTunnelReady?: boolean
  project?: any
  secretToken?: string
  detailsItemTitles?: Record<string, string>
  setFormData: React.Dispatch<React.SetStateAction<any>>
}

export function useRecordFormDetails({
  joins = [],
  projectId,
  tunnelChannel,
  isTunnelReady,
  project,
  secretToken = 'test-token',
  detailsItemTitles = {},
  setFormData
}: UseRecordFormDetailsProps) {
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [loadingSubDetails, setLoadingSubDetails] = useState<Record<string, boolean>>({})

  const fetchSubDetailsForRecord = async (detail: any, tableName: string, pkCol: string, pkValue: any) => {
    const subJoins = joins.filter(j => j.from?.toLowerCase() === tableName?.toLowerCase())
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

            let fetchJoins = (joins || []).filter(j => j.from?.toLowerCase() === join.to.toLowerCase())
          
            const modelId = project?.models?.find((m: any) => m.db_table_name === join.to)?.id
            const customField = detailsItemTitles?.[modelId || '']
            if (customField && customField.includes('.')) {
              const relatedTable = customField.split('.')[0]
              const hasJoin = fetchJoins.some(j => j.to === relatedTable || j.toTable === relatedTable)
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

  return {
    expandedDetails,
    setExpandedDetails,
    loadingSubDetails,
    setLoadingSubDetails,
    fetchSubDetailsForRecord
  }
}
