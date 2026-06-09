import { Modal } from '@/components/ui/Modal'
import RecordForm from './RecordForm'
import CustomUseCaseRenderer from './CustomUseCaseRenderer'

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
  detailsItemTitles?: Record<string, string>
  tabsStyleConfig?: any
  detailsDisplayMode?: Record<string, 'tabs' | 'sections'>
  onEditDetail?: (detail: any) => void
  onDeleteDetail?: (detail: any) => void
  onAddDetail?: (tableName: string) => void
  joins?: any[]
  dictionary?: Record<string, string>
  detailsInlineTypes?: Record<string, any>
  initialTab?: 'master' | string
  onTabChange?: (tab: string) => void
  zIndex?: number
  projectId?: string
  secretToken?: string
  tunnelChannel?: any
  isTunnelReady?: boolean
  project?: any
  refreshTrigger?: number
  customSlots?: any[]
  detailsInterfaceTypes?: Record<string, string>
  formHeaderTitle?: string
  formHeaderSubtitleField?: string
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
  detailsItemTitles,
  detailsDisplayMode = {},
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
  refreshTrigger,
  tabsStyleConfig,
  customSlots = [],
  detailsInterfaceTypes,
  formHeaderTitle,
  formHeaderSubtitleField
}: RecordModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title=""
      size={logicType === 'master_detail' ? '2xl' : 'xl'}
      zIndex={zIndex}
    >
      {logicType === 'personalizado' ? (
        <CustomUseCaseRenderer 
          mode={mode}
          initialData={initialData}
          customSlots={customSlots.length > 0 ? customSlots : project?.ui_views?.find?.((v: any) => v.id === initialData?.view_id)?.layout_config?.custom_slots || []} 
          logicType={logicType}
          masterModelId={masterModelId}
          masterModelName={masterModelName}
          projectId={projectId}
          secretToken={secretToken}
          tunnelChannel={tunnelChannel}
          isTunnelReady={isTunnelReady}
          project={project}
          onClose={onClose}
          onSave={onSave}
          isLoading={isLoading}
          fields={fields}
          dictionary={dictionary}
          joins={joins}
          customActions={customActions}
          onCustomAction={onCustomAction}
          refreshTrigger={refreshTrigger}
          detailsInterfaceTypes={detailsInterfaceTypes}
          detailsInlineTypes={detailsInlineTypes}
          onEditDetail={onEditDetail}
          onDeleteDetail={onDeleteDetail}
          onAddDetail={onAddDetail}
        />
      ) : (
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
          detailsItemTitles={detailsItemTitles}
          tabsStyleConfig={tabsStyleConfig}
          detailsDisplayMode={detailsDisplayMode}
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
          formHeaderTitle={formHeaderTitle}
          formHeaderSubtitleField={formHeaderSubtitleField}
        />
      )}
    </Modal>
  )
}
