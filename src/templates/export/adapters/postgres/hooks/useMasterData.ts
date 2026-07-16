import { useToast } from '@/components/ui/Toast'

interface UseMasterDataProps {
  project?: any;
  modelName?: string;
  primaryKeyName?: string;
  drawerMode?: string;
  selectedRow?: any;
  t?: any;
  setIsProcessing?: any;
  setRefreshKey?: any;
  setOpen?: (val: boolean) => void;
  setIsPageVisible?: any;
  [key: string]: any;
}

export function useMasterData({
  project, modelName, primaryKeyName = 'id', drawerMode, selectedRow, t,
  setIsProcessing, setRefreshKey, setOpen, setIsPageVisible
}: UseMasterDataProps) {
  const { toast } = useToast()

  const handleSave = async (formData: any) => {
    setIsProcessing?.(true)
    try {
      const action = drawerMode === 'create' ? 'insert' : 'update'
      const cleanPkName = primaryKeyName.split('.').pop() || 'id'
      const pkValue = formData[primaryKeyName] ?? formData[cleanPkName] ?? formData.id

      const sanitizedData: any = {}
      for (const [k, v] of Object.entries(formData)) {
        if (k.startsWith('_') || k.includes('.') || v === undefined || typeof v === 'object') continue
        if (action === 'update' && k.toLowerCase() === cleanPkName.toLowerCase()) continue
        sanitizedData[k] = (v === '' ? null : v)
      }

      const method = action === 'insert' ? 'POST' : 'PUT'
      const res = await fetch(`/api/${modelName}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'insert' ? sanitizedData : { pkValue, data: sanitizedData })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erro na operação')
      }

      const savedData = await res.json().catch(() => ({}))
      let masterId = pkValue
      if (action === 'insert' && savedData) {
        masterId = savedData[cleanPkName] || savedData.id || pkValue
      }

      // --- SALVAR DETALHES INLINE ---
      const saveNestedDetails = async (detailRows: any[], parentTable: string, parentPkVal: any) => {
        for (const row of detailRows) {
          const rowTable = row.model_name
          if (!rowTable) continue

          const isNew = row._isNew
          const rowPkName = 'id' // Fallback
          const rowPkVal = row[rowPkName] ?? row.ID

          const SKIP = new Set(['_details', 'model_name', 'display_model_name', '_isNew'])
          const childSanitized: any = {}
          
          for (const [k, v] of Object.entries(row)) {
            const lk = k.toLowerCase()
            if (SKIP.has(lk) || k.startsWith('_') || k.startsWith('virt_') || k.includes('.') || lk === rowPkName.toLowerCase() || lk === 'created_at' || lk === 'updated_at' || v === undefined || typeof v === 'object') continue
            childSanitized[k] = (v === null || v === '' || String(v).trim() === '') ? null : String(v)
          }

          if (isNew && parentPkVal !== undefined && parentPkVal !== null) {
            let fkCol = parentTable.endsWith('s') ? `${parentTable.slice(0, -1)}_id` : `${parentTable}_id`
            if (project?.models) {
              const childModel = project.models.find((m: any) => m.db_table_name === rowTable)
              if (childModel?.fields) {
                const possibleFk = childModel.fields.find((f: any) => f.db_column_name.toLowerCase().includes(parentTable.replace(/s$/, '').toLowerCase()) && f.db_column_name.toLowerCase().endsWith('_id'))
                if (possibleFk) fkCol = possibleFk.db_column_name
              }
            }
            childSanitized[fkCol] = String(parentPkVal)
          }

          let childPkToPass = rowPkVal
          if (Object.keys(childSanitized).length > 0 || !isNew) {
            const childMethod = isNew ? 'POST' : 'PUT'
            const childRes = await fetch(`/api/${rowTable}`, {
              method: childMethod,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(isNew ? childSanitized : { pkValue: rowPkVal, data: childSanitized })
            }).catch(e => console.error("Erro ao salvar detalhe:", e))
            
            if (childRes && childRes.ok && isNew) {
              const childSavedData = await childRes.json().catch(() => ({}))
              if (childSavedData) {
                childPkToPass = childSavedData[rowPkName] || childSavedData.id || rowPkVal
              }
            }
          }

          if (Array.isArray(row._details) && row._details.length > 0) {
            await saveNestedDetails(row._details, rowTable, childPkToPass)
          }
        }
      }

      if (formData._details && formData._details.length > 0) {
        await saveNestedDetails(formData._details, modelName || '', masterId)
      }
      // --------------------------------

      toast(t('runtime.record_saved_success', 'Registro salvo com sucesso'), 'success')
      setRefreshKey?.((prev: number) => prev + 1)
      setOpen?.(false)
      setIsPageVisible?.(false)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsProcessing?.(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedRow) return
    setIsProcessing?.(true)
    try {
      const cleanPkName = primaryKeyName.split('.').pop() || 'id'
      const pkValue = selectedRow[primaryKeyName] ?? selectedRow[cleanPkName] ?? selectedRow.id
      
      const res = await fetch(`/api/${modelName}?id=${pkValue}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erro ao excluir')
      }

      toast(t('runtime.record_deleted_success', 'Registro excluído'), 'success')
      setRefreshKey?.((prev: number) => prev + 1)
      setOpen?.(false)
      setIsPageVisible?.(false)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsProcessing?.(false)
    }
  }

  const getFkErrorMessage = (errorMsg: string, fallbackMsg: string) => {
    return fallbackMsg
  }

  return { handleSave, handleDelete, getFkErrorMessage }
}
