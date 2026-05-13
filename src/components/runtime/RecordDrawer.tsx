import { Drawer } from '@/components/ui/Drawer'
import RecordForm from './RecordForm'

interface RecordDrawerProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit' | 'view'
  fields: any[]
  initialData?: any
  onSave: (data: any) => Promise<void>
  isLoading?: boolean
  logicType?: string
  masterModelId?: string
  detailDisplayMode?: 'tabs' | 'sections'
  onEditDetail?: (detail: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string) => void
}

export default function RecordDrawer({ 
  isOpen, 
  onClose, 
  mode, 
  fields, 
  initialData, 
  onSave,
  isLoading = false,
  logicType,
  masterModelId,
  detailDisplayMode = 'tabs',
  onEditDetail,
  onDeleteDetail,
  onAddDetail
}: RecordDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="">
      <RecordForm 
        mode={mode}
        fields={fields}
        initialData={initialData}
        onSave={onSave}
        onCancel={onClose}
        isLoading={isLoading}
        logicType={logicType}
        masterModelId={masterModelId}
        detailDisplayMode={detailDisplayMode}
        onEditDetail={onEditDetail}
        onDeleteDetail={onDeleteDetail}
        onAddDetail={onAddDetail}
      />
    </Drawer>
  )
}
