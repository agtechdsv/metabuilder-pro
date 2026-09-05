'use client'

import React from 'react'
import RecordDrawer from '../RecordDrawer'
import RecordModal from '../RecordModal'
import DeleteConfirmModal from '../DeleteConfirmModal'

interface ViewDetailModalsProps {
  detailHistory: any[]
  project: any
  detailsInterfaceTypes?: Record<string, string>
  detailsTabTitles?: Record<string, string>
  detailsItemTitles?: Record<string, string>
  detailsDisplayMode?: Record<string, 'tabs' | 'sections'>
  tabsStyleConfig?: any
  joins?: any[]
  dictionary?: any
  detailsInlineTypes?: Record<string, any>
  detailsModalSizes?: Record<string, string>
  detailsModalWidths?: Record<string, string>
  detailsModalHeights?: Record<string, string>
  handleCloseDetail: () => void
  tunnelChannel: any
  isTunnelReady: boolean
  customActions?: any[]
  handleCustomAction: any
  projectRelations?: any[]
  formFields: any[]
  currentDetailTable: string
  selectedDetail: any
  isDetailModalOpen: boolean
  isDetailDrawerOpen: boolean
  detailModalMode: 'create' | 'edit' | 'view'
  detailFieldsToRender: any[]
  handleSaveDetail: any
  isProcessing: boolean
  handleEditDetail: any
  handleDeleteDetail: any
  handleOpenAddDetail: any
  activeTabForDetail: string
  setActiveTabForDetail: (tab: string) => void
  refreshKey: number
  isDetailDeleteModalOpen: boolean
  setIsDetailDeleteModalOpen: (open: boolean) => void
  itemToDelete: any
  setItemToDelete: (item: any) => void
  handleConfirmDeleteDetail: () => Promise<void>
}

export function ViewDetailModals({
  detailHistory,
  project,
  detailsInterfaceTypes,
  detailsTabTitles,
  detailsItemTitles,
  detailsDisplayMode,
  tabsStyleConfig,
  joins = [],
  dictionary = {},
  detailsInlineTypes,
  detailsModalSizes,
  detailsModalWidths,
  detailsModalHeights,
  handleCloseDetail,
  tunnelChannel,
  isTunnelReady,
  customActions,
  handleCustomAction,
  projectRelations,
  formFields,
  currentDetailTable,
  selectedDetail,
  isDetailModalOpen,
  isDetailDrawerOpen,
  detailModalMode,
  detailFieldsToRender,
  handleSaveDetail,
  isProcessing,
  handleEditDetail,
  handleDeleteDetail,
  handleOpenAddDetail,
  activeTabForDetail,
  setActiveTabForDetail,
  refreshKey,
  isDetailDeleteModalOpen,
  setIsDetailDeleteModalOpen,
  itemToDelete,
  setItemToDelete,
  handleConfirmDeleteDetail,
}: ViewDetailModalsProps) {
  const currentModel = (project as any)?.models?.find(
    (m: any) => m.db_table_name?.toLowerCase() === currentDetailTable?.toLowerCase()
  )

  const currentTabTitle =
    detailsTabTitles?.[currentModel?.id || ''] ||
    dictionary?.[currentModel?.id || ''] ||
    currentModel?.display_name ||
    formFields.find((f) => f.model_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.display_model_name ||
    currentDetailTable

  const sharedDetailProps = {
    mode: detailModalMode,
    fields: detailFieldsToRender,
    initialData: selectedDetail,
    onSave: handleSaveDetail,
    isLoading: isProcessing,
    logicType: 'master_detail' as const,
    masterModelName: currentDetailTable,
    masterTabTitle: currentTabTitle,
    detailsTabTitles,
    detailsItemTitles,
    detailsDisplayMode,
    tabsStyleConfig,
    onEditDetail: handleEditDetail,
    onDeleteDetail: handleDeleteDetail,
    onAddDetail: handleOpenAddDetail,
    joins,
    dictionary,
    detailsInlineTypes,
    detailsInterfaceTypes,
    detailsModalSizes,
    detailsModalWidths,
    detailsModalHeights,
    initialTab: activeTabForDetail,
    onTabChange: setActiveTabForDetail,
    projectId: project.id,
    secretToken: project.secret_token,
    tunnelChannel,
    isTunnelReady,
    project,
    customActions,
    onCustomAction: handleCustomAction,
    projectRelations,
    refreshTrigger: refreshKey,
  }

  return (
    <>
      {/* Renderização de níveis anteriores do histórico */}
      {detailHistory.map((item, idx) => {
        const model = (project as any)?.models?.find(
          (m: any) => m.db_table_name.toLowerCase() === item.tableName?.toLowerCase()
        )
        const interfaceType =
          detailsInterfaceTypes?.[model?.id || ''] ||
          (project.ui_config as any)?.details_interface_types?.[model?.id || ''] ||
          'modal'

        const historyProps = {
          mode: 'edit' as const,
          fields: item.fields,
          initialData: item.record,
          isLoading: false,
          logicType: 'master_detail' as const,
          masterModelName: item.tableName,
          masterTabTitle:
            detailsTabTitles?.[model?.id || ''] ||
            dictionary?.[model?.id || ''] ||
            model?.display_name ||
            formFields.find((f) => f.model_name?.toLowerCase() === item.tableName?.toLowerCase())
              ?.display_model_name ||
            item.tableName,
          detailsTabTitles,
          detailsItemTitles,
          detailsDisplayMode,
          tabsStyleConfig,
          joins,
          dictionary,
          detailsInlineTypes,
          detailsInterfaceTypes,
          detailsModalSizes,
          detailsModalWidths,
          detailsModalHeights,
          initialTab: item.activeTab,
          onSave: async () => {},
          onClose: () => {
            const levelsToRemove = detailHistory.length - idx
            for (let i = 0; i < levelsToRemove; i++) handleCloseDetail()
          },
          projectId: project.id,
          secretToken: project.secret_token,
          tunnelChannel,
          isTunnelReady,
          project,
          customActions,
          onCustomAction: handleCustomAction,
          projectRelations,
        }

        return interfaceType === 'modal' ? (
          <RecordModal
            key={`history-modal-${idx}`}
            isOpen={true}
            zIndex={200 + (idx + 1) * 100}
            {...historyProps}
          />
        ) : (
          <RecordDrawer
            key={`history-drawer-${idx}`}
            isOpen={true}
            zIndex={200 + (idx + 1) * 100}
            {...historyProps}
          />
        )
      })}

      {/* Modal de Edição de Detalhe (Nível Atual) */}
      <RecordModal
        key={`detail-modal-${currentDetailTable}-${selectedDetail?.id ?? detailHistory.length}`}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        zIndex={200 + (detailHistory.length + 1) * 100}
        {...sharedDetailProps}
      />

      <RecordDrawer
        key={`detail-drawer-${currentDetailTable}-${selectedDetail?.id ?? detailHistory.length}`}
        isOpen={isDetailDrawerOpen}
        onClose={handleCloseDetail}
        zIndex={200 + (detailHistory.length + 1) * 100}
        {...sharedDetailProps}
      />

      <DeleteConfirmModal
        isOpen={isDetailDeleteModalOpen}
        onClose={() => {
          setIsDetailDeleteModalOpen(false)
          setItemToDelete(null)
        }}
        onConfirm={handleConfirmDeleteDetail}
        isLoading={isProcessing}
        recordName={itemToDelete?.name || itemToDelete?.id}
      />
    </>
  )
}
