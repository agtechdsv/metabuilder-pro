import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'
import { getModelSchemaName } from '@/components/runtime/utils/schemaHelper'

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
  buttonsConfig?: any[]
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
  setIsDeleteModalOpen,
  buttonsConfig = []
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
      const MASTER_INTERNAL = new Set(['_details', 'model_name', 'display_model_name', '_isnew', '_origrow', '_tempid'])
      const masterOtherTableNames = new Set(
        (project?.models || [])
          .map((m: any) => (m.db_table_name || m.table_name || m.name || '').toLowerCase())
          .filter((name: string) => name && name !== modelName.toLowerCase())
      )
      const masterJoinedTableNames = new Set(
        (joins || [])
          .map((j: any) => (j.to || j.toTable || j.table || '').toLowerCase())
          .filter((name: string) => name && name !== modelName.toLowerCase())
      )
      const masterModelDef = project?.models?.find((m: any) => 
        m.db_table_name?.toLowerCase() === modelName?.toLowerCase() || m.name?.toLowerCase() === modelName?.toLowerCase()
      )
      const masterValidColsMap = new Map<string, string>()
      if (masterModelDef?.fields) {
        masterModelDef.fields.forEach((f: any) => {
          const col = (f.db_column_name || '').split('.').pop()
          if (col) masterValidColsMap.set(col.toLowerCase(), col)
        })
      }

      const sanitizedData: any = {}
      for (const [k, v] of Object.entries(formData)) {
        const lowKey = k.toLowerCase()
        const isJsonStr = typeof v === 'string' && (
          (v.trim().startsWith('{') && v.trim().endsWith('}')) ||
          (v.trim().startsWith('[') && v.trim().endsWith(']'))
        )

        if (
          MASTER_INTERNAL.has(lowKey) ||
          k.startsWith('_') ||           // skip _key, _details, etc.
          k.startsWith('virt_') ||
          k.includes('.') ||             // skip table-prefixed duplicates
          lowKey === pkName.toLowerCase() ||
          lowKey === cleanPkName.toLowerCase() ||
          lowKey === actualPkKey.toLowerCase() ||
          lowKey === 'created_at' ||
          lowKey === 'updated_at' ||
          v === undefined ||
          typeof v === 'object' ||       // skip objects and arrays (joined relations)
          masterOtherTableNames.has(lowKey) ||
          masterJoinedTableNames.has(lowKey) ||
          (masterValidColsMap.size > 0 && !masterValidColsMap.has(lowKey))
        ) continue

        const newValue = (v === null || v === '' || (typeof v === 'string' && v.trim() === '')) ? null : (typeof v === 'number' ? v : String(v))

        // Dirty tracking: envia apenas os campos que foram realmente alterados!
        if (action === 'update' && selectedRow) {
          const originalRaw = selectedRow[k] ?? selectedRow[lowKey] ?? selectedRow[k.toUpperCase()]
          const originalValue = (originalRaw === null || originalRaw === '' || String(originalRaw).trim() === '') ? null : String(originalRaw)
          const newValueString = newValue === null ? null : String(newValue)
          if (newValueString === originalValue) continue
        }

        const finalKey = masterValidColsMap.has(lowKey) ? masterValidColsMap.get(lowKey)! : k
        sanitizedData[finalKey] = newValue
      }

      // Remove duplicate keys (case insensitive), keep the first one
      const dedupedMaster: any = {}
      for (const [k, v] of Object.entries(sanitizedData)) {
        const lowerK = k.toLowerCase()
        const existing = Object.keys(dedupedMaster).find(x => x.toLowerCase() === lowerK)
        if (!existing) dedupedMaster[k] = v
      }
      for (const k of Object.keys(sanitizedData)) delete sanitizedData[k]
      for (const [k, v] of Object.entries(dedupedMaster)) sanitizedData[k] = v

      // Convert number fields for Master Data
      for (const [k, v] of Object.entries(sanitizedData)) {
        if (v !== null && v !== '') {
          const fieldDef = masterModelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
          const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
          const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
          if (isNumber && typeof v === 'string') {
            const parsed = Number(v.replace(/\./g, '').replace(',', '.'))
            sanitizedData[k] = isNaN(parsed) ? Number(v) : parsed
          } else if (isNumber) {
            sanitizedData[k] = Number(v)
          }
        }
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
              let payloadData = currentData
              let payloadIdCol = actualPkKey
              if (project?.db_type === 'oracle') {
                payloadData = {}
                for (const [k, v] of Object.entries(currentData)) {
                  payloadData[k.toUpperCase()] = v
                }
                payloadIdCol = actualPkKey.toUpperCase()
              }

              const payload: any = {
                queryId: attemptQueryId,
                table: modelName,
                tableName: modelName, 
                action,
                data: payloadData,
                record: payloadData, 
                query: currentQuery, 
                sql: currentQuery, 
                idColumn: payloadIdCol,
                idValue: pkValue,
                token: project?.secret_token || 'test-token',
                schemaName: getModelSchemaName(project, modelName),
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

          const modelDef = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === rowTable?.toLowerCase())
          let rowPkField = modelDef?.fields?.find((f: any) => f.is_primary_key)
          
          if (!rowPkField) {
            rowPkField = detailFields.find(f => f.model_name?.toLowerCase() === rowTable?.toLowerCase() && f.is_primary_key)
          }

          const rowPkName = rowPkField?.db_column_name?.split('.').pop() || 'id'
          
          let actualRowPkName = rowPkName
          if (row[rowPkName] !== undefined) actualRowPkName = rowPkName
          else if (row[rowPkName.toUpperCase()] !== undefined) actualRowPkName = rowPkName.toUpperCase()
          else if (row[rowPkName.toLowerCase()] !== undefined) actualRowPkName = rowPkName.toLowerCase()
          else if (row.ID !== undefined) actualRowPkName = 'ID'
          else if (row.id !== undefined) actualRowPkName = 'id'

          const rowPkVal = row[actualRowPkName]

          const SKIP = new Set(['_details', 'model_name', 'display_model_name', '_isnew', '_origrow', '_tempid'])
          const detailOtherTableNames = new Set(
            (project?.models || [])
              .map((m: any) => (m.db_table_name || m.table_name || m.name || '').toLowerCase())
              .filter((name: string) => name && name !== rowTable.toLowerCase())
          )
          const detailJoinedTableNames = new Set(
            (joins || [])
              .map((j: any) => (j.to || j.toTable || j.table || '').toLowerCase())
              .filter((name: string) => name && name !== rowTable.toLowerCase())
          )
          const detailValidColsMap = new Map<string, string>()
          if (modelDef?.fields) {
            modelDef.fields.forEach((f: any) => {
              const col = (f.db_column_name || '').split('.').pop()
              if (col) detailValidColsMap.set(col.toLowerCase(), col)
            })
          }
          if (detailFields) {
            detailFields
              .filter((f: any) => f.model_name?.toLowerCase() === rowTable.toLowerCase())
              .forEach((f: any) => {
                const col = (f.db_column_name || '').split('.').pop()
                if (col) detailValidColsMap.set(col.toLowerCase(), col)
              })
          }

          const sanitized: any = {}
          for (const [k, v] of Object.entries(row)) {
            const lk = k.toLowerCase()
            const isJsonStr = typeof v === 'string' && (
              (v.trim().startsWith('{') && v.trim().endsWith('}')) ||
              (v.trim().startsWith('[') && v.trim().endsWith(']'))
            )

            if (
              SKIP.has(lk) || k.startsWith('_') || k.startsWith('virt_') ||
              k.includes('.') || lk === rowPkName.toLowerCase() || lk === actualRowPkName.toLowerCase() ||
              lk === 'created_at' || lk === 'updated_at' ||
              v === undefined || typeof v === 'object' ||
              detailOtherTableNames.has(lk) ||
              detailJoinedTableNames.has(lk) ||
              (detailValidColsMap.size > 0 && !detailValidColsMap.has(lk))
            ) continue

            const newVal = (v === null || v === '' || (typeof v === 'string' && v.trim() === '')) ? null : (typeof v === 'number' ? v : String(v))

            // Dirty tracking
            const origRow = row._origRow || (
              origParentRow?._details?.find(
                (d: any) => d[actualRowPkName] === rowPkVal || d[rowPkName.toUpperCase()] === rowPkVal || d.id === rowPkVal || d.ID === rowPkVal
              )
            )
            if (!isNew && origRow) {
              const origRaw = origRow[k] ?? origRow[lk] ?? origRow[k.toUpperCase()]
              const origVal = (origRaw === null || origRaw === '' || String(origRaw).trim() === '') ? null : String(origRaw)
              if (newVal === origVal) continue // Se for igual, pula
            }

            const finalKey = detailValidColsMap.has(lk) ? detailValidColsMap.get(lk)! : k
            sanitized[finalKey] = newVal
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
                || (project?.db_type === 'oracle' ? fkCol.toUpperCase() : fkCol)

              if (isNew) {
                sanitized[actualFkCol] = String(parentPkVal)
              }
            }
          }

          // Remove duplicate keys (case insensitive), keep the first one
          const dedupedSanitized: any = {}
          for (const [k, v] of Object.entries(sanitized)) {
            const lowerK = k.toLowerCase()
            const existing = Object.keys(dedupedSanitized).find(x => x.toLowerCase() === lowerK)
            if (!existing) dedupedSanitized[k] = v
          }
          for (const k of Object.keys(sanitized)) delete sanitized[k]
          for (const [k, v] of Object.entries(dedupedSanitized)) sanitized[k] = v

          for (const [k, v] of Object.entries(sanitized)) {
            if (v !== null && v !== '') {
              let fieldDef = modelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
              if (!fieldDef && detailFields) {
                fieldDef = detailFields.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
              }
              const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
              const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
              if (isNumber && typeof v === 'string') {
                const parsed = Number(v.replace(/\./g, '').replace(',', '.'))
                sanitized[k] = isNaN(parsed) ? Number(v) : parsed
              } else if (isNumber) {
                sanitized[k] = Number(v)
              }
            }
          }

          let sql = ''
          if (!isNew && rowPkVal && Object.keys(sanitized).length > 0) {
            const set = Object.entries(sanitized)
              .map(([k, v]) => {
                if (v === null || v === '') return `${k} = NULL`
                const fieldDef = modelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
                const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
                const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
                if (isNumber) sanitized[k] = Number(v)
                return isNumber ? `${k} = ${v}` : `${k} = '${String(v).replace(/'/g, "''")}'`
              })
              .join(', ')
            sql = `UPDATE ${rowTable} SET ${set} WHERE ${actualRowPkName} = '${String(rowPkVal).replace(/'/g, "''")}'`
          } else if (isNew && Object.keys(sanitized).length > 0) {
            const keys = Object.keys(sanitized).join(', ')
            const vals = Object.entries(sanitized)
              .map(([k, v]) => {
                if (v === null || v === '') return 'NULL'
                const fieldDef = modelDef?.fields?.find((f: any) => f.db_column_name?.toLowerCase() === k.toLowerCase())
                const typeStr = fieldDef?.db_data_type?.toLowerCase() || ''
                const isNumber = fieldDef && (typeStr.startsWith('number') || typeStr.startsWith('numeric') || typeStr.startsWith('int') || typeStr.startsWith('float') || typeStr.startsWith('decimal') || typeStr.startsWith('double') || typeStr.startsWith('real'))
                if (isNumber) sanitized[k] = Number(v)
                return isNumber ? `${v}` : `'${String(v).replace(/'/g, "''")}'`
              })
              .join(', ')
            sql = `INSERT INTO ${rowTable} (${keys}) VALUES (${vals})`
          }

          if (sql) {
            const qId = crypto.randomUUID()
            await new Promise<void>((resolve, reject) => {
              let done = false
              const onResult = (payload: any) => {
                if (payload.payload?.queryId === qId) { 
                  done = true; 
                  cleanup(); 
                  if (payload.payload.success !== false) {
                    resolve() 
                  } else {
                    reject(new Error(payload.payload.error || 'Erro no túnel ao salvar detalhe'))
                  }
                }
              }
              const cleanup = () => {
                try {
                  const b = channel.bindings?.broadcast
                  if (Array.isArray(b)) channel.bindings.broadcast = b.filter((x: any) => x.callback !== onResult)
                } catch (_) {}
              }
              channel.on('broadcast', { event: `query_result_${qId}` }, onResult)
              channel.on('broadcast', { event: 'sql_result' }, onResult)
              let payloadData = sanitized
              let payloadIdCol = actualRowPkName
              if (project?.db_type === 'oracle') {
                payloadData = {}
                for (const [k, v] of Object.entries(sanitized)) {
                  payloadData[k.toUpperCase()] = v
                }
                payloadIdCol = actualRowPkName.toUpperCase()
              }

              channel.send({
                type: 'broadcast',
                event: 'sql_query',
                payload: {
                  queryId: qId,
                  table: rowTable, tableName: rowTable,
                  action: isNew ? 'insert' : 'update',
                  data: payloadData, record: payloadData,
                  query: sql, sql,
                  idColumn: payloadIdCol, idValue: rowPkVal,
                  token: project?.secret_token || 'test-token',
                  schemaName: getModelSchemaName(project, rowTable),
                  slug: project?.slug
                }
              })
              setTimeout(() => { if (!done) { done = true; cleanup(); resolve() } }, 4000)
            })
          }

          if (Array.isArray(row._details) && row._details.length > 0) {
            const origRow = row._origRow || origParentRow?._details?.find(
              (d: any) => d[rowPkName] === rowPkVal || d[rowPkName.toUpperCase()] === rowPkVal || d.id === rowPkVal || d.ID === rowPkVal
            )
            await saveNestedDetails(row._details, rowTable, rowPkVal, origRow ? { _details: origRow._details } : undefined)
          }
        }
      }

      if (formData._details && formData._details.length > 0) {
        await saveNestedDetails(formData._details, modelName, masterId, selectedRow)
      }
      console.timeEnd('handleSave_details')

      setIsProcessing(false)
      if (isTemporary) {
        supabase.removeChannel(channel)
      }

      const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embedded') === 'true'

      if (isEmbedded) {
        window.parent.postMessage({
          type: 'CLOSE_MODAL',
          action,
          id: String(selectedRow?.id || formData?.id || ''),
          payload: formData,
          updatedRecord: { ...formData, id: selectedRow?.id || formData?.id },
        }, '*')
      } else if (isCadastroOnly) {
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
      
      const btnDelete = buttonsConfig?.find((b: any) => b.id === 'delete')
      const cascade = btnDelete?.cascade_delete

      let queries: string[] = []
      
      if (cascade && projectRelations && projectRelations.length > 0) {
        // Opção 2 (Santo Graal) - Gera os deletes bottom-up usando subqueries.
        // Mapeia todos os relacionamentos para encontrar a hierarquia (níveis).
        const childRelations = new Map<string, { table: string, fk: string, pk: string }[]>()
        
        projectRelations.forEach((r: any) => {
           const parentModelDef = project?.models?.find((m: any) => m.id === r.master_model_id || m.id === r.to_model_id)
           const childModelDef = project?.models?.find((m: any) => m.id === r.detail_model_id || m.id === r.from_model_id)
           if (parentModelDef && childModelDef) {
              const pTable = (parentModelDef.db_table_name || parentModelDef.name).toLowerCase()
              const cTable = (childModelDef.db_table_name || childModelDef.name).toLowerCase()
              
              const parentPkField = parentModelDef.fields?.find((f: any) => f.id === (r.referenced_column_id || r.to_field_id))
              const childFkField = childModelDef.fields?.find((f: any) => f.id === (r.foreign_column_id || r.from_field_id))
              
              if (parentPkField && childFkField) {
                 if (!childRelations.has(pTable)) childRelations.set(pTable, [])
                 childRelations.get(pTable)!.push({
                    table: childModelDef.db_table_name || childModelDef.name,
                    fk: childFkField.db_column_name || childFkField.name,
                    pk: parentPkField.db_column_name || parentPkField.name
                 })
              }
           }
        })

        // Build a dependency tree starting from actualModelName
        const order: string[] = []
        const buildQueries = (parentTbl: string, parentCondition: string, path: string[]) => {
           const safeParentTbl = (parentTbl || '').toLowerCase()
           if (!safeParentTbl || path.includes(safeParentTbl)) return // Cycle detection
           
           const currentPath = [...path, safeParentTbl]
           const children = childRelations.get(safeParentTbl) || []
           
           for (const child of children) {
              if (!child.table) continue
              const childCondition = `${child.fk} IN (SELECT ${child.pk} FROM ${parentTbl} WHERE ${parentCondition})`
              buildQueries(child.table, childCondition, currentPath)
              queries.push(`DELETE FROM ${child.table} WHERE ${childCondition}`)
           }
        }
        
        buildQueries(actualModelName, `${actualPkKey} = '${String(pkValue).replace(/'/g, "''")}'`, [])
        
        // Filter unique queries (we only need to delete from a path once if it's the same condition)
        queries = Array.from(new Set(queries))
      }

      queries.push(`DELETE FROM ${actualModelName} WHERE ${actualPkKey} = '${String(pkValue).replace(/'/g, "''")}'`)
      
      const rawQuery = queries.join('; ')

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
              action: cascade ? 'execute_custom' : 'delete',
              query: rawQuery,
              sql: rawQuery,
              token: project?.secret_token || 'test-token',
              schemaName: getModelSchemaName(project, actualModelName),
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
        if (errorMsg.includes('foreign key constraint') || errorMsg.includes('violates foreign key') || errorMsg.includes('chave estrangeira') || errorMsg.includes('ORA-02292')) {
          const defaultFkError = t('runtime.delete_fk_error', 'Não é possível excluir este registro pois ele possui relacionamentos ativos (chave estrangeira).')
          errorMsg = getFkErrorMessage(errorMsg, defaultFkError)
        }
        toast(errorMsg, 'error')
      }
    } catch (error: any) {
      console.error('Error deleting:', error)
      toast(`Erro interno ao excluir: ${error?.message || 'Erro desconhecido'}`, 'error')
      setIsProcessing(false)
    }
  }

  return { handleSave, handleDelete, getFkErrorMessage }
}
