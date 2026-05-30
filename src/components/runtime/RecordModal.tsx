import { Modal } from '@/components/ui/Modal'
import RecordForm from './RecordForm'

interface RecordModalProps {
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
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
  masterTabTitle?: string
  detailsTabTitles?: Record<string, string>
  detailDisplayMode?: 'tabs' | 'sections'
  onEditDetail?: (detail: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string) => void
  joins?: any[]
  dictionary?: Record<string, string>
  detailsInlineTypes?: Record<string, 'table' | 'cards'>
  initialTab?: 'master' | string
  onTabChange?: (tab: string) => void
  zIndex?: number
  projectId?: string
  secretToken?: string
  tunnelChannel?: any
  isTunnelReady?: boolean
  project?: any
  refreshTrigger?: number
}

export default function RecordModal({ 
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
  masterTabTitle,
  detailsTabTitles,
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
  isTunnelReady,
  project,
  customActions = [],
  onCustomAction,
  refreshTrigger
}: RecordModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title=""
      size={logicType === 'master_detail' ? '2xl' : 'xl'}
      zIndex={zIndex}
    >
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
        masterTabTitle={masterTabTitle}
        detailsTabTitles={detailsTabTitles}
        detailDisplayMode={detailDisplayMode}
        onEditDetail={onEditDetail}
        onDeleteDetail={onDeleteDetail}
        onAddDetail={onAddDetail}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        initialTab={initialTab}
        onTabChange={onTabChange}
        footerBgClass="bg-white dark:bg-neutral-900"
        projectId={projectId}
        secretToken={secretToken}
        tunnelChannel={tunnelChannel}
        isTunnelReady={isTunnelReady}
        project={project}
        customActions={customActions}
        onCustomAction={onCustomAction}
        refreshTrigger={refreshTrigger}
      />
    </Modal>
  )
}
