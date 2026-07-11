import { useToast } from '@/components/ui/Toast'

interface UseMasterDataProps {
  project?: any;
  modelName?: string;
  primaryKeyName?: string;
  drawerMode?: string;
  selectedRow?: any;
  supabase?: any;
  t?: any;
  setIsProcessing?: any;
  setRefreshKey?: any;
  setOpen?: (val: boolean) => void;
  setIsPageVisible?: any;
  [key: string]: any;
}

export function useMasterData({
  project,
  modelName,
  primaryKeyName = 'id',
  drawerMode,
  selectedRow,
  supabase,
  t,
  setIsProcessing,
  setRefreshKey,
  setOpen,
  setIsPageVisible
}: UseMasterDataProps) {
  const { toast } = useToast()

  const handleSave = async (formData: any) => {
    setIsProcessing(true)
    try {
      const action = drawerMode === 'create' ? 'insert' : 'update'
      const cleanPkName = primaryKeyName.split('.').pop() || 'id'
      const pkValue = formData[primaryKeyName] ?? formData[cleanPkName] ?? formData.id

      // Sanitize data (remove internal fields)
      const sanitizedData: any = {}
      for (const [k, v] of Object.entries(formData)) {
        if (k.startsWith('_') || k.includes('.') || v === undefined || typeof v === 'object') continue
        if (action === 'update' && k.toLowerCase() === cleanPkName.toLowerCase()) continue
        sanitizedData[k] = (v === '' ? null : v)
      }

      if (action === 'insert') {
        const { error } = await supabase.from(modelName).insert([sanitizedData])
        if (error) throw error
        toast(t('runtime.record_created_success') || 'Registro criado', 'success')
      } else {
        const { error } = await supabase.from(modelName).update(sanitizedData).eq(cleanPkName, pkValue)
        if (error) throw error
        toast(t('runtime.record_updated_success') || 'Registro atualizado', 'success')
      }

      setRefreshKey((prev: number) => prev + 1)
      setOpen(false)
      setIsPageVisible(false)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async (row: any) => {
    setIsProcessing?.(true)
    try {
      const cleanPkName = primaryKeyName.split('.').pop() || 'id'
      const pkValue = row[primaryKeyName] ?? row[cleanPkName] ?? row.id
      const { error } = await supabase.from(modelName).delete().eq(cleanPkName, pkValue)
      if (error) throw error
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
