'use client'

import React from 'react'
import { Pencil, ArrowLeft } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import CustomUseCaseRenderer from '../CustomUseCaseRenderer'
import RecordForm from '../RecordForm'

interface ViewPageFormRendererProps {
  logicType?: string
  formHeaderTitle?: string
  formHeaderSubtitleField?: string
  drawerMode: 'create' | 'edit' | 'view'
  selectedRow: any
  isCadastroOnly: boolean
  setIsPageVisible: (visible: boolean) => void
  cleanFormFields: any[]
  customSlots?: any[]
  masterModelId?: string
  autoOpenSlotConfig?: any
  modelName: string
  project: any
  tunnelChannel: any
  isTunnelReady: boolean
  handleSave: any
  isProcessing: boolean
  dictionary?: any
  joins?: any[]
  customActions?: any[]
  handleCustomAction: any
  refreshKey: number
  relationalRefreshKey: number
  detailsInterfaceTypes?: Record<string, string>
  detailsInlineTypes?: Record<string, any>
  detailsItemTitles?: Record<string, string>
  detailsTabTitles?: Record<string, string>
  detailsDisplayMode?: Record<string, 'tabs' | 'sections'>
  tabsStyleConfig?: any
  masterTabTitle?: string
  hiddenDetails?: string[]
  handleEditDetail: any
  handleDeleteDetail: any
  handleOpenAddDetail: any
  projectRelations?: any[]
  activeTabForMaster: string
  setActiveTabForMaster: (tab: string) => void
}

export function ViewPageFormRenderer({
  logicType,
  formHeaderTitle,
  formHeaderSubtitleField,
  drawerMode,
  selectedRow,
  isCadastroOnly,
  setIsPageVisible,
  cleanFormFields,
  customSlots = [],
  masterModelId,
  autoOpenSlotConfig,
  modelName,
  project,
  tunnelChannel,
  isTunnelReady,
  handleSave,
  isProcessing,
  dictionary = {},
  joins = [],
  customActions = [],
  handleCustomAction,
  refreshKey,
  relationalRefreshKey,
  detailsInterfaceTypes,
  detailsInlineTypes,
  detailsItemTitles,
  detailsTabTitles,
  detailsDisplayMode,
  tabsStyleConfig,
  masterTabTitle,
  hiddenDetails = [],
  handleEditDetail,
  handleDeleteDetail,
  handleOpenAddDetail,
  projectRelations = [],
  activeTabForMaster,
  setActiveTabForMaster,
}: ViewPageFormRendererProps) {
  const { t } = useI18n()

  if (logicType === 'personalizado') {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        <div className="flex items-center justify-between p-8 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
              <Pencil className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                {formHeaderTitle && formHeaderTitle.trim() !== ''
                  ? formHeaderTitle
                  : drawerMode === 'create'
                  ? t('runtime.record_drawer.new_item')
                  : t('runtime.record_drawer.edit_item', 'Editar Registro')}
              </h3>
              <p className="text-[10px] font-black tracking-[0.2em] text-neutral-400">
                {drawerMode === 'create'
                  ? t('runtime.record_drawer.new_item')
                  : formHeaderSubtitleField && selectedRow?.[formHeaderSubtitleField]
                  ? String(selectedRow[formHeaderSubtitleField])
                  : t('runtime.record_drawer.record_id').replace('{id}', selectedRow?.id || 'N/A')}
              </p>
            </div>
          </div>
          {!isCadastroOnly && (
            <button
              onClick={() => setIsPageVisible(false)}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black tracking-widest text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> {t('runtime.back_to_list', 'Voltar para Lista')}
            </button>
          )}
        </div>
        <CustomUseCaseRenderer
          mode={drawerMode}
          initialData={selectedRow}
          customSlots={customSlots}
          logicType={logicType}
          masterModelId={masterModelId}
          autoOpenSlotConfig={autoOpenSlotConfig}
          masterModelName={modelName}
          projectId={project.id}
          secretToken={project.secret_token}
          tunnelChannel={tunnelChannel}
          isTunnelReady={isTunnelReady}
          project={project}
          onClose={isCadastroOnly ? () => {} : () => setIsPageVisible(false)}
          onSave={handleSave}
          isLoading={isProcessing}
          fields={cleanFormFields}
          dictionary={dictionary}
          joins={joins}
          customActions={customActions}
          onCustomAction={handleCustomAction}
          refreshTrigger={refreshKey}
          detailsInterfaceTypes={detailsInterfaceTypes}
          detailsInlineTypes={detailsInlineTypes}
          detailsItemTitles={detailsItemTitles}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
          projectRelations={projectRelations}
        />
      </div>
    )
  }

  return (
    <RecordForm
      key={`page-form-${relationalRefreshKey}-${refreshKey}`}
      mode={drawerMode}
      fields={cleanFormFields}
      initialData={selectedRow}
      onSave={handleSave}
      onCancel={isCadastroOnly ? () => {} : () => setIsPageVisible(false)}
      isLoading={isProcessing}
      logicType={logicType}
      masterModelId={masterModelId}
      masterModelName={modelName}
      masterTabTitle={masterTabTitle}
      detailsTabTitles={detailsTabTitles}
      detailsItemTitles={detailsItemTitles}
      tabsStyleConfig={tabsStyleConfig}
      detailsDisplayMode={detailsDisplayMode}
      isPageMode={true}
      hiddenDetails={hiddenDetails}
      onEditDetail={handleEditDetail}
      onDeleteDetail={handleDeleteDetail}
      onAddDetail={handleOpenAddDetail}
      refreshTrigger={refreshKey}
      joins={joins}
      detailsInterfaceTypes={detailsInterfaceTypes}
      dictionary={dictionary}
      detailsInlineTypes={detailsInlineTypes}
      initialTab={activeTabForMaster}
      onTabChange={setActiveTabForMaster}
      projectId={project.id}
      secretToken={project.secret_token}
      tunnelChannel={tunnelChannel}
      isTunnelReady={isTunnelReady}
      project={project}
      customActions={customActions}
      onCustomAction={handleCustomAction}
      formHeaderTitle={formHeaderTitle}
      formHeaderSubtitleField={formHeaderSubtitleField}
      projectRelations={projectRelations}
    />
  )
}
