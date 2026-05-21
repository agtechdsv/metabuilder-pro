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
  masterModelName?: string
  detailDisplayMode?: 'tabs' | 'sections'
  onEditDetail?: (detail: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string) => void
  joins?: any[]
  dictionary?: Record<string, string>
  initialTab?: string
  onTabChange?: (tab: string) => void
  zIndex?: number
  detailsInlineTypes?: Record<string, boolean>
  projectId?: string
  secretToken?: string
  tunnelChannel?: any
  isTunnelReady?: boolean
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
  masterModelName,
  detailDisplayMode = 'tabs',
  onEditDetail,
  onDeleteDetail,
  onAddDetail,
  joins = [],
  dictionary = {},
  initialTab,
  onTabChange,
  zIndex,
  detailsInlineTypes,
  projectId,
  secretToken,
  tunnelChannel,
  isTunnelReady
}: RecordDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="" zIndex={zIndex}>
      <RecordForm 
        mode={mode}
        fields={fields}
        initialData={initialData}
        onSave={onSave}
        onCancel={onClose}
        isLoading={isLoading}
        logicType={logicType}
        masterModelId={masterModelId}
        masterModelName={masterModelName}
        detailDisplayMode={detailDisplayMode}
        onEditDetail={onEditDetail}
        onDeleteDetail={onDeleteDetail}
        onAddDetail={onAddDetail}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        initialTab={initialTab}
        onTabChange={onTabChange}
        projectId={projectId}
        secretToken={secretToken}
        tunnelChannel={tunnelChannel}
        isTunnelReady={isTunnelReady}
      />
    </Drawer>
  )
}
