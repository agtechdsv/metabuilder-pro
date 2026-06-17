'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Table, 
  Plus, 
  LayoutGrid, 
  Pencil, 
  Trash2, 
  Maximize2, 
  Layout, 
  Database,
  Workflow,
  ArrowLeft
} from 'lucide-react'
import { HeaderActions } from '@/components/layout/HeaderActions'
import RecordDrawer from './RecordDrawer'
import RecordModal from './RecordModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'

import RecordForm from './RecordForm'
import { RuntimeHeader } from './RuntimeHeader'
import AnalyticsDashboard from './AnalyticsDashboard'
import { BIWidgetEditor as BIWidgetConfigEditor } from '@/components/shared/BIWidgetEditor'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/Toast'
import { ExportDropdown } from './ExportControls'
import CustomUseCaseRenderer from './CustomUseCaseRenderer'
import { useRouter } from 'next/navigation'

// Importamos o ViewContainer sem SSR para evitar o "piscar" do loader
// e conflitos de hidratação com o sessionStorage
const ViewContainer = dynamic(() => import('./ViewContainer'), { ssr: false })

interface ViewPageContentProps {
  workspace: any
  project: any
  viewName: string
  canExport?: boolean
  modelName: string
  displayFields: any[]
  filterFields: any[]
  formFields: any[]
  displayType: 'list' | 'card' | 'both'
  defaultView: 'list' | 'card'
  buttonsConfig: any[]
  locale: string
  canAdd: boolean
  viewId: string
  primaryKeyName: string
  logicType?: string
  kanbanGroupField?: string
  mindmapCentralField?: string
  mindmapLevels?: any[]
  schedulerConfig?: any
  timelineConfig?: any
  mapConfig?: any
  ganttConfig?: any
  blueprintConfig?: any
  dictionary?: any
  joins?: any[]
  masterModelId?: string
  detailsDisplayMode?: Record<string, 'tabs' | 'sections'>
  actionInterfaceType?: 'drawer' | 'modal' | 'page'
  detailsInterfaceTypes?: Record<string, string>
  detailsInlineTypes?: Record<string, any>
  detailsModalSizes?: Record<string, string>
  detailsModalWidths?: Record<string, string>
  detailsModalHeights?: Record<string, string>
  masterTabTitle?: string
  detailsTabTitles?: Record<string, string>
  detailsItemTitles?: Record<string, string>
  tabsStyleConfig?: any
  baseUrl?: string
  breadcrumbs?: { label: string; href: string }[]
  description?: string
  icon?: string
  analyticsConfig?: {
    widgets: any[]
    allow_runtime_edit: boolean
  }
  exportFormats?: string[]
  galleryClickBehavior?: 'fullscreen' | 'thumbnail'
  galleryConfig?: any
  customActions?: any[]
  customSlots?: any[]
  isAutomationsEnabled?: boolean
  formHeaderTitle?: string
  formHeaderSubtitleField?: string
  projectRelations?: any[]
  initialItemsPerPage?: number
}

import { RuntimeBreadcrumbs } from './RuntimeBreadcrumbs'
import { useTunnelConnection } from './hooks/useTunnelConnection'
import { useCustomActionsRuntime } from './hooks/useCustomActionsRuntime'
import { useAnalyticsRuntime } from './hooks/useAnalyticsRuntime'
import { useMasterData } from './hooks/useMasterData'
import { useDetailData } from './hooks/useDetailData'
import { wrapChannelWithChunking } from '@/lib/chunkedChannel'

export default function ViewPageContent({
  workspace,
  project,
  viewName,
  modelName,
  displayFields,
  filterFields,
  formFields,
  displayType,
  defaultView,
  buttonsConfig,
  locale,
  canAdd,
  canExport = true,
  viewId,
  primaryKeyName,
  logicType,
  kanbanGroupField,
  mindmapCentralField,
  mindmapLevels,
  schedulerConfig,
  timelineConfig,
  mapConfig,
  ganttConfig,
  blueprintConfig,
  dictionary = {},
  joins = [],
  masterModelId,
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
  actionInterfaceType = 'drawer',
  baseUrl,
  breadcrumbs = [],
  description,
  icon,
  exportFormats = ['xlsx', 'csv', 'json'],
  analyticsConfig: initialAnalyticsConfig,
  galleryClickBehavior,
  galleryConfig,
  customActions = [],
  customSlots = [],
  isAutomationsEnabled = false,
  formHeaderTitle,
  formHeaderSubtitleField,
  projectRelations = [],
  initialItemsPerPage
}: ViewPageContentProps) {
  const router = useRouter()
  const { t } = useI18n()
  const btnAdd = buttonsConfig?.find((b: any) => b.id === 'add')
  const labelAdd = btnAdd?.custom_label !== undefined && btnAdd.custom_label !== '' 
    ? btnAdd.custom_label 
    : t('runtime.new_record')

  const getButtonStyles = (btn: any) => {
    if (!btn) return {}
    const styles: React.CSSProperties = {}
    if (btn.font_family && btn.font_family !== 'Inter (Padrão)') {
      styles.fontFamily = btn.font_family
    }
    if (btn.font_size) {
      styles.fontSize = btn.font_size
    }
    if (btn.text_color) {
      styles.color = btn.text_color
    }
    if (btn.bg_color) {
      styles.backgroundColor = btn.bg_color
      styles.borderColor = btn.bg_color
    }
    const textTrans = btn.text_transform !== undefined ? btn.text_transform : 'capitalize'
    if (textTrans && textTrans !== 'none') {
      styles.textTransform = textTrans
    }
    return styles
  }

  // Garante que todas as listas de campos sejam únicas por ID
  const cleanDisplayFields = useMemo(() => {
    const seen = new Set()
    return displayFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
  }, [displayFields])

  const cleanFilterFields = useMemo(() => {
    const seen = new Set()
    return filterFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
  }, [filterFields])

  const cleanFormFields = useMemo(() => {
    const seen = new Set()
    const filtered = formFields.filter(f => {
      if (!f?.id || seen.has(f.id)) return false
      seen.add(f.id)
      return true
    })
    
    // Se a lista de campos do formulário estiver vazia (como no Kanban sem Zona 3
    // ou no modo Fallback/Model direto), caímos de volta para os campos de exibição (grid/list)
    // para garantir que a janela modal/drawer exiba os campos e funcione corretamente.
    if (filtered.length === 0) {
      return cleanDisplayFields.map(f => ({
        ...f,
        zone: 3
      }))
    }
    return filtered
  }, [formFields, cleanDisplayFields])

  const detailFields = useMemo(() => 
    cleanFormFields.filter(f => f.model_id && String(f.model_id) !== String(masterModelId)),
  [cleanFormFields, masterModelId])

  const isCadastroOnly = logicType === 'cadastro'

  const [activeTab, setActiveTab] = useState<'list' | 'card'>(defaultView)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Modo "Apenas Cadastro": entra direto no formulário sem passar pela tela de pesquisa
  const [isPageVisible, setIsPageVisible] = useState(logicType === 'cadastro')
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [relationalRefreshKey, setRelationalRefreshKey] = useState(0)
  
  
  
  
  
  
  
  
  
  
  const [activeTabForMaster, setActiveTabForMaster] = useState<string>('master')
  
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  const { toast } = useToast()
  const [localAnalyticsConfig, setLocalAnalyticsConfig] = useState(initialAnalyticsConfig)
  const [editingWidget, setEditingWidget] = useState<any>(null)
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false)
  const [globalFilterValues, setGlobalFilterValues] = useState<Record<string, string>>({})

  
  const [initialEditId, setInitialEditId] = useState<string | null>(null)
  const [autoOpenSlotConfig, setAutoOpenSlotConfig] = useState<{ id: string, type: 'modal' | 'drawer' } | null>(null)

  const [iframeUrl, setIframeUrl] = useState<string>('')
  const [iframeTitle, setIframeTitle] = useState<string>('')
  const [isIframeModalOpen, setIsIframeModalOpen] = useState(false)
  const [isIframeDrawerOpen, setIsIframeDrawerOpen] = useState(false)

  const { tunnelChannel, isTunnelReady, supabase } = useTunnelConnection({
    project,
    modelName,
    primaryKeyName,
    isCadastroOnly,
    initialEditId,
    setRefreshKey,
    setRelationalRefreshKey,
    setDetailRefreshKey,
    setSelectedRow,
    setDrawerMode,
    setIsPageVisible
  });

  const {
    fetchDetails,
    isDetailModalOpen, setIsDetailModalOpen,
    isDetailDrawerOpen, setIsDetailDrawerOpen,
    isDetailDeleteModalOpen, setIsDetailDeleteModalOpen,
    selectedDetail, setSelectedDetail,
    detailFieldsToRender, setDetailFieldsToRender,
    detailModalMode, setDetailModalMode,
    currentDetailTable, setCurrentDetailTable,
    parentRowIdForDetail, setParentRowIdForDetail,
    itemToDelete, setItemToDelete,
    detailHistory, setDetailHistory,
    activeTabForDetail, setActiveTabForDetail,
    handleOpenAddDetail,
    handleEditDetail,
    handleCloseDetail,
    handleDeleteDetail,
    handleConfirmDeleteDetail,
    handleSaveDetail
  } = useDetailData({
    project,
    modelName,
    detailFields,
    joins,
    projectRelations,
    tunnelChannel,
    isTunnelReady,
    supabase,
    t,
    detailsItemTitles: detailsItemTitles || {},
    detailsInterfaceTypes: detailsInterfaceTypes || {},
    setIsProcessing,
    selectedRow,
    setSelectedRow,
    setRefreshKey,
    setDetailRefreshKey,
    getFkErrorMessage: (e, fb) => getFkErrorMessage(e, fb),
    logicType,
    dictionary
  });

  const { gridCustomActions, handleCustomAction } = useCustomActionsRuntime({
    project,
    modelName,
    customSlots,
    customActions,
    tunnelChannel,
    isTunnelReady,
    selectedRow,
    setRefreshKey,
    setRelationalRefreshKey,
    setDetailRefreshKey,
    setSelectedRow,
    setDrawerMode,
    setIsPageVisible,
    setAutoOpenSlotConfig,
    setIframeUrl,
    setIframeTitle,
    setIsIframeModalOpen,
    setIsIframeDrawerOpen,
    fetchDetails
  });

  const {
    handleAddWidgetRuntime,
    handleEditWidgetRuntime,
    handleSaveWidgetRuntime,
    handleSaveDashboardLayout,
    handleDeleteWidgetRuntime
  } = useAnalyticsRuntime({
    project,
    viewId,
    localAnalyticsConfig,
    initialAnalyticsConfig,
    setLocalAnalyticsConfig,
    setEditingWidget,
    setIsWidgetModalOpen,
    supabase
  });

  const { handleSave, handleDelete, getFkErrorMessage } = useMasterData({
    project,
    modelName,
    primaryKeyName,
    tunnelChannel,
    isTunnelReady,
    drawerMode,
    selectedRow,
    isCadastroOnly,
    isPage: actionInterfaceType === 'page',
    detailFields,
    projectRelations,
    joins,
    supabase,
    t,
    setIsProcessing,
    setSelectedRow,
    setDrawerMode,
    setIsPageVisible,
    setRefreshKey,
    setOpen: (val) => {
      if (actionInterfaceType === 'modal') setIsModalOpen(val)
      else if (actionInterfaceType === 'page') setIsPageVisible(val)
      else setIsDrawerOpen(val)
    },
    fetchDetails,
    setIsDeleteModalOpen
  });
const isModal = actionInterfaceType === 'modal'
  const isPage = actionInterfaceType === 'page'

  const setOpen = (val: boolean) => {
    if (isModal) setIsModalOpen(val)
    else if (isPage) setIsPageVisible(val)
    else setIsDrawerOpen(val)
  }
  
  const isOpen = isModal ? isModalOpen : (isPage ? isPageVisible : isDrawerOpen)

  const handleOpenAdd = (inData: any = {}) => {
    // Prevent React synthetic events from being used as inData
    let initialData = { ...inData }
    if (initialData && typeof initialData === 'object' && ('nativeEvent' in initialData || initialData._reactName || typeof initialData.preventDefault === 'function')) {
      initialData = {}
    }
    
    if (logicType === 'master_detail') {
      initialData._details = []
      const detailTables = Array.from(new Set(detailFields.map(f => f.model_name))).filter(Boolean) as string[]
      detailTables.forEach(tableName => {
        initialData._details.push({
          model_name: tableName,
          _isNew: true,
          id: crypto.randomUUID()
        })
      })
    }

    setAutoOpenSlotConfig(null)
    setDrawerMode('create')
    setSelectedRow(initialData)
    setActiveTabForMaster('master')
    setOpen(true)
  }

  const handleOpenView = async (row: any) => {
    setAutoOpenSlotConfig(null)
    setDrawerMode('view')
    setIsProcessing(true)
    const details = await fetchDetails(row, modelName)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setOpen(true)
  }

  const handleOpenEdit = async (row: any) => {
    setAutoOpenSlotConfig(null)
    setDrawerMode('edit')
    setIsProcessing(true)
    const details = await fetchDetails(row, modelName)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setActiveTabForMaster('master')
    setOpen(true)
  }

  const handleOpenDelete = (row: any) => {
    setSelectedRow(row)
    setIsDeleteModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header com Branding Dinâmico */}
      <RuntimeHeader 
        viewName={viewName}
        subtitle={description}
        icon={icon}
        actions={(
          <div className="flex items-center gap-3">
            {isAutomationsEnabled && (
              <button
                onClick={() => router.push(`/${workspace.slug}/${project.slug}/automations?use_case=${viewId}`)}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full transition-all text-xs font-bold shadow-sm active:scale-95"
                title={t('runtime.automations')}
              >
                <Workflow className="w-4 h-4 text-indigo-500" />
                <span className="hidden sm:inline">{t('runtime.automations')}</span>
              </button>
            )}
            {logicType !== 'analytics' && project.theme_config?.enable_downloads !== false && canExport && (
              <ExportDropdown 
                projectId={project.id}
                workspaceSlug={workspace.slug}
                projectSlug={project.slug}
                viewName={viewName}
                modelName={modelName}
                displayFields={cleanDisplayFields}
                joins={joins}
                filters={globalFilterValues}
                exportFormats={exportFormats}
                selectedRecord={(isPageVisible || isModalOpen || isDrawerOpen) ? selectedRow : null}
              />
            )}
            {canAdd && (
              <button 
                onClick={handleOpenAdd}
                style={getButtonStyles(btnAdd)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all font-bold text-xs shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95",
                  (btnAdd?.custom_label !== undefined && btnAdd.custom_label !== '') ? "" : "capitalize tracking-wider"
                )}
              >
                <Plus className="w-4 h-4" />
                {labelAdd}
              </button>
            )}
          </div>
        )}
      />

      <main className="px-10 py-6 pb-8 space-y-8">
        {(isPage && isPageVisible) || isCadastroOnly ? (
          logicType === 'personalizado' ? (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl overflow-hidden shadow-sm flex flex-col">
              <div className="flex items-center justify-between p-8 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20">
                    <Pencil className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                      {formHeaderTitle && formHeaderTitle.trim() !== '' ? formHeaderTitle : (drawerMode === 'create' ? t('runtime.record_drawer.new_item') : t('runtime.record_drawer.edit_item', 'Editar Registro'))}
                    </h3>
                    <p className="text-[10px] font-black tracking-[0.2em] text-neutral-400">
                      {drawerMode === 'create' ? t('runtime.record_drawer.new_item') : 
                        (formHeaderSubtitleField && selectedRow?.[formHeaderSubtitleField] 
                          ? String(selectedRow[formHeaderSubtitleField]) 
                          : t('runtime.record_drawer.record_id').replace('{id}', selectedRow?.id || 'N/A'))}
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
          ) : (
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
        ) : (
          <>
            {(logicType === 'analytics' || (localAnalyticsConfig?.widgets?.length ?? initialAnalyticsConfig?.widgets?.length ?? 0) > 0) && (
              <AnalyticsDashboard 
                config={localAnalyticsConfig || initialAnalyticsConfig || { widgets: [], allow_runtime_edit: true }}
                project={project}
                joins={joins}
                filters={globalFilterValues}
                onEditWidget={handleEditWidgetRuntime}
                onAddWidget={handleAddWidgetRuntime}
                onDeleteWidget={handleDeleteWidgetRuntime}
                onSaveLayout={handleSaveDashboardLayout}
                tunnelChannel={tunnelChannel}
                isTunnelReady={isTunnelReady}
                projectRelations={projectRelations}
              />
            )}

            <ViewContainer 
              externalRefreshTrigger={refreshKey}
              projectId={project.id}
              project={project}
              modelName={modelName}
              displayFields={displayFields}
              filterFields={filterFields}
              formFields={formFields}
              displayType={displayType}
              defaultView={defaultView}
              buttonsConfig={buttonsConfig}
              locale={locale}
              logicType={logicType}
              primaryKeyName={primaryKeyName}
              kanbanGroupField={kanbanGroupField}
              mindmapCentralField={mindmapCentralField}
              mindmapLevels={mindmapLevels}
              schedulerConfig={schedulerConfig}
              timelineConfig={timelineConfig}
              mapConfig={mapConfig}
              ganttConfig={ganttConfig}
              blueprintConfig={blueprintConfig}
              initialEditId={initialEditId}
              masterModelId={masterModelId}
              detailsDisplayMode={detailsDisplayMode}
              dictionary={dictionary}
              joins={joins}
              actionInterfaceType={actionInterfaceType}
              externalFilters={globalFilterValues}
              onFiltersChange={setGlobalFilterValues}
              tunnelChannel={tunnelChannel}
              isTunnelReady={isTunnelReady}
              galleryClickBehavior={galleryClickBehavior}
              galleryConfig={galleryConfig}
              onAdd={handleOpenAdd}
              onView={handleOpenView}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              customActions={gridCustomActions}
              onCustomAction={handleCustomAction}
              projectRelations={projectRelations}
              initialItemsPerPage={initialItemsPerPage}
            />
          </>
        )}
      </main>

      {isModal ? (
        <RecordModal 
          key={`master-modal-${selectedRow?.id ?? 'new'}`}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          zIndex={200}
          mode={drawerMode}
          fields={cleanFormFields}
          initialData={selectedRow}
          onSave={handleSave}
          isLoading={isProcessing}
          logicType={logicType}
          masterModelId={masterModelId}
          masterModelName={modelName}
          masterTabTitle={masterTabTitle}
          detailsTabTitles={detailsTabTitles}
          detailsItemTitles={detailsItemTitles}
          tabsStyleConfig={tabsStyleConfig}
          detailsDisplayMode={detailsDisplayMode}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
          joins={joins}
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
          refreshTrigger={refreshKey}
          customSlots={customSlots}
        />
      ) : (
        <RecordDrawer 
          key={`master-drawer-${selectedRow?.id ?? 'new'}`}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          zIndex={200}
          mode={drawerMode}
          fields={cleanFormFields}
          initialData={selectedRow}
          onSave={handleSave}
          isLoading={isProcessing}
          logicType={logicType}
          masterModelId={masterModelId}
          masterModelName={modelName}
          masterTabTitle={masterTabTitle}
          detailsTabTitles={detailsTabTitles}
          detailsItemTitles={detailsItemTitles}
          tabsStyleConfig={tabsStyleConfig}
          detailsDisplayMode={detailsDisplayMode}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
          joins={joins}
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
          refreshTrigger={refreshKey}
          customSlots={customSlots}
        />
      )}

      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isLoading={isProcessing}
        recordName={selectedRow?.name || selectedRow?.titulo || selectedRow?.id}
      />

      {/* Renderização de níveis anteriores do histórico */}
      {detailHistory.map((item, idx) => {
        const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === item.tableName?.toLowerCase())
        const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
        
        const historyProps = {
          mode: 'edit' as const,
          fields: item.fields,
          initialData: item.record,
          isLoading: false,
          logicType: "master_detail" as const,
          masterModelName: item.tableName,
          masterTabTitle: detailsTabTitles?.[model?.id || ''] || dictionary?.[model?.id || ''] || model?.display_name || formFields.find(f => f.model_name?.toLowerCase() === item.tableName?.toLowerCase())?.display_model_name || item.tableName,
          detailsTabTitles: detailsTabTitles,
          detailsItemTitles: detailsItemTitles,
          detailsDisplayMode: detailsDisplayMode,
          tabsStyleConfig: tabsStyleConfig,
          joins: joins,
          dictionary: dictionary,
          detailsInlineTypes: detailsInlineTypes,
          detailsInterfaceTypes: detailsInterfaceTypes,
          detailsModalSizes: detailsModalSizes,
          detailsModalWidths: detailsModalWidths,
          detailsModalHeights: detailsModalHeights,
          initialTab: item.activeTab,
          onSave: async () => {},
          onClose: () => {
            const levelsToRemove = detailHistory.length - idx
            let newHistory = [...detailHistory]
            for(let i=0; i < levelsToRemove; i++) handleCloseDetail()
          },
          projectId: project.id,
          secretToken: project.secret_token,
          tunnelChannel: tunnelChannel,
          isTunnelReady: isTunnelReady,
          project: project,
          customActions,
          onCustomAction: handleCustomAction,
          projectRelations: projectRelations
        }

        return interfaceType === 'modal' ? (
          <RecordModal key={`history-modal-${idx}`} isOpen={true} zIndex={200 + (idx + 1) * 100} {...historyProps} />
        ) : (
          <RecordDrawer key={`history-drawer-${idx}`} isOpen={true} zIndex={200 + (idx + 1) * 100} {...historyProps} />
        )
      })}

      {/* Modal de Edição de Detalhe (Nível Atual) */}
      <RecordModal 
        key={`detail-modal-${currentDetailTable}-${selectedDetail?.id ?? detailHistory.length}`}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        zIndex={200 + (detailHistory.length + 1) * 100}
        mode={detailModalMode}
        fields={detailFieldsToRender}
        initialData={selectedDetail}
        onSave={handleSaveDetail}
        isLoading={isProcessing}
        logicType="master_detail"
        masterModelName={currentDetailTable}
        masterTabTitle={detailsTabTitles?.[(project as any)?.models?.find((m: any) => m.db_table_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.id || ''] || dictionary?.[(project as any)?.models?.find((m: any) => m.db_table_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.id || ''] || (project as any)?.models?.find((m: any) => m.db_table_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.display_name || formFields.find(f => f.model_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.display_model_name || currentDetailTable}
        detailsTabTitles={detailsTabTitles}
        detailsItemTitles={detailsItemTitles}
        detailsDisplayMode={detailsDisplayMode}
        tabsStyleConfig={tabsStyleConfig}
        onEditDetail={handleEditDetail}
        onDeleteDetail={handleDeleteDetail}
        onAddDetail={handleOpenAddDetail}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        detailsInterfaceTypes={detailsInterfaceTypes}
        detailsModalSizes={detailsModalSizes}
        detailsModalWidths={detailsModalWidths}
        detailsModalHeights={detailsModalHeights}
        initialTab={activeTabForDetail}
        onTabChange={setActiveTabForDetail}
        projectId={project.id}
        secretToken={project.secret_token}
        tunnelChannel={tunnelChannel}
        isTunnelReady={isTunnelReady}
        project={project}
        customActions={customActions}
        onCustomAction={handleCustomAction}
        projectRelations={projectRelations}
        refreshTrigger={refreshKey}
      />

      <RecordDrawer 
        key={`detail-drawer-${currentDetailTable}-${selectedDetail?.id ?? detailHistory.length}`}
        isOpen={isDetailDrawerOpen}
        onClose={handleCloseDetail}
        zIndex={200 + (detailHistory.length + 1) * 100}
        mode={detailModalMode}
        fields={detailFieldsToRender}
        initialData={selectedDetail}
        onSave={handleSaveDetail}
        isLoading={isProcessing}
        logicType="master_detail"
        masterModelName={currentDetailTable}
        masterTabTitle={detailsTabTitles?.[(project as any)?.models?.find((m: any) => m.db_table_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.id || ''] || dictionary?.[(project as any)?.models?.find((m: any) => m.db_table_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.id || ''] || (project as any)?.models?.find((m: any) => m.db_table_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.display_name || formFields.find(f => f.model_name?.toLowerCase() === currentDetailTable?.toLowerCase())?.display_model_name || currentDetailTable}
        detailsTabTitles={detailsTabTitles}
        detailsItemTitles={detailsItemTitles}
        detailsDisplayMode={detailsDisplayMode}
        tabsStyleConfig={tabsStyleConfig}
        onEditDetail={handleEditDetail}
        onDeleteDetail={handleDeleteDetail}
        onAddDetail={handleOpenAddDetail}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        detailsInterfaceTypes={detailsInterfaceTypes}
        detailsModalSizes={detailsModalSizes}
        detailsModalWidths={detailsModalWidths}
        detailsModalHeights={detailsModalHeights}
        initialTab={activeTabForDetail}
        onTabChange={setActiveTabForDetail}
        projectId={project.id}
        secretToken={project.secret_token}
        tunnelChannel={tunnelChannel}
        isTunnelReady={isTunnelReady}
        project={project}
        customActions={customActions}
        onCustomAction={handleCustomAction}
        projectRelations={projectRelations}
        refreshTrigger={refreshKey}
      />

      <DeleteConfirmModal 
        isOpen={isDetailDeleteModalOpen}
        onClose={() => { setIsDetailDeleteModalOpen(false); setItemToDelete(null); }}
        onConfirm={handleConfirmDeleteDetail}
        isLoading={isProcessing}
        recordName={itemToDelete?.name || itemToDelete?.id}
      />

      {/* Widget Editor Modal - Runtime */}
      <Modal
        isOpen={isWidgetModalOpen}
        onClose={() => setIsWidgetModalOpen(false)}
        title="Configurar Indicador"
      >
        <div className="space-y-6">
          <BIWidgetConfigEditor 
            editingWidget={editingWidget}
            setEditingWidget={setEditingWidget}
            models={project.models}
            joins={joins || []}
            t={t}
          />


          <div className="flex gap-3 pt-6 border-t border-neutral-100 dark:border-neutral-800">
             <button onClick={() => setIsWidgetModalOpen(false)} className="flex-1 px-4 py-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-black text-[10px] capitalize tracking-wider transition-all">Cancelar</button>
             <button onClick={() => handleSaveWidgetRuntime(editingWidget)} className="flex-1 px-4 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] capitalize tracking-wider hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">Salvar Dashboard</button>
          </div>
        </div>
      </Modal>

      {/* Modal / Drawer for UseCase Actions */}
      <Modal 
        isOpen={isIframeModalOpen} 
        onClose={() => {
          setIsIframeModalOpen(false)
          setIframeUrl('')
          setRefreshKey(prev => prev + 1)
          setRelationalRefreshKey(prev => prev + 1)
        }} 
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
        onClose={() => {
          setIsIframeDrawerOpen(false)
          setIframeUrl('')
          setRefreshKey(prev => prev + 1)
          setRelationalRefreshKey(prev => prev + 1)
        }}
        title={iframeTitle}
        hideHeader={true}
        zIndex={9999}
      >
        <div className="w-full h-full bg-white dark:bg-neutral-950">
          {isIframeDrawerOpen && <iframe src={iframeUrl} className="w-full h-full border-none" />}
        </div>
      </Drawer>

    </div>
  )
}
