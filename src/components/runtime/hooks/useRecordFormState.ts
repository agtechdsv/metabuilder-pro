import { useState, useEffect, useRef } from 'react'

interface UseRecordFormStateProps {
  initialData: any
  mode: 'create' | 'edit' | 'view'
  initialTab: string
  logicType?: string
  masterModelId?: string
  masterModelName?: string
  fields: any[]
  detailTables: string[]
  onSave: (data: any) => Promise<void>
  refreshTrigger?: number
  setExpandedDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

export function useRecordFormState({
  initialData,
  mode,
  initialTab,
  logicType,
  masterModelId,
  masterModelName,
  fields,
  detailTables,
  onSave,
  refreshTrigger,
  setExpandedDetails
}: UseRecordFormStateProps) {
  const [formData, setFormData] = useState<any>(initialData || {})
  const [activeTab, setActiveTab] = useState<'master' | string>(initialTab)
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
  }, [initialData, mode, logicType, masterModelId, fields, JSON.stringify(detailTables)])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const payloadToSave = { ...formData }
    Object.keys(payloadToSave).forEach(key => {
      if (key.startsWith('virt_') || fields.find((f: any) => f.db_column_name === key)?.is_virtual) {
        delete payloadToSave[key]
      }
    })

    console.log('[RecordForm] handleSubmit - payload keys:', Object.keys(payloadToSave), '| payload:', JSON.stringify(payloadToSave).slice(0, 500))
    onSave(payloadToSave)
  }

  return {
    formData,
    setFormData,
    activeTab,
    setActiveTab,
    formRef,
    handleSubmit
  }
}
