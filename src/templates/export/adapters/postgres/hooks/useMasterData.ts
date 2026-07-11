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

      toast(t('runtime.record_saved_success') || 'Registro salvo com sucesso', 'success')
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

      toast(t('runtime.record_deleted_success') || 'Registro excluído', 'success')
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
