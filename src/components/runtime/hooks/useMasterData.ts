import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'

interface UseMasterDataProps {
  project: any
  modelName: string
  primaryKeyName: string
  tunnelChannel: any
  isTunnelReady: boolean
  drawerMode: 'create' | 'edit' | 'view'
  selectedRow: any
  isCadastroOnly: boolean
  isPage: boolean
  detailFields: any[]
  projectRelations: any[]
  joins: any[]
  supabase: any
  t: (key: string, fallback?: string) => string
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>
  setSelectedRow: React.Dispatch<React.SetStateAction<any>>
  setDrawerMode: React.Dispatch<React.SetStateAction<'create' | 'edit' | 'view'>>
  setIsPageVisible: React.Dispatch<React.SetStateAction<boolean>>
  setRefreshKey: React.Dispatch<React.SetStateAction<number>>
  setOpen: (val: boolean) => void
  fetchDetails: (parentRow: any, parentModel: string) => Promise<any[]>
  setIsDeleteModalOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export function useMasterData({
  project,
  modelName,
  primaryKeyName,
  tunnelChannel,
  isTunnelReady,
  drawerMode,
  selectedRow,
  isCadastroOnly,
  isPage,
  detailFields,
  projectRelations,
  joins,
  supabase,
  t,
  setIsProcessing,
  setSelectedRow,
  setDrawerMode,
  setIsPageVisible,
  setRefreshKey,
  setOpen,
  fetchDetails,
  setIsDeleteModalOpen
}: UseMasterDataProps) {
  const { toast } = useToast()

  const handleSave = async (formData: any) => {
    setIsProcessing(true)
    console.time('handleSave_total')
    console.time('handleSave_master')
    const queryId = crypto.randomUUID()
    const isTemporary = !tunnelChannel || !isTunnelReady
    const channel = isTemporary ? wrapChannelWithChunking(supabase.channel(`tunnel:${project.id}`)) : tunnelChannel

    try {
      const action = drawerMode === 'create' ? 'insert' : 'update'

      const parseGeneratedColError = (err: string): string | null => {
        const m = err?.match(/[""]([^"""]+)["""]/)
        return m ? m[1] : null
      }

      const pkName = primaryKeyName
      const cleanPkName = pkName.split('.').pop() || 'id'
      
      let actualPkKey = pkName
      if (formData[pkName] !== undefined) actualPkKey = pkName
      else if (formData[cleanPkName] !== undefined) actualPkKey = cleanPkName
      else if (formData[pkName.toUpperCase()] !== undefined) actualPkKey = pkName.toUpperCase()
      else if (formData[pkName.toLowerCase()] !== undefined) actualPkKey = pkName.toLowerCase()
      else if (formData.ID !== undefined) actualPkKey = 'ID'
      else if (formData.id !== undefined) actualPkKey = 'id'
      else actualPkKey = cleanPkName

      const pkValue = formData[actualPkKey]
      
      const filters: any = {}
      if (action === 'update' && pkValue !== undefined && pkValue !== null) {
        filters[actualPkKey] = String(pkValue)
      }

      // Blacklist: exclude internal keys, system columns, PK, objects, and arrays.
      const MASTER_INTERNAL = new Set(['_details', 'model_name', 'display_model_name'])
      const sanitizedData: any = {}
      for (const [k, v] of Object.entries(formData)) {
        const lowKey = k.toLowerCase()
        if (
          MASTER_INTERNAL.has(lowKey) ||
          k.startsWith('_') ||           // skip _key, _details, etc.
          k.includes('.') ||             // skip table-prefixed duplicates
          lowKey === pkName.toLowerCase() ||
          lowKey === cleanPkName.toLowerCase() ||
          lowKey === actualPkKey.toLowerCase() ||
          lowKey === 'created_at' ||
          lowKey === 'updated_at' ||
          v === undefined ||
          typeof v === 'object'           // skip objects and arrays (joined relations)
        ) continue

        const newValue = (v === null || v === '' || String(v).trim() === '') ? null : String(v)

        // Dirty tracking: envia apenas os campos que foram realmente alterados!
        if (action === 'update' && selectedRow) {
          const originalRaw = selectedRow[k] ?? selectedRow[lowKey] ?? selectedRow[k.toUpperCase()]
          const originalValue = (originalRaw === null || originalRaw === '' || String(originalRaw).trim() === '') ? null : String(originalRaw)
          if (newValue === originalValue) continue
        }

        sanitizedData[k] = newValue
      }

      const sendWithRetry = async (): Promise<{ success: boolean; data?: any[] }> => {
        let currentData = { ...sanitizedData }
        let attempts = 0
        const MAX_RETRIES = 5

        while (attempts < MAX_RETRIES) {
          attempts++
          
          if (action === 'update' && Object.keys(currentData).length === 0) {
            console.warn(`[MetaBuilder:handleSave] No columns to update in master record. Skipping.`)
            return { success: true, data: [formData] }
          }

          // RAW SQL Builder
          let currentQuery = ''
          if (action === 'update' && pkValue && Object.keys(currentData).length > 0) {
            const setClause = Object.entries(currentData)
              .map(([k, v]) => (v === null || v === '' || String(v).trim() === '') ? `${k} = NULL` : `${k} = '${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            currentQuery = `UPDATE ${modelName} SET ${setClause} WHERE ${actualPkKey} = '${String(pkValue).replace(/'/g, "''")}' RETURNING *`
          } else if (action === 'insert' && Object.keys(currentData).length > 0) {
            const keys = Object.keys(currentData).join(', ')
            const values = Object.values(currentData)
              .map(v => (v === null || v === '' || String(v).trim() === '') ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            currentQuery = `INSERT INTO ${modelName} (${keys}) VALUES (${values}) RETURNING *`
          }

          const attemptQueryId = attempts === 1 ? queryId : crypto.randomUUID()
          
          let result: { success: boolean; error?: string; data?: any[] } = { success: false }
          
          if (project?.id && project?.db_type !== 'postgres') {

          result = await new Promise<{ success: boolean; error?: string; data?: any[] }>((resolve) => {
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
              const payload: any = {
                queryId: attemptQueryId,
                table: modelName,
                tableName: modelName, 
                action,
                data: currentData,
                record: currentData, 
                query: currentQuery, 
                sql: currentQuery, 
                idColumn: actualPkKey,
                idValue: pkValue,
                token: project?.secret_token || 'test-token',
                schemaName: project?.models?.find((m: any) => m.db_table_name === modelName)?.db_schema_name || project?.slug || 'public',
                slug: project?.slug
              }

              if (action === 'update' && Object.keys(filters).length > 0) {
                payload.filters = filters
                payload.where = filters
                payload.id = filters[pkName]
              }

              ch.send({
                type: 'broadcast',
                event: 'sql_query',
                payload
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
            return { success: true, data: result.data }
          }
          } else {
            // Direct DB fallback for Native Postgres / Supabase
            try {
              let directData;
              if (action === 'update') {
                 const { data, error } = await (supabase as any)
                   .from(modelName)
                   .update(currentData)
                   .eq(actualPkKey, String(pkValue))
                   .select('*')
                 if (error) throw error
                 directData = data
              } else {
                 const { data, error } = await (supabase as any)
                   .from(modelName)
                   .insert([currentData])
                   .select('*')
                 if (error) throw error
                 directData = data
              }
              return { success: true, data: directData }
            } catch (err: any) {
              console.error('[MetaBuilder] Error saving directly to db:', err)
              result = { success: false, error: err.message || 'Erro ao salvar direto' }
            }
          }

          const genCol = parseGeneratedColError(result.error || '')
          if (genCol && result.error?.includes('DEFAULT')) {
            delete currentData[genCol]
            continue
          }

          toast(result.error || 'Erro ao salvar', 'error')
          return { success: false }
        }

        toast('Não foi possível salvar após múltiplas tentativas.', 'error')
        return { success: false }
      }

      const saveResult = await sendWithRetry()
      console.timeEnd('handleSave_master')

      if (!saveResult.success) {
        setIsProcessing(false)
        console.timeEnd('handleSave_total')
        return
      }

      console.time('handleSave_details')
      // ----------------------------------------------------
      // SALVAR DETALHES INLINE (N níveis via recursão)
      // ----------------------------------------------------
      let masterId = pkValue
      if (action === 'insert' && saveResult.data && saveResult.data.length > 0) {
        masterId = saveResult.data[0][cleanPkName] || saveResult.data[0][pkName] || saveResult.data[0][cleanPkName.toUpperCase()] || saveResult.data[0].id || saveResult.data[0].ID
      }

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
          
          let actualRowPkName = rowPkName
          if (row[rowPkName] !== undefined) actualRowPkName = rowPkName
          else if (row[rowPkName.toUpperCase()] !== undefined) actualRowPkName = rowPkName.toUpperCase()
          else if (row[rowPkName.toLowerCase()] !== undefined) actualRowPkName = rowPkName.toLowerCase()
          else if (row.ID !== undefined) actualRowPkName = 'ID'
          else if (row.id !== undefined) actualRowPkName = 'id'

          const rowPkVal = row[actualRowPkName]

          const SKIP = new Set(['_details', 'model_name', 'display_model_name', '_isNew'])
          const sanitized: any = {}
          for (const [k, v] of Object.entries(row)) {
            const lk = k.toLowerCase()
            if (
              SKIP.has(lk) || k.startsWith('_') || k.startsWith('virt_') ||
              k.includes('.') || lk === rowPkName.toLowerCase() || lk === actualRowPkName.toLowerCase() ||
              lk === 'created_at' || lk === 'updated_at' ||
              v === undefined || typeof v === 'object'
            ) continue

            const newVal = (v === null || v === '' || String(v).trim() === '') ? null : String(v)

            // Dirty tracking
            if (!isNew && origParentRow?._details) {
              const origRow = origParentRow._details.find(
                (d: any) => d[actualRowPkName] === rowPkVal || d[rowPkName.toUpperCase()] === rowPkVal || d.id === rowPkVal || d.ID === rowPkVal
              )
              if (origRow) {
                const origRaw = origRow[k] ?? origRow[lk] ?? origRow[k.toUpperCase()]
                const origVal = (origRaw === null || origRaw === '' || String(origRaw).trim() === '') ? null : String(origRaw)
                if (newVal === origVal) continue // Se for igual, pula
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

            if (fkCol) {
              // Ajustar o Case da fkCol para bater com o banco, especialmente Oracle
              const lowerFk = fkCol.toLowerCase()
              const actualFkCol = Object.keys(row).find(k => k.toLowerCase() === lowerFk) 
                || (project?.db_type !== 'postgres' ? fkCol.toUpperCase() : fkCol)

              if (isNew) {
                sanitized[actualFkCol] = String(parentPkVal)
              } else if (Object.keys(sanitized).length > 0) {
                sanitized[actualFkCol] = String(parentPkVal)
              }
            }
          }

          let sql = ''
          if (!isNew && rowPkVal && Object.keys(sanitized).length > 0) {
            const set = Object.entries(sanitized)
              .map(([k, v]) => (v === null || v === '') ? `${k} = NULL` : `${k} = '${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            sql = `UPDATE ${rowTable} SET ${set} WHERE ${actualRowPkName} = '${String(rowPkVal).replace(/'/g, "''")}'`
          } else if (isNew && Object.keys(sanitized).length > 0) {
            const keys = Object.keys(sanitized).join(', ')
            const vals = Object.values(sanitized)
              .map(v => (v === null || v === '') ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            sql = `INSERT INTO ${rowTable} (${keys}) VALUES (${vals})`
          }

          if (sql) {
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
                  idColumn: actualRowPkName, idValue: rowPkVal,
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

      if (formData._details && formData._details.length > 0) {
        await saveNestedDetails(formData._details, modelName, masterId, selectedRow)
      }

      setIsProcessing(false)
      if (isTemporary) {
        supabase.removeChannel(channel)
      }

      if (isCadastroOnly) {
        if (action === 'insert') {
          setSelectedRow(null)
          setDrawerMode('create')
          setIsPageVisible(true)
          setRefreshKey(prev => prev + 1)
        } else {
          setSelectedRow((prev: any) => prev ? { ...prev, ...formData } : prev)
          setRefreshKey(prev => prev + 1)
        }
      } else if (isPage) {
        const updatedRow = { ...(selectedRow || {}), ...formData, [cleanPkName]: masterId }
        const freshDetails = await fetchDetails(updatedRow, modelName)
        setSelectedRow({ ...updatedRow, _details: freshDetails })
        setDrawerMode('edit')
        setRefreshKey(prev => prev + 1)
      } else {
        setOpen(false)
        setSelectedRow(null)
        setRefreshKey(prev => prev + 1)
      }

      toast(
        drawerMode === 'create'
          ? t('runtime.create_success', 'Registro criado com sucesso!')
          : t('runtime.update_success', 'Registro atualizado com sucesso!'),
        'success'
      )
      console.timeEnd('handleSave_total')
    } catch (error: any) {
      console.error('Error saving:', error)
      toast(error.message || 'Erro ao salvar o registro.', 'error')
      setIsProcessing(false)
      console.timeEnd('handleSave_total')
    }
  }

  const getFkErrorMessage = (errorMsg: string, fallbackMsg: string) => {
    const matches = [...errorMsg.matchAll(/table "([^"]+)"/g)]
    if (matches.length > 0) {
      const referencedTable = matches[matches.length - 1][1]
      let friendlyName = referencedTable
      if (project.models) {
        const tModel = project.models.find((m: any) => m.db_table_name?.toLowerCase() === referencedTable?.toLowerCase())
        if (tModel?.name) friendlyName = tModel.name
      }
      return t('runtime.delete_fk_error_with_table', 'Não é possível excluir. Este registro está sendo usado em: {table}').replace('{table}', friendlyName)
    }
    return fallbackMsg
  }

  const handleDelete = async () => {
    if (!selectedRow) return
    setIsProcessing(true)

    const cleanPk = (primaryKeyName || 'id').split('.').pop() || 'id'
    
    let actualPkKey = primaryKeyName || cleanPk
    if (selectedRow[primaryKeyName]) actualPkKey = primaryKeyName
    else if (selectedRow[cleanPk]) actualPkKey = cleanPk
    else if (selectedRow[primaryKeyName?.toUpperCase()]) actualPkKey = primaryKeyName.toUpperCase()
    else if (selectedRow[primaryKeyName?.toLowerCase()]) actualPkKey = primaryKeyName.toLowerCase()
    else if (selectedRow.ID) actualPkKey = 'ID'
    else if (selectedRow.id) actualPkKey = 'id'
    else actualPkKey = cleanPk

    const pkValue = selectedRow[actualPkKey]

    try {
      const queryId = crypto.randomUUID()
      const actualModelName = selectedRow.__model_name || modelName
      const rawQuery = `DELETE FROM ${actualModelName} WHERE ${actualPkKey} = '${String(pkValue).replace(/'/g, "''")}'`

      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
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
              table: actualModelName,
              action: 'delete',
              query: rawQuery,
              sql: rawQuery,
              token: project?.secret_token || 'test-token',
              schemaName: project?.models?.find((m: any) => m.db_table_name === actualModelName)?.db_schema_name || project?.slug || 'public',
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

      setIsDeleteModalOpen(false)
      setIsProcessing(false)

      if (result.success) {
        setRefreshKey(prev => prev + 1)
        toast(t('runtime.delete_success', 'Registro excluído com sucesso!'), 'success')
      } else {
        let errorMsg = result.error || 'Erro ao excluir o registro.'
        if (errorMsg.includes('foreign key constraint') || errorMsg.includes('violates foreign key') || errorMsg.includes('chave estrangeira')) {
          const defaultFkError = t('runtime.delete_fk_error', 'Não é possível excluir este registro pois ele possui relacionamentos ativos (chave estrangeira).')
          errorMsg = getFkErrorMessage(errorMsg, defaultFkError)
        }
        toast(errorMsg, 'error')
      }
    } catch (error) {
      console.error('Error deleting:', error)
      setIsProcessing(false)
    }
  }

  return { handleSave, handleDelete, getFkErrorMessage }
}
