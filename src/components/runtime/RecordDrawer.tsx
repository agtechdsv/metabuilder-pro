import { Drawer } from '@/components/ui/Drawer'
import RecordForm from './RecordForm'
import CustomUseCaseRenderer from './CustomUseCaseRenderer'

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
  customActions?: any[]
  onCustomAction?: (action: any, row?: any) => void
  masterTabTitle?: string
  detailsTabTitles?: Record<string, string>
  tabsStyleConfig?: any
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
  project?: any
  refreshTrigger?: number
  customSlots?: any[]
  detailsInterfaceTypes?: Record<string, string>
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
  masterTabTitle,
  detailsTabTitles,
  tabsStyleConfig,
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
  refreshTrigger,
  customSlots = [],
  detailsInterfaceTypes
}: RecordDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="" zIndex={zIndex}>
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
          tabsStyleConfig={tabsStyleConfig}
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
          project={project}
          customActions={customActions}
          onCustomAction={onCustomAction}
          refreshTrigger={refreshTrigger}
        />
      )}
    </Drawer>
  )
}
