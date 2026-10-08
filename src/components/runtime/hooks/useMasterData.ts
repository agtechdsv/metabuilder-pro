import { useToast } from '@/components/ui/Toast'
import { resolveFkColumn, warnFkResolution, missingRelationMessage } from '@/lib/schemaResolver'
import { readKey, isUntouchedAutoDetail } from '@/lib/detailRelations'
import { createClient } from '@/utils/supabase/client'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'
import { invalidateRelOptions } from '@/lib/relationalOptionsCache'
import { findBlockingTable, isForeignKeyError } from '@/lib/fkError'
import { planCascade, cascadeDeleteSql, cascadeCountSql, parseCascadeCounts } from '@/lib/cascadePlan'
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
          
          if (project?.id && (project?.db_type !== 'postgres' || tunnelChannel || isTunnelReady || project?.secret_token)) {

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
                token: project?.secret_token || '',
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
          // linha em branco que o formulário criou sozinho e o usuário não tocou: não vira registro no banco
          if (isUntouchedAutoDetail(row)) continue

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
            // FK do filho novo: relação declarada > join do caso de uso > metadado do campo (foreign_key_table).
            // Palpite por nome só como último recurso (e avisado). Sem nenhuma relação: erro claro, nunca coluna inventada.
            const fkRes = resolveFkColumn({ models: (project as any)?.models, relations: projectRelations, joins, childTable: rowTable, parentTable })
            warnFkResolution(fkRes, rowTable, parentTable)
            if (!fkRes.column) throw new Error(missingRelationMessage(rowTable, parentTable))
            let fkCol: string = fkRes.column

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

          // Linhas devolvidas pelo INSERT (trazem o ID gerado pelo banco, ex.: PK por DEFAULT no Oracle)
          let insertedRows: any[] | undefined
          if (sql) {
            const qId = crypto.randomUUID()
            insertedRows = await new Promise<any[] | undefined>((resolve, reject) => {
              let done = false
              const onResult = (payload: any) => {
                if (payload.payload?.queryId === qId) { 
                  done = true; 
                  cleanup(); 
                  if (payload.payload.success !== false) {
                    resolve(payload.payload.data)
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
                  token: project?.secret_token || '',
                  schemaName: getModelSchemaName(project, rowTable),
                  slug: project?.slug
                }
              })
              setTimeout(() => { if (!done) { done = true; cleanup(); resolve(undefined) } }, 4000)
            })
          }

          if (Array.isArray(row._details) && row._details.length > 0) {
            const origRow = row._origRow || origParentRow?._details?.find(
              (d: any) => d[rowPkName] === rowPkVal || d[rowPkName.toUpperCase()] === rowPkVal || d.id === rowPkVal || d.ID === rowPkVal
            )
            // Registro NOVO: o pai dos filhos é o ID gerado pelo banco no INSERT, nunca o id temporário da tela
            let childParentPk = rowPkVal
            if (isNew) {
              const inserted = insertedRows && insertedRows.length > 0 ? insertedRows[0] : null
              const generated = inserted ? (readKey(inserted, rowPkName) ?? readKey(inserted, actualRowPkName)) : undefined
              if (generated !== undefined && generated !== null) childParentPk = generated
              if (childParentPk === undefined || childParentPk === null || String(childParentPk).startsWith('temp-')) {
                throw new Error(`Não foi possível obter o ID gerado do novo registro de ${rowTable} para vincular os itens filhos. Nada foi salvo nos filhos.`)
              }
            }
            await saveNestedDetails(row._details, rowTable, childParentPk, origRow ? { _details: origRow._details } : undefined)
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

      invalidateRelOptions(project.id, modelName)
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
    const models: any[] = project.models || []
    const referencedTable = findBlockingTable(errorMsg, models.map((m: any) => m.db_table_name), modelName)
    if (referencedTable) {
      const tModel = models.find((m: any) => m.db_table_name?.toLowerCase() === referencedTable.toLowerCase())
      const friendlyName = tModel?.name || referencedTable
      return t('runtime.delete_fk_error_with_table', 'Não é possível excluir. Este registro está sendo usado em: {table}').replace('{table}', friendlyName)
    }
    return fallbackMsg
  }

  const resolvePkKey = (row: any): string => {
    const cleanPk = (primaryKeyName || 'id').split('.').pop() || 'id'
    if (row[primaryKeyName]) return primaryKeyName
    if (row[cleanPk]) return cleanPk
    if (row[primaryKeyName?.toUpperCase()]) return primaryKeyName.toUpperCase()
    if (row[primaryKeyName?.toLowerCase()]) return primaryKeyName.toLowerCase()
    if (row.ID) return 'ID'
    if (row.id) return 'id'
    return cleanPk
  }

  const isCascadeDelete = () => !!buttonsConfig?.find((b: any) => b.id === 'delete')?.cascade_delete

  /**
   * Com a exclusão em cascata ligada: o que será apagado junto com o registro (tabela e quantidade de cada filha).
   * [] = não há registros filhos; null = não foi possível contar (a confirmação avisa só que é em cascata).
   */
  const getCascadeSummary = async (row: any): Promise<Array<{ table: string; name: string; count: number }> | null> => {
    if (!row || !isCascadeDelete() || !projectRelations || projectRelations.length === 0) return []
    const pkKey = resolvePkKey(row)
    const rootTable = row.__model_name || modelName
    const models: any[] = project?.models || []
    const sql = cascadeCountSql(planCascade({ models, relations: projectRelations, rootTable, pkKey, pkValue: row[pkKey] }))
    if (!sql) return []

    const queryId = crypto.randomUUID()
    const rows = await new Promise<any[] | null>((resolve) => {
      const isTemp = !tunnelChannel || !isTunnelReady
      const channel = isTemp ? wrapChannelWithChunking(supabase.channel(`tunnel:${project.id}`)) : tunnelChannel
      let settled = false
      const finish = (value: any[] | null) => {
        if (settled) return
        settled = true
        try {
          const bindings = channel.bindings?.broadcast
          if (Array.isArray(bindings)) channel.bindings.broadcast = bindings.filter((b: any) => b.callback !== onResult)
          if (isTemp) { channel.unsubscribe(); supabase.removeChannel(channel) }
        } catch (_) {}
        resolve(value)
      }
      const onResult = (payload: any) => {
        if (payload.payload?.queryId !== queryId) return
        finish(payload.payload.success ? (payload.payload.data || []) : null)
      }
      channel.on('broadcast', { event: `query_result_${queryId}` }, onResult)
      const send = () => channel.send({
        type: 'broadcast',
        event: 'sql_query',
        payload: {
          queryId, table: rootTable, action: 'execute_custom', query: sql, sql, params: [],
          token: project?.secret_token || '', schemaName: getModelSchemaName(project, rootTable), slug: project?.slug,
        },
      })
      if (isTemp) channel.subscribe((status: string) => { if (status === 'SUBSCRIBED') send() })
      else send()
      setTimeout(() => finish(null), 6000)
    })
    if (!rows) return null
    return parseCascadeCounts(rows).map(c => {
      const m = models.find((x: any) => x.db_table_name?.toLowerCase() === c.table.toLowerCase())
      return { ...c, name: m?.name || c.table }
    })
  }

  const handleDelete = async () => {
    if (!selectedRow) return
    setIsProcessing(true)

    const actualPkKey = resolvePkKey(selectedRow)
    const pkValue = selectedRow[actualPkKey]

    try {
      const queryId = crypto.randomUUID()
      const actualModelName = selectedRow.__model_name || modelName
      
      const btnDelete = buttonsConfig?.find((b: any) => b.id === 'delete')
      const cascade = btnDelete?.cascade_delete

      const rootPk = `${actualPkKey} = '${String(pkValue).replace(/'/g, "''")}'`
      const queries: string[] = []
      if (cascade && projectRelations && projectRelations.length > 0) {
        queries.push(...cascadeDeleteSql(planCascade({ models: project?.models || [], relations: projectRelations, rootTable: actualModelName, pkKey: actualPkKey, pkValue })))
      }
      queries.push(`DELETE FROM ${actualModelName} WHERE ${rootPk}`)

      const rawQuery = queries.join('; ')

      const result = await new Promise<{ success: boolean; error?: string; rowsAffected?: number }>((resolve) => {
        const isTemp = !tunnelChannel || !isTunnelReady
        const channelName = `tunnel:${project.id}`
        const channel = isTemp ? wrapChannelWithChunking(supabase.channel(channelName)) : tunnelChannel
        let settled = false

        const handleResult = (payload: any) => {
          if (payload.payload?.queryId === queryId) {
            settled = true
            cleanup()
            resolve({ success: payload.payload.success, error: payload.payload.error, rowsAffected: payload.payload.rowsAffected })
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
              token: project?.secret_token || '',
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

      // Excluir nenhuma linha não é sucesso (era assim que um nome de tabela errado passava despercebido)
      if (result.success && !cascade && result.rowsAffected === 0) {
        toast(t('runtime.delete_not_found', 'Nenhum registro foi excluído: ele não foi encontrado.'), 'error')
      } else if (result.success) {
        invalidateRelOptions(project.id, modelName)
        setRefreshKey(prev => prev + 1)
        toast(t('runtime.delete_success', 'Registro excluído com sucesso!'), 'success')
      } else {
        let errorMsg = result.error || 'Erro ao excluir o registro.'
        if (isForeignKeyError(errorMsg)) {
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

  return { handleSave, handleDelete, getFkErrorMessage, getCascadeSummary }
}
