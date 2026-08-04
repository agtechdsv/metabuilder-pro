import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'

interface UseDetailDataProps {
  project: any
  modelName: string
  detailFields: any[]
  joins: any[]
  projectRelations: any[]
  tunnelChannel: any
  isTunnelReady: boolean
  supabase: any
  t: (key: string, fallback?: string) => string
  detailsItemTitles: Record<string, string>
  detailsInterfaceTypes: Record<string, string>
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>
  selectedRow: any
  setSelectedRow: React.Dispatch<React.SetStateAction<any>>
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>
  setDetailRefreshKey: React.Dispatch<React.SetStateAction<number>>
  getFkErrorMessage: (errorMsg: string, fallbackMsg: string) => string
  logicType?: string
  dictionary?: any
}

export function useDetailData({
  project,
  modelName,
  detailFields,
  joins,
  projectRelations,
  tunnelChannel,
  isTunnelReady,
  supabase,
  t,
  detailsItemTitles,
  detailsInterfaceTypes,
  setIsProcessing,
  selectedRow,
  setSelectedRow,
  setRefreshKey,
  setDetailRefreshKey,
  getFkErrorMessage,
  logicType,
  dictionary = {}
}: UseDetailDataProps) {
  const { toast } = useToast()

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [isDetailDeleteModalOpen, setIsDetailDeleteModalOpen] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<any>(null)
  const [detailFieldsToRender, setDetailFieldsToRender] = useState<any[]>([])
  const [detailModalMode, setDetailModalMode] = useState<'create' | 'edit'>('edit')
  const [currentDetailTable, setCurrentDetailTable] = useState('')
  const [parentRowIdForDetail, setParentRowIdForDetail] = useState<any>(null)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  const [detailHistory, setDetailHistory] = useState<any[]>([])
  const [activeTabForDetail, setActiveTabForDetail] = useState<string>('master')

  const fetchDetails = async (parentRow: any, parentModel: string) => {
    let effectiveJoins = joins || []
    
    // ── DIAGNOSTIC ──────────────────────────────────────────────────────────────
    console.log('[🔍 fetchDetails] START')
    console.log('[🔍 fetchDetails] parentModel:', parentModel, '| db_type:', project?.db_type)
    console.log('[🔍 fetchDetails] parentRow keys:', Object.keys(parentRow || {}))
    console.log('[🔍 fetchDetails] parentRow (first 300):', JSON.stringify(parentRow).slice(0, 300))
    console.log('[🔍 fetchDetails] joins prop:', JSON.stringify(joins))
    console.log('[🔍 fetchDetails] projectRelations count:', projectRelations?.length)
    // ────────────────────────────────────────────────────────────────────────────

    // 1. Fallback via Santo Graal (Banco de Dados)
    if (effectiveJoins.length === 0 && projectRelations && project.models) {
      const parentModelDef = project.models.find((m: any) => m.db_table_name?.toLowerCase() === parentModel?.toLowerCase())
      console.log('[🔍 fetchDetails] Santo Graal - parentModelDef found:', !!parentModelDef, 'projectRelations count:', projectRelations.length)
      if (parentModelDef) {
        const related = projectRelations.filter((rel: any) => rel.to_model_id === parentModelDef.id || rel.master_model_id === parentModelDef.id)
        console.log('[🔍 fetchDetails] Santo Graal - related relations:', related.length)
        const auto = related.map((rel: any) => {
          const fromModelId = rel.from_model_id || rel.detail_model_id
          const toModelId = rel.to_model_id || rel.master_model_id
          const fromFieldId = rel.from_field_id || rel.foreign_column_id // Fallback in case of old mapping
          const toFieldId = rel.to_field_id || rel.referenced_column_id

          const childModel = project.models.find((m: any) => m.id === fromModelId)
          const childField = childModel?.fields?.find((f: any) => f.id === fromFieldId)
          const parentField = parentModelDef.fields?.find((f: any) => f.id === toFieldId)
          
          if (!childModel || !childField || !parentField) {
            console.log(`[🔍 fetchDetails] Santo Graal - missing mapping for rel ${rel.id}:`, { childModel: !!childModel, childField: !!childField, parentField: !!parentField })
          }
          if (childModel && childField && parentField) {
            return {
              from: parentModelDef.db_table_name,
              localKey: parentField.db_column_name,
              to: childModel.db_table_name,
              foreignKey: childField.db_column_name
            }
          }
          return null
        }).filter(Boolean)
        if (auto.length > 0) effectiveJoins = auto
      }
    }
    console.log('[🔍 fetchDetails] effectiveJoins after Santo Graal:', JSON.stringify(effectiveJoins))

    // 2. Fallback via Heurística (Nomenclatura)
    if (effectiveJoins.length === 0 && project.models) {
      const parentModelDef = project.models.find((m: any) => m.db_table_name?.toLowerCase() === parentModel?.toLowerCase())
      if (parentModelDef) {
        const heuristicJoins: any[] = []
        for (const childModel of project.models) {
          if (childModel.id === parentModelDef.id) continue
          const fkField = childModel.fields?.find((f: any) => {
            const fName = (f.db_column_name || '').toLowerCase();
            const pName = (parentModelDef.db_table_name || '').toLowerCase();
            const fTbl = (f.foreign_key_table || '').toLowerCase();
            const isFkTblMatch = fTbl === pName;
            const isFNameExact = fName === `${pName}_id`;
            const isFNameS = (pName.endsWith('s') && fName === `${pName.slice(0, -1)}_id`);
            const isFNameEs = (pName.endsWith('es') && fName === `${pName.slice(0, -2)}_id`);
            
            // Log if we suspect this might be the field
            if (fName.includes('id') && childModel.db_table_name.toLowerCase() === 'produtos') {
               console.log(`[🔍 fetchDetails] Heuristic candidate - child: ${childModel.db_table_name}, field: ${fName}, fTbl: ${fTbl}, pName: ${pName}. Matches:`, { isFkTblMatch, isFNameExact, isFNameS, isFNameEs })
            }

            return isFkTblMatch || isFNameExact || isFNameS || isFNameEs;
          })
          const pkField = parentModelDef.fields?.find((f: any) => (f.db_column_name || '').toLowerCase() === 'id') || parentModelDef.fields?.[0]
          if (fkField && pkField) {
            heuristicJoins.push({
              from: parentModelDef.db_table_name,
              localKey: pkField.db_column_name,
              to: childModel.db_table_name,
              foreignKey: fkField.db_column_name
            })
          }
        }
        console.log('[🔍 fetchDetails] Heuristic joins found:', heuristicJoins.length)
        if (heuristicJoins.length > 0) effectiveJoins = heuristicJoins
      }
    }

    if (!effectiveJoins || effectiveJoins.length === 0) {
       console.log('[🔍 fetchDetails] NO JOINS RESOLVED! effectiveJoins is empty. Returning [] early.')
       return []
    }

    const allDetails: any[] = []
    
    for (const join of effectiveJoins) {
      const isMatch = join.from?.toLowerCase() === parentModel?.toLowerCase()

      if (isMatch) {
        const localValue = parentRow[join.localKey] || parentRow[join.localKey.toUpperCase()] || parentRow.id || parentRow.ID
        
        console.log('[🔍 fetchDetails] ▶ join:', JSON.stringify(join))
        console.log('[🔍 fetchDetails]   localKey:', join.localKey, '→ raw:', parentRow[join.localKey], '| UC:', parentRow[join.localKey?.toUpperCase?.()], '| resolved:', localValue)

        if (localValue === undefined || localValue === null) {
          console.warn('[🔍 fetchDetails] ⚠️ localValue is NULL — skipping join! This is likely the bug.')
          continue
        }

        const queryId = crypto.randomUUID()
        
        const subDetailJoins = (joins || []).filter((j: any) =>
          j.from?.toLowerCase() === join.to?.toLowerCase()
        )

        const detailModel = (project as any)?.models?.find((m: any) => {
          const tbl = (m.db_table_name || m.table_name || '').toLowerCase();
          return tbl === join.to?.toLowerCase();
        })
        const detailModelId = detailModel?.id
        const titleField = detailsItemTitles?.[detailModelId || '']
        // titleJoins: ONLY the join needed to resolve the dot-notation title field.
        // We keep this separate from subDetailJoins (which are joins for fetching child records),
        // so we never accidentally JOIN child tables when fetching the current detail level.
        const titleJoins: any[] = []
        if (titleField && titleField.includes('.')) {
          const relatedTable = titleField.split('.')[0]
          const existingJoin = subDetailJoins.find((j: any) => j.to?.toLowerCase() === relatedTable.toLowerCase())
          if (existingJoin) {
            titleJoins.push(existingJoin)
          } else if (detailModel) {
            // ── Santo Graal first: find the relation explicitly defined in project.relations ──
            let linkField: any = null
            const projectRelations = (project as any)?.relations
            if (projectRelations?.length > 0 && (project as any)?.models) {
              const rel = projectRelations.find((r: any) => {
                const fromId = r.from_model_id || r.detail_model_id
                const toId   = r.to_model_id   || r.master_model_id
                if (fromId !== detailModel.id) return false
                const toModel = (project as any).models.find((m: any) => m.id === toId)
                return toModel && (toModel.db_table_name || toModel.table_name || '').toLowerCase() === relatedTable.toLowerCase()
              })
              if (rel) {
                const fromFieldId = rel.from_field_id || rel.foreign_column_id
                linkField = detailModel.fields?.find((f: any) => f.id === fromFieldId)
              }
            }
            // ── Fallback: name heuristic only if Santo Graal has nothing ──
            if (!linkField) {
              const pName = (relatedTable || '').toLowerCase()
              linkField = detailModel.fields?.find((f: any) => {
                const fName = (f.db_column_name || '').toLowerCase()
                const fTbl  = (f.foreign_key_table || '').toLowerCase()
                return fTbl === pName ||
                  fName === `${pName}_id` ||
                  (pName.endsWith('s')  && fName === `${pName.slice(0, -1)}_id`) ||
                  (pName.endsWith('es') && fName === `${pName.slice(0, -2)}_id`)
              })
            }
            if (linkField) {
              const titleJoin = {
                from: join.to,
                localKey: linkField.db_column_name,
                to: relatedTable,
                foreignKey: linkField.foreign_key_column || 'id'
              }
              subDetailJoins.push(titleJoin)  // keep for tunnel path
              titleJoins.push(titleJoin)       // use only this for postgres path
            }
          }
        }
        
        let detailData: any[] = []
        if (project?.id && project.db_type !== 'postgres') {
          try {
            detailData = await new Promise<any[]>((resolve, reject) => {
            const isTemporary = !tunnelChannel || !isTunnelReady
            const channelName = `tunnel:${project.id}`
            const channel = isTemporary ? wrapChannelWithChunking(supabase.channel(channelName)) : tunnelChannel
            let resolved = false

            const handleResult = (payload: any) => {
              if (payload.payload?.queryId === queryId) {
                resolved = true
                cleanup()
                if (payload.payload.success) {
                  console.log('[🔍 fetchDetails] ✅ Tunnel response. Rows:', (payload.payload.data || []).length)
                  resolve(payload.payload.data || [])
                } else {
                  console.error('[🔍 fetchDetails] ❌ Tunnel error:', payload.payload.error)
                  reject(new Error(payload.payload.error || 'Error fetching details'))
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
                  supabase.removeChannel(channel)
                }
              } catch (err) {}
            }

            channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
            channel.on('broadcast', { event: 'sql_result' }, handleResult)

            const sendPayload = {
              type: 'broadcast',
              event: 'sql_query',
              payload: {
                queryId,
                table: join.to,
                action: 'select',
                token: project?.secret_token || 'test-token',
                schemaName: project?.models?.find((m: any) => m.db_table_name === join.to)?.db_schema_name || project?.slug || 'public',
                slug: project?.slug,
                filters: { [join.foreignKey]: String(localValue) },
                joins: titleJoins,
                limit: 100,
                offset: 0
              }
            }

            console.log('[🔍 fetchDetails] 📡 Sending tunnel payload:', JSON.stringify({
              table: join.to,
              filter: { [join.foreignKey]: String(localValue) },
              schemaName: project?.models?.find((m: any) => m.db_table_name === join.to)?.db_schema_name || project?.slug || 'public',
              joins: titleJoins
            }))

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
                cleanup()
                console.warn('[🔍 fetchDetails] ⏱️ TIMEOUT (8s) — no response for join:', JSON.stringify(join))
                resolve([])
              }
            }, 8000)
          })
        } catch (err) {
          console.error(`[MetaBuilder] Error fetching details from ${join.to} via tunnel:`, err)
        }
        } else {
          try {
             const allJoins = [...(titleJoins || []), ...(subDetailJoins || [])];
             const uniqueJoins = Array.from(new Set(allJoins.map((j: any) => j.to))).map(to => allJoins.find((j: any) => j.to === to));
             
             
             console.log('[DEBUG useDetailData] Fetching sub-details for', join.to, 'uniqueJoins:', uniqueJoins);
             
             if (project?.db_type === 'postgres') {
               const url = new URL(`${window.location.origin}/api/${join.to}`)
               url.searchParams.set('limit', '1000')
               url.searchParams.set(`filter_${join.foreignKey}`, String(localValue))
               if (uniqueJoins.length > 0) {
                 url.searchParams.set('joins', JSON.stringify(uniqueJoins))
               }
               const res = await fetch(url.toString())
               const json = await res.json()
               if (json.data) detailData = json.data
            } else {
              let selectStr = '*'
              if (uniqueJoins.length > 0) {
                selectStr += ', ' + uniqueJoins.map((j: any) => `${j.to}(*)`).join(', ')
              }
              const { data: directData } = await (supabase as any)
                .from(join.to)
                .select(selectStr)
                .eq(join.foreignKey, String(localValue))
              if (directData) detailData = directData
            }
          } catch (err) {
            console.error(`[MetaBuilder] Error fetching details directly from ${join.to}:`, err)
          }
        }

        if (detailData) {
          const modelField = detailFields.find(f => f.db_column_name.includes(join.to) || f.model_name?.toLowerCase() === join.to?.toLowerCase())
          const friendlyName = dictionary[modelField?.model_id || ''] || join.to

          allDetails.push(...detailData.map((d: any) => ({ 
            ...d, 
            model_name: join.to,
            display_model_name: friendlyName
          })))
        }
      }
    }
    
    const seen = new Set()
    return allDetails.filter(d => {
      // Use model_name + id as composite key to avoid false duplicates
      // when different tables share the same numeric ID (common in Oracle/SQL Server)
      const rawId = d.id ?? d.ID
      const compositeKey = rawId !== undefined && rawId !== null
        ? `${d.model_name || ''}:${rawId}`
        : null
      if (!compositeKey) return true
      if (seen.has(compositeKey)) return false
      seen.add(compositeKey)
      return true
    })
  }

  const handleOpenAddDetail = (tableName: string, parentId?: any) => {
    if (selectedDetail && (isDetailModalOpen || isDetailDrawerOpen)) {
      setDetailHistory(prev => [...prev, {
        record: selectedDetail,
        tableName: currentDetailTable,
        fields: detailFieldsToRender,
        activeTab: activeTabForDetail
      }])
    }

    setIsDetailModalOpen(false)
    setIsDetailDrawerOpen(false)

    setDetailFieldsToRender(detailFields)
    setSelectedDetail({})
    setDetailModalMode('create')
    setCurrentDetailTable(tableName)
    setParentRowIdForDetail(parentId || (selectedRow?.id || selectedRow?.ID))
    setActiveTabForDetail('master')
    
    const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === tableName.toLowerCase())
    const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
    
    setTimeout(() => {
      if (interfaceType === 'drawer') setIsDetailDrawerOpen(true)
      else setIsDetailModalOpen(true)
    }, 0)
  }

  const handleEditDetail = async (detail: any) => {
    if (selectedDetail && (isDetailModalOpen || isDetailDrawerOpen)) {
      setDetailHistory(prev => [...prev, {
        record: selectedDetail,
        tableName: currentDetailTable,
        fields: detailFieldsToRender,
        activeTab: activeTabForDetail
      }])
    }

    setIsDetailModalOpen(false)
    setIsDetailDrawerOpen(false)
    
    setIsProcessing(true)
    const subDetails = await fetchDetails(detail, detail.model_name)
    
    setDetailFieldsToRender(detailFields)
    setSelectedDetail({ ...detail, _details: subDetails })
    setDetailModalMode('edit')
    setCurrentDetailTable(detail.model_name)
    setActiveTabForDetail('master')
    setParentRowIdForDetail(null)
    setIsProcessing(false)
    
    const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === detail.model_name?.toLowerCase())
    const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
    
    setTimeout(() => {
      if (interfaceType === 'drawer') setIsDetailDrawerOpen(true)
      else setIsDetailModalOpen(true)
    }, 0)
  }

  const handleCloseDetail = () => {
    if (detailHistory.length > 0) {
      const last = detailHistory[detailHistory.length - 1]
      setDetailHistory(prev => prev.slice(0, -1))
      setSelectedDetail(last.record)
      setCurrentDetailTable(last.tableName)
      setDetailFieldsToRender(last.fields)
      setActiveTabForDetail(last.activeTab || 'master')
      setDetailModalMode('edit')
      
      const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === last.tableName?.toLowerCase())
      const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
      
      if (interfaceType === 'drawer') {
        setIsDetailDrawerOpen(true)
        setIsDetailModalOpen(false)
      } else {
        setIsDetailModalOpen(true)
        setIsDetailDrawerOpen(false)
      }
    } else {
      setIsDetailModalOpen(false)
      setIsDetailDrawerOpen(false)
      setSelectedDetail(null)
      setActiveTabForDetail('master')
    }
  }

  const handleDeleteDetail = (detail: any) => {
    setItemToDelete(detail)
    setIsDetailDeleteModalOpen(true)
  }

  const handleConfirmDeleteDetail = async () => {
    if (!itemToDelete) return
    setIsProcessing(true)

    const tableName = itemToDelete.model_name
    const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
    const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
    const basePkName = pkField.db_column_name.split('.').pop() || 'id'
    
    let actualPkKey = basePkName
    if (itemToDelete[basePkName] !== undefined) actualPkKey = basePkName
    else if (itemToDelete[basePkName.toUpperCase()] !== undefined) actualPkKey = basePkName.toUpperCase()
    else if (itemToDelete[basePkName.toLowerCase()] !== undefined) actualPkKey = basePkName.toLowerCase()
    else if (itemToDelete.ID !== undefined) actualPkKey = 'ID'
    else if (itemToDelete.id !== undefined) actualPkKey = 'id'

    const pkValue = itemToDelete[actualPkKey]

    try {
      let result: { success: boolean; error?: string } = { success: false }

      if (project?.db_type === 'postgres') {
        const res = await fetch(`/api/${tableName}?id=${pkValue}`, { method: 'DELETE' })
        if (!res.ok) { 
          const err = await res.json()
          result = { success: false, error: err.error || 'Erro ao excluir' } 
        } else {
          result = { success: true }
        }
      } else {
        const queryId = crypto.randomUUID()
        const rawQuery = `DELETE FROM ${tableName} WHERE ${actualPkKey} = '${String(pkValue).replace(/'/g, "''")}'`

        result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          const isTemp = !tunnelChannel || !isTunnelReady
          const channelName = `tunnel:${project.id}`
          const channel = isTemp ? wrapChannelWithChunking(supabase.channel(channelName)) : tunnelChannel
          let settled = false

          const handleResult = (payload: any) => {
            if (payload.payload?.queryId === queryId) {
              settled = true
              cleanup()
              resolve({ success: payload.payload.success, error: payload.payload.error })
            }
          }

          const cleanup = () => {
            try {
              const bindings = channel.bindings?.broadcast
              if (Array.isArray(bindings)) {
                channel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
              }
              if (isTemp) {
                channel.unsubscribe()
                supabase.removeChannel(channel)
              }
            } catch (_) {}
          }

          channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
          channel.on('broadcast', { event: 'sql_result' }, handleResult)

          const doSend = () => {
            channel.send({
              type: 'broadcast',
              event: 'sql_query',
              payload: {
                queryId,
                table: tableName,
                action: 'delete',
                query: rawQuery,
                sql: rawQuery,
                token: project?.secret_token || 'test-token',
                schemaName: project?.models?.find((m: any) => m.db_table_name === tableName)?.db_schema_name || project?.slug || 'public',
                slug: project?.slug,
                idColumn: actualPkKey,
                idValue: pkValue
              }
            })
          }

          if (isTemp) {
            channel.subscribe((status: string) => { if (status === 'SUBSCRIBED') doSend() })
          } else {
            doSend()
          }

          setTimeout(() => {
            if (!settled) {
              settled = true
              cleanup()
              resolve({ success: false, error: 'Timeout' })
            }
          }, 9000)
        })
      }

      setIsDetailDeleteModalOpen(false)
      setIsProcessing(false)
      setItemToDelete(null)

      if (result.success) {
        setRefreshKey(prev => prev + 1)
        setDetailRefreshKey(prev => prev + 1)
        toast(t('runtime.delete_success', 'Registro excluído com sucesso!'), 'success')

        let freshParentRecord: any = null
        if (detailHistory.length > 0) {
          const lastIdx = detailHistory.length - 1
          const pRec = detailHistory[lastIdx].record
          const pTab = detailHistory[lastIdx].tableName
          if (pRec && pTab) {
            const freshDetails = await fetchDetails(pRec, pTab)
            freshParentRecord = { ...pRec, _details: freshDetails }
            const newHistory = [...detailHistory]
            newHistory[lastIdx].record = freshParentRecord
            setDetailHistory(newHistory)
          }
        }

        let freshMasterDetails: any[] = []
        if (selectedRow) {
          freshMasterDetails = await fetchDetails(selectedRow, modelName)
          setSelectedRow((prev: any) => prev ? { ...prev, _details: freshMasterDetails } : prev)
        }

      } else {
        let errorMsg = result.error || 'Erro ao excluir o registro.'
        if (errorMsg.includes('foreign key constraint') || errorMsg.includes('violates foreign key')) {
          const defaultFkError = t('runtime.delete_fk_error', 'Não é possível excluir este registro pois ele possui relacionamentos ativos (chave estrangeira).')
          errorMsg = getFkErrorMessage(errorMsg, defaultFkError)
        }
        toast(errorMsg, 'error')
      }
    } catch (error) {
      console.error('Error deleting detail:', error)
      setIsProcessing(false)
    }
  }

  const handleSaveDetail = async (formData: any) => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const isTemporary = !tunnelChannel || !isTunnelReady
    const channel = isTemporary ? wrapChannelWithChunking(supabase.channel(`tunnel:${project.id}`)) : tunnelChannel

    try {
      const action = detailModalMode
      const tableName = currentDetailTable
      const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
      
      const modelDef = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === tableName?.toLowerCase())
      let pkField = modelDef?.fields?.find((f: any) => f.is_primary_key)

      if (!pkField) {
        pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      }
      const basePkName = pkField?.db_column_name?.split('.').pop() || 'id'
      
      let actualPkKey = basePkName
      if (selectedDetail?.[basePkName] !== undefined) actualPkKey = basePkName
      else if (selectedDetail?.[basePkName.toUpperCase()] !== undefined) actualPkKey = basePkName.toUpperCase()
      else if (selectedDetail?.[basePkName.toLowerCase()] !== undefined) actualPkKey = basePkName.toLowerCase()
      else if (selectedDetail?.ID !== undefined) actualPkKey = 'ID'
      else if (selectedDetail?.id !== undefined) actualPkKey = 'id'

      const dPkValue = selectedDetail?.[actualPkKey]

      const INTERNAL_KEYS = new Set(['_details', 'model_name', 'display_model_name'])

      let rawQuery = ''
      const sanitizedData: any = {}
      for (const [k, v] of Object.entries(formData)) {
        const lowKey = k.toLowerCase()
        if (
          INTERNAL_KEYS.has(lowKey) ||
          k.startsWith('_') ||
          k.startsWith('virt_') ||
          k.includes('.') ||
          lowKey === actualPkKey.toLowerCase() ||
          lowKey === 'created_at' ||
          lowKey === 'updated_at' ||
          v === undefined ||
          typeof v === 'object'
        ) continue

        const newValue = (v === null || v === '' || (typeof v === 'string' && v.trim() === '')) ? null : (typeof v === 'number' ? v : String(v))

        if (action === 'edit' && selectedDetail) {
          const originalRaw = selectedDetail[k] ?? selectedDetail[lowKey] ?? selectedDetail[k.toUpperCase()]
          const originalValue = (originalRaw === null || originalRaw === '' || String(originalRaw).trim() === '') ? null : String(originalRaw)
          if (newValue === originalValue) continue
        }

        sanitizedData[k] = newValue
      }

      for (const [k, v] of Object.entries(sanitizedData)) {
        if (v !== null && v !== '') {
          const fieldDef = modelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
          const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
          const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
          if (isNumber) sanitizedData[k] = Number(v)
        }
      }

      if (action === 'create' && logicType === 'master_detail' && joins) {
        const join = joins.find(j => j.to?.toLowerCase() === tableName?.toLowerCase())
        if (join) {
          const parentId = parentRowIdForDetail || (selectedRow[join.localKey] || selectedRow[join.localKey.toUpperCase()] || selectedRow.id || selectedRow.ID)
          sanitizedData[join.foreignKey] = String(parentId)
        }
      }

      if (action === 'edit') {
        if (Object.keys(sanitizedData).length === 0) {
          console.warn(`[MetaBuilder:handleSaveDetail] No columns to update. Skipping parent update.`)
          rawQuery = ''
        } else {
          const setClause = Object.entries(sanitizedData)
            .map(([k, v]) => {
              if (v === null || v === '' || String(v).trim() === '') return `${k} = NULL`
              const fieldDef = modelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
              const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
              const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
              return isNumber ? `${k} = ${v}` : `${k} = '${String(v).replace(/'/g, "''")}'`
            })
            .join(', ')
          rawQuery = `UPDATE ${tableName} SET ${setClause} WHERE ${actualPkKey} = '${String(dPkValue).replace(/'/g, "''")}'`
        }
      } else {
        const keys = Object.keys(sanitizedData).join(', ')
        const values = Object.entries(sanitizedData)
          .map(([k, v]) => {
            if (v === null || v === '' || String(v).trim() === '') return 'NULL'
            const fieldDef = modelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
            const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
            const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
            return isNumber ? `${v}` : `'${String(v).replace(/'/g, "''")}'`
          })
          .join(', ')
        rawQuery = `INSERT INTO ${tableName} (${keys}) VALUES (${values})`
      }

      const parseGeneratedColError = (err: string): string | null => {
        const m = err?.match(/[""]([^"""]+)["""]/)
        return m ? m[1] : null
      }

      const GENERATED_COLS_KEY = `__mb_gen_cols_${tableName}`
      const cachedGenCols: string[] = JSON.parse(sessionStorage.getItem(GENERATED_COLS_KEY) || '[]')
      for (const gc of cachedGenCols) {
        delete sanitizedData[gc]
      }

      const sendWithRetry = async (): Promise<boolean> => {
        if (project?.db_type === 'postgres') {
          try {
            const method = action === 'edit' ? 'PUT' : 'POST'
            const payload = action === 'edit' ? { pkValue: dPkValue, data: sanitizedData } : sanitizedData
            
            if (Object.keys(sanitizedData).length === 0) return true
            
            const res = await fetch(`/api/${tableName}`, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
            if (!res.ok) {
              const err = await res.json()
              toast(err.error || 'Erro ao salvar', 'error')
              return false
            }
            return true
          } catch (err: any) {
            toast(err.message || 'Erro ao salvar', 'error')
            return false
          }
        }

        let currentData = { ...sanitizedData }
        let attempts = 0
        const MAX_RETRIES = 5

        while (attempts < MAX_RETRIES) {
          attempts++
          if (Object.keys(currentData).length === 0) {
            return true
          }

          const setClause = Object.entries(currentData)
            .map(([k, v]) => {
              if (v === null || v === '' || String(v).trim() === '') return `${k} = NULL`
              const fieldDef = modelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
              const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
              const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
              return isNumber ? `${k} = ${v}` : `${k} = '${String(v).replace(/'/g, "''")}'`
            })
            .join(', ')
            
          const insertKeys = Object.keys(currentData).join(', ')
          const insertValues = Object.entries(currentData)
            .map(([k, v]) => {
              if (v === null || v === '' || String(v).trim() === '') return 'NULL'
              const fieldDef = modelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
              const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
              const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
              return isNumber ? `${v}` : `'${String(v).replace(/'/g, "''")}'`
            })
            .join(', ')
            
          const currentQuery = action === 'edit'
            ? `UPDATE ${tableName} SET ${setClause} WHERE ${actualPkKey} = '${String(dPkValue).replace(/'/g, "''")}'`
            : `INSERT INTO ${tableName} (${insertKeys}) VALUES (${insertValues})`

          const attemptQueryId = attempts === 1 ? queryId : crypto.randomUUID()

          const result = await new Promise<{ success: boolean; error?: string; data?: any[] }>((resolve) => {
            const isTemp = !tunnelChannel || !isTunnelReady
            const ch = isTemp ? wrapChannelWithChunking(supabase.channel(`tunnel:${project.id}`)) : tunnelChannel
            let settled = false

            const handleResult = (payload: any) => {
              if (payload.payload?.queryId === attemptQueryId) {
                settled = true
                cleanup()
                resolve({ success: payload.payload.success, error: payload.payload.error, data: payload.payload.data })
              }
            }

            const cleanup = () => {
              try {
                const bindings = ch.bindings?.broadcast
                if (Array.isArray(bindings)) {
                  ch.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
                }
                if (isTemp) { ch.unsubscribe(); supabase.removeChannel(ch) }
              } catch (_) {}
            }

            ch.on('broadcast', { event: `query_result_${attemptQueryId}` }, handleResult)
            ch.on('broadcast', { event: 'sql_result' }, handleResult)

            const doSend = () => {
              let payloadData = currentData
              let payloadIdCol = actualPkKey
              if (project?.db_type !== 'postgres') {
                payloadData = {}
                for (const [k, v] of Object.entries(currentData)) {
                  payloadData[k.toUpperCase()] = v
                }
                payloadIdCol = actualPkKey.toUpperCase()
              }

              ch.send({
                type: 'broadcast',
                event: 'sql_query',
                payload: {
                  queryId: attemptQueryId,
                  table: tableName,
                  action: action === 'edit' ? 'update' : 'insert',
                  data: payloadData,
                  sql: currentQuery,
                  idColumn: payloadIdCol,
                  idValue: dPkValue,
                  token: project?.secret_token || 'test-token',
                  schemaName: project?.models?.find((m: any) => m.db_table_name === tableName)?.db_schema_name || project?.slug || 'public',
                  slug: project?.slug
                }
              })
            }

            if (isTemp) {
              ch.subscribe((status: string) => { if (status === 'SUBSCRIBED') doSend() })
            } else {
              doSend()
            }

            setTimeout(() => {
              if (!settled) {
                settled = true
                cleanup()
                resolve({ success: false, error: 'Timeout' })
              }
            }, 9000)
          })

          if (result.success) {
            return true
          }

          const genCol = parseGeneratedColError(result.error || '')
          if (genCol && result.error?.includes('DEFAULT')) {
            if (!cachedGenCols.includes(genCol)) {
              cachedGenCols.push(genCol)
              sessionStorage.setItem(GENERATED_COLS_KEY, JSON.stringify(cachedGenCols))
            }
            delete currentData[genCol]
            continue
          }

          toast(result.error || 'Erro ao salvar', 'error')
          return false
        }

        toast('Não foi possível salvar após múltiplas tentativas.', 'error')
        return false
      }

      const saveSucceeded = await sendWithRetry()

      const saveNestedDetails = async (
        detailRows: any[],
        parentTable: string,
        parentPkVal: any,
        origParentRow?: any
      ): Promise<void> => {
        for (const row of detailRows) {
          const rowTable = row.model_name
          if (!rowTable) continue

          const isNew = row._isNew

          const rowPkField =
            detailFields.find(f => f.model_name?.toLowerCase() === rowTable?.toLowerCase() && f.is_primary_key) ||
            { db_column_name: 'id' }
          const rowPkName = rowPkField.db_column_name.split('.').pop() || 'id'
          const rowPkVal = row[rowPkName] ?? row[rowPkName.toUpperCase()] ?? row.id ?? row.ID

          const SKIP = new Set(['_details', 'model_name', 'display_model_name', '_isNew'])
          const sanitized: any = {}
          for (const [k, v] of Object.entries(row)) {
            const lk = k.toLowerCase()
            if (
              SKIP.has(lk) || k.startsWith('_') || k.startsWith('virt_') ||
              k.includes('.') || lk === rowPkName.toLowerCase() ||
              lk === 'created_at' || lk === 'updated_at' ||
              v === undefined || typeof v === 'object'
            ) continue

            const newVal = (v === null || v === '' || String(v).trim() === '') ? null : String(v)

            if (!isNew && origParentRow?._details) {
              const origRow = origParentRow._details.find(
                (d: any) => d[rowPkName] === rowPkVal || d[rowPkName.toUpperCase()] === rowPkVal || d.id === rowPkVal || d.ID === rowPkVal
              )
              if (origRow) {
                const origRaw = origRow[k] ?? origRow[lk] ?? origRow[k.toUpperCase()]
                const origVal = (origRaw === null || origRaw === '' || String(origRaw).trim() === '') ? null : String(origRaw)
                if (newVal === origVal) continue
              }
            }

            sanitized[k] = newVal
          }

          if (isNew && parentPkVal !== undefined && parentPkVal !== null) {
            let fkCol = ''

            if (projectRelations?.length > 0 && project?.models) {
              const parentModel = project.models.find((m: any) => m.db_table_name === parentTable)
              const childModel = project.models.find((m: any) => m.db_table_name === rowTable)
              if (parentModel && childModel) {
                const rel = projectRelations.find((r: any) =>
                  (r.from_model_id === parentModel.id && r.to_model_id === childModel.id) ||
                  (r.from_model_id === childModel.id && r.to_model_id === parentModel.id)
                )
                if (rel && rel.from_model_id === childModel.id) {
                  const f = childModel.fields?.find((f: any) => f.id === rel.from_field_id)
                  if (f) fkCol = f.db_column_name
                } else if (rel && rel.to_model_id === childModel.id) {
                  const f = childModel.fields?.find((f: any) => f.id === rel.to_field_id)
                  if (f) fkCol = f.db_column_name
                }
              }
            }

            if (!fkCol && joins?.length > 0) {
              const join = joins.find(j =>
                (j.to || j.toTable || j.table)?.toLowerCase() === rowTable?.toLowerCase() &&
                (j.from || j.table)?.toLowerCase() === parentTable?.toLowerCase()
              )
              if (join) fkCol = join.foreignKey || join.foreign_field || join.toOn || join.on
            }

            if (!fkCol && project?.models) {
              const childModel = project.models.find((m: any) => m.db_table_name === rowTable)
              const parentSingular = parentTable.endsWith('s') ? parentTable.slice(0, -1) : parentTable
              const possibleFk = childModel?.fields?.find(
                (f: any) => f.db_column_name.toLowerCase().includes(parentSingular.toLowerCase()) && f.db_column_name.toLowerCase().endsWith('_id')
              )
              if (possibleFk) fkCol = possibleFk.db_column_name
            }

            if (!fkCol) {
              fkCol = parentTable.endsWith('s') ? `${parentTable.slice(0, -1)}_id` : `${parentTable}_id`
            }

            if (fkCol) sanitized[fkCol] = String(parentPkVal)
          }

          let sql = ''
          if (!isNew && rowPkVal && Object.keys(sanitized).length > 0) {
            const set = Object.entries(sanitized)
              .map(([k, v]) => (v === null || v === '') ? `${k} = NULL` : `${k} = '${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            sql = `UPDATE ${rowTable} SET ${set} WHERE ${rowPkName} = '${String(rowPkVal).replace(/'/g, "''")}'`
          } else if (isNew && Object.keys(sanitized).length > 0) {
            const keys = Object.keys(sanitized).join(', ')
            const vals = Object.values(sanitized)
              .map(v => (v === null || v === '') ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            sql = `INSERT INTO ${rowTable} (${keys}) VALUES (${vals})`
          }

          if (sql) {
            if (project?.db_type === 'postgres') {
              const method = (!isNew && rowPkVal) ? 'PUT' : 'POST'
              const payload = method === 'PUT' ? { pkValue: rowPkVal, data: sanitized } : sanitized
              await fetch(`/api/${rowTable}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              })
              continue
            }

            const qId = crypto.randomUUID()
            await new Promise<void>((resolve) => {
              let done = false
              const onResult = (payload: any) => {
                if (payload.payload?.queryId === qId) { done = true; cleanup(); resolve() }
              }
              const cleanup = () => {
                try {
                  const b = channel.bindings?.broadcast
                  if (Array.isArray(b)) channel.bindings.broadcast = b.filter((x: any) => x.callback !== onResult)
                } catch (_) {}
              }
              channel.on('broadcast', { event: `query_result_${qId}` }, onResult)
              channel.on('broadcast', { event: 'sql_result' }, onResult)
              channel.send({
                type: 'broadcast',
                event: 'sql_query',
                payload: {
                  queryId: qId,
                  table: rowTable, tableName: rowTable,
                  action: isNew ? 'insert' : 'update',
                  data: sanitized, record: sanitized,
                  query: sql, sql,
                  idColumn: rowPkName, idValue: rowPkVal,
                  token: project?.secret_token || 'test-token',
                  schemaName: project?.models?.find((m: any) => m.db_table_name === rowTable)?.db_schema_name || project?.slug || 'public',
                  slug: project?.slug
                }
              })
              setTimeout(() => { if (!done) { done = true; cleanup(); resolve() } }, 4000)
            })
          }

          if (Array.isArray(row._details) && row._details.length > 0) {
            const origRow = origParentRow?._details?.find(
              (d: any) => d[rowPkName] === rowPkVal || d[rowPkName.toUpperCase()] === rowPkVal || d.id === rowPkVal || d.ID === rowPkVal
            )
            await saveNestedDetails(row._details, rowTable, rowPkVal, origRow ? { _details: origRow._details } : undefined)
          }
        }
      }

      if (saveSucceeded && formData._details && formData._details.length > 0) {
        await saveNestedDetails(formData._details, tableName, dPkValue, selectedDetail)
      }

      const parentHistory = [...detailHistory]

      if (saveSucceeded) {
        toast(
          detailModalMode === 'create'
            ? t('runtime.create_success', 'Registro criado com sucesso!')
            : t('runtime.update_success', 'Registro atualizado com sucesso!'),
          'success'
        )
        await new Promise(resolve => setTimeout(resolve, 300))
      } else {
        setIsProcessing(false)
        return
      }

      let freshParentRecord: any = null
      if (parentHistory.length > 0) {
        const lastIdx = parentHistory.length - 1
        const pRec = parentHistory[lastIdx].record
        const pTab = parentHistory[lastIdx].tableName
        if (pRec && pTab) {
          const freshDetails = await fetchDetails(pRec, pTab)
          freshParentRecord = { ...pRec, _details: freshDetails }
        }
      }

      let freshMasterDetails: any[] = []
      if (selectedRow) {
        freshMasterDetails = await fetchDetails(selectedRow, modelName)
        setSelectedRow((prev: any) => prev ? { ...prev, _details: freshMasterDetails } : prev)
      }

      if (parentHistory.length > 0) {
        const last = parentHistory[parentHistory.length - 1]
        const newHistory = parentHistory.slice(0, -1)
        const recordToShow = freshParentRecord || last.record

        setDetailHistory(newHistory)
        setSelectedDetail(recordToShow)
        setCurrentDetailTable(last.tableName)
        setDetailFieldsToRender(last.fields)
        setActiveTabForDetail(last.activeTab || 'master')
        setDetailModalMode('edit')

        const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === last.tableName?.toLowerCase())
        const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'

        if (interfaceType === 'drawer') {
          setIsDetailModalOpen(false)
          setIsDetailDrawerOpen(true)
        } else {
          setIsDetailDrawerOpen(false)
          setIsDetailModalOpen(true)
        }
      } else {
        setIsDetailModalOpen(false)
        setIsDetailDrawerOpen(false)
        setSelectedDetail(null)
      }

      setDetailRefreshKey(prev => prev + 1)
      setRefreshKey(prev => prev + 1)
      setIsProcessing(false)

    } catch (error: any) {
      console.error('Error saving detail:', error)
      toast(error.message || 'Erro ao salvar detalhe.', 'error')
      setIsProcessing(false)
    }
  }

  return {
    fetchDetails,
    isDetailModalOpen, setIsDetailModalOpen,
    isDetailDrawerOpen, setIsDetailDrawerOpen,
    isDetailDeleteModalOpen, setIsDetailDeleteModalOpen,
    selectedDetail, setSelectedDetail,
    detailFieldsToRender, setDetailFieldsToRender,
    detailModalMode, setDetailModalMode,
    currentDetailTable, setCurrentDetailTable,
    parentRowIdForDetail, setParentRowIdForDetail,
    itemToDelete, setItemToDelete,
    detailHistory, setDetailHistory,
    activeTabForDetail, setActiveTabForDetail,
    handleOpenAddDetail,
    handleEditDetail,
    handleCloseDetail,
    handleDeleteDetail,
    handleConfirmDeleteDetail,
    handleSaveDetail
  }
}
