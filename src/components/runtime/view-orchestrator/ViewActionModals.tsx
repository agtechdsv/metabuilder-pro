import React from 'react'
import RecordDrawer from '../RecordDrawer'
import RecordModal from '../RecordModal'
import DeleteConfirmModal from '../DeleteConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { BIWidgetEditor as BIWidgetConfigEditor } from '@/components/shared/BIWidgetEditor'
import { useI18n } from '@/i18n/I18nContext'

export interface ViewActionModalsProps {
  isDrawerOpen: boolean
  isModalOpen: boolean
  isDeleteModalOpen: boolean
  isIframeModalOpen: boolean
  isIframeDrawerOpen: boolean
  isWidgetModalOpen: boolean
  setOpen: (val: boolean) => void
  setIsDeleteModalOpen: (val: boolean) => void
  setIsIframeModalOpen: (val: boolean) => void
  setIsIframeDrawerOpen: (val: boolean) => void
  setIsWidgetModalOpen: (val: boolean) => void
  setEditingWidget: (val: any) => void
  drawerMode: 'create' | 'edit' | 'view'
  selectedRow: any
  iframeTitle: string
  iframeUrl: string
  editingWidget: any
  handleSave: (payload: any) => Promise<void>
  handleDelete: (row: any) => Promise<void>
  handleSaveWidgetRuntime: (widget: any) => Promise<void>
  cleanFormFields: any[]
  modelName: string
  project: any
  dictionary?: any
  detailsDisplayMode?: Record<string, 'tabs' | 'sections'>
  detailsInterfaceTypes?: Record<string, string>
  detailsInlineTypes?: Record<string, any>
  detailsModalSizes?: Record<string, string>
  detailsModalWidths?: Record<string, string>
  detailsModalHeights?: Record<string, string>
  masterTabTitle?: string
  detailsTabTitles?: Record<string, string>
  detailsItemTitles?: Record<string, string>
  tabsStyleConfig?: any
  logicType?: string
  isTunnelReady: boolean
  tunnelChannel: any
  isProcessing: boolean
  masterModelId?: string
  handleEditDetail: (detail: any) => void
  handleDeleteDetail: (detail: any) => void
  handleOpenAddDetail: (detail?: any) => void
  joins?: any[]
  activeTabForMaster: string
  setActiveTabForMaster: (val: string) => void
  customActions?: any[]
  handleCustomAction: (action: any, record: any) => void
  refreshKey: number
  customSlots?: any[]
}

export function ViewActionModals({
  isDrawerOpen,
  isModalOpen,
  isDeleteModalOpen,
  isIframeModalOpen,
  isIframeDrawerOpen,
  isWidgetModalOpen,
  setOpen,
  setIsDeleteModalOpen,
  setIsIframeModalOpen,
  setIsIframeDrawerOpen,
  setIsWidgetModalOpen,
  setEditingWidget,
  drawerMode,
  selectedRow,
  iframeTitle,
  iframeUrl,
  editingWidget,
  handleSave,
  handleDelete,
  handleSaveWidgetRuntime,
  cleanFormFields,
  modelName,
  project,
  dictionary,
  detailsDisplayMode,
  detailsInterfaceTypes,
  detailsInlineTypes,
  detailsModalSizes,
  detailsModalWidths,
  detailsModalHeights,
  masterTabTitle,
  detailsTabTitles,
  detailsItemTitles,
  tabsStyleConfig,
  logicType,
  isTunnelReady,
  tunnelChannel,
  isProcessing,
  masterModelId,
  handleEditDetail,
  handleDeleteDetail,
  handleOpenAddDetail,
  joins,
  activeTabForMaster,
  setActiveTabForMaster,
  customActions,
  handleCustomAction,
  refreshKey,
  customSlots
}: ViewActionModalsProps) {
  const { t } = useI18n()

  const commonProps = {
    mode: drawerMode,
    fields: cleanFormFields,
    initialData: selectedRow,
    onSave: handleSave,
    isLoading: isProcessing,
    logicType,
    masterModelId,
    masterModelName: modelName,
    masterTabTitle,
    detailsTabTitles,
    detailsItemTitles,
    tabsStyleConfig,
    detailsDisplayMode,
    onEditDetail: handleEditDetail,
    onDeleteDetail: handleDeleteDetail,
    onAddDetail: handleOpenAddDetail,
    joins,
    dictionary,
    detailsInlineTypes,
    initialTab: activeTabForMaster,
    onTabChange: setActiveTabForMaster,
    projectId: project?.id,
    secretToken: project?.secret_token,
    tunnelChannel,
    isTunnelReady,
    project,
    customActions,
    onCustomAction: handleCustomAction,
    refreshTrigger: refreshKey,
    customSlots
  }

  return (
    <>
      <RecordDrawer
        isOpen={isDrawerOpen}
        onClose={() => setOpen(false)}
        zIndex={200}
        {...commonProps}
      />
      
      <RecordModal
        isOpen={isModalOpen}
        onClose={() => setOpen(false)}
        zIndex={200}
        detailsInterfaceTypes={detailsInterfaceTypes}
        detailsModalSizes={detailsModalSizes}
        detailsModalWidths={detailsModalWidths}
        detailsModalHeights={detailsModalHeights}
        {...commonProps}
      />
      
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          await handleDelete(selectedRow)
          setIsDeleteModalOpen(false)
        }}
        isLoading={isProcessing}
        recordName={selectedRow?.name || selectedRow?.titulo || selectedRow?.id}
      />

      <Modal
        isOpen={isIframeModalOpen}
        onClose={() => setIsIframeModalOpen(false)}
        title={iframeTitle}
        size="4xl"
        hideHeader={true}
        zIndex={9999}
        className="!p-0 bg-transparent shadow-none border-none dark:bg-transparent"
      >
        <div className="w-full h-[85vh] bg-white dark:bg-neutral-950 rounded-[2.5rem] overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800">
          {isIframeModalOpen && <iframe src={iframeUrl} className="w-full h-full border-none" />}
        </div>
      </Modal>

      <Drawer
        isOpen={isIframeDrawerOpen}
        onClose={() => setIsIframeDrawerOpen(false)}
        title={iframeTitle}
        hideHeader={true}
        zIndex={9999}
      >
        <div className="w-full h-full bg-white dark:bg-neutral-950">
          {isIframeDrawerOpen && <iframe src={iframeUrl} className="w-full h-full border-none" />}
        </div>
      </Drawer>

      <Modal
        isOpen={isWidgetModalOpen}
        onClose={() => setIsWidgetModalOpen(false)}
        title="Configurar Indicador"
      >
        <div className="space-y-6">
          <BIWidgetConfigEditor 
            editingWidget={editingWidget}
            setEditingWidget={setEditingWidget}
            models={project?.models || []}
            joins={joins || []}
            t={t}
          />
          <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
             <button onClick={() => setIsWidgetModalOpen(false)} className="flex-1 px-4 py-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-black text-[10px] capitalize tracking-wider transition-all">Cancelar</button>
             <button onClick={() => handleSaveWidgetRuntime(editingWidget)} className="flex-1 px-4 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] capitalize tracking-wider hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">Salvar Dashboard</button>
          </div>
        </div>
      </Modal>
    </>
  )
}
