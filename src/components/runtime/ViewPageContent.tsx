'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'
import { useRouter } from 'next/navigation'

import { useTunnelConnection } from './hooks/useTunnelConnection'
import { useCustomActionsRuntime } from './hooks/useCustomActionsRuntime'
import { useViewConfigParams } from './hooks/useViewConfigParams'
import { ViewPageHeader } from './view-orchestrator/ViewPageHeader'
import { ViewActionModals } from './view-orchestrator/ViewActionModals'
import { ViewDetailModals } from './view-orchestrator/ViewDetailModals'
import { ViewPageFormRenderer } from './view-orchestrator/ViewPageFormRenderer'
import { useAnalyticsRuntime } from './hooks/useAnalyticsRuntime'
import { useMasterData } from './hooks/useMasterData'
import { useDetailData } from './hooks/useDetailData'
import AnalyticsDashboard from './AnalyticsDashboard'

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
  tableDictionary?: any
  joins?: any[]
  masterModelId?: string
  detailsDisplayMode?: Record<string, 'tabs' | 'sections'>
  hiddenDetails?: string[]
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
  filterGridColumns?: string
}

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
  tableDictionary = {},
  joins = [],
  masterModelId,
  detailsDisplayMode,
  detailsInterfaceTypes,
  detailsInlineTypes,
  detailsModalSizes,
  detailsModalWidths,
  detailsModalHeights,
  hiddenDetails = [],
  masterTabTitle,
  detailsTabTitles,
  detailsItemTitles,
  tabsStyleConfig,
  actionInterfaceType = 'drawer',
  baseUrl,
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
  const labelAdd =
    btnAdd?.custom_label !== undefined && btnAdd.custom_label !== ''
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

  const { cleanDisplayFields, cleanFormFields, detailFields, activeRelations } = useViewConfigParams({
    displayFields,
    filterFields,
    formFields,
    masterModelId,
    projectRelations,
  })

  const [internalIsCadastroOnly, setInternalIsCadastroOnly] = useState(logicType === 'cadastro')
  const isCadastroOnly = internalIsCadastroOnly

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search)
      const editId = search.get('edit_id')
      const force = search.get('force_form') === 'true' || (search.get('embedded') === 'true' && !!editId)

      if (editId) {
        setInitialEditId(editId)
      }
      if (force && logicType !== 'cadastro') {
        setInternalIsCadastroOnly(true)
        setIsPageVisible(true)
      }
    }
  }, [logicType])

  const [autoOpenSlotConfig, setAutoOpenSlotConfig] = useState<{ id: string; type: 'modal' | 'drawer' } | null>(null)
  const [iframeUrl, setIframeUrl] = useState<string>('')
  const [iframeTitle, setIframeTitle] = useState<string>('')
  const [isIframeModalOpen, setIsIframeModalOpen] = useState(false)
  const [isIframeDrawerOpen, setIsIframeDrawerOpen] = useState(false)

  const isNestedRoute =
    typeof window !== 'undefined' && window.location.pathname.startsWith(`/${workspace?.slug}/${project?.slug}`)
  const isEjectedApp = process.env.NEXT_PUBLIC_IS_EJECTED_APP === 'true' || !isNestedRoute

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
    setIsPageVisible,
    isEjectedApp,
  })

  useEffect(() => {
    if (!isEjectedApp) return
    if (!initialEditId || !isCadastroOnly) return

    const cleanPk = (primaryKeyName || 'id').split('.').pop() || 'id'

    fetch(`/api/${modelName}?filter_${cleanPk}=${encodeURIComponent(initialEditId)}&limit=1`)
      .then((r) => r.json())
      .then((res) => {
        const records = Array.isArray(res) ? res : res.data || []
        if (records.length > 0) {
          const raw = records[0]
          const record: any = { ...raw }
          for (const key in raw) {
            const lowerKey = key.toLowerCase()
            if (record[lowerKey] === undefined) record[lowerKey] = raw[key]
          }
          setSelectedRow(record)
          setDrawerMode('edit')
          setIsPageVisible(true)
        }
      })
      .catch((err) => console.error(`[MetaBuilder] ❌ [Ejected] Erro ao buscar registro:`, err))
  }, [isEjectedApp, initialEditId, isCadastroOnly, modelName, primaryKeyName])

  const {
    fetchDetails,
    isDetailModalOpen,
    isDetailDrawerOpen,
    isDetailDeleteModalOpen,
    setIsDetailDeleteModalOpen,
    selectedDetail,
    detailFieldsToRender,
    detailModalMode,
    currentDetailTable,
    itemToDelete,
    setItemToDelete,
    detailHistory,
    activeTabForDetail,
    setActiveTabForDetail,
    handleOpenAddDetail,
    handleEditDetail,
    handleCloseDetail,
    handleDeleteDetail,
    handleConfirmDeleteDetail,
    handleSaveDetail,
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
    dictionary,
  })

  useEffect(() => {
    if (isCadastroOnly && initialEditId && selectedRow && !selectedRow._details) {
      const loadDetails = async () => {
        setIsProcessing(true)
        const details = await fetchDetails(selectedRow, modelName)
        setSelectedRow((prev: any) => ({ ...prev, _details: details }))
        setIsProcessing(false)
      }
      loadDetails()
    }
  }, [isCadastroOnly, initialEditId, selectedRow, modelName, fetchDetails])

  const { gridCustomActions, handleCustomAction } = useCustomActionsRuntime({
    project,
    modelName,
    customSlots,
    customActions,
    baseUrl,
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
    fetchDetails,
  })

  const {
    handleAddWidgetRuntime,
    handleEditWidgetRuntime,
    handleSaveWidgetRuntime,
    handleSaveDashboardLayout,
    handleDeleteWidgetRuntime,
  } = useAnalyticsRuntime({
    project,
    viewId,
    localAnalyticsConfig,
    initialAnalyticsConfig,
    setLocalAnalyticsConfig,
    setEditingWidget,
    setIsWidgetModalOpen,
  })

  const rootMindmapOpenMode =
    (logicType === 'mapa_mental' || (mindmapLevels && mindmapLevels.length > 0))
      ? (mindmapLevels?.[0]?.edit_usecase_open_mode || 'modal')
      : undefined

  const effectiveActionInterfaceType = rootMindmapOpenMode || actionInterfaceType || 'drawer'

  const isModal = effectiveActionInterfaceType === 'modal'
  const isPage = effectiveActionInterfaceType === 'page'

  const setOpen = (val: boolean) => {
    if (!val) {
      setIsModalOpen(false)
      setIsDrawerOpen(false)
      setIsPageVisible(false)
      return
    }
    if (isModal) {
      setIsDrawerOpen(false)
      setIsModalOpen(true)
    } else if (isPage) {
      setIsPageVisible(true)
    } else {
      setIsModalOpen(false)
      setIsDrawerOpen(true)
    }
  }

  const { handleSave, handleDelete, getFkErrorMessage } = useMasterData({
    project,
    modelName,
    primaryKeyName,
    tunnelChannel,
    isTunnelReady,
    drawerMode,
    selectedRow,
    isCadastroOnly,
    isPage,
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
    setOpen,
    fetchDetails,
    setIsDeleteModalOpen,
  })

  const handleOpenAdd = (inData: any = {}) => {
    let initialData = { ...inData }
    if (
      initialData &&
      typeof initialData === 'object' &&
      ('nativeEvent' in initialData || initialData._reactName || typeof initialData.preventDefault === 'function')
    ) {
      initialData = {}
    }

    if (logicType === 'master_detail') {
      initialData._details = []
      const detailTables = Array.from(new Set(detailFields.map((f) => f.model_name))).filter(Boolean) as string[]
      detailTables.forEach((tableName) => {
        initialData._details.push({
          model_name: tableName,
          _isNew: true,
          id: crypto.randomUUID(),
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

  const handleOpenEdit = async (row: any, forcedMode?: 'modal' | 'drawer' | 'page') => {
    setAutoOpenSlotConfig(null)
    setDrawerMode('edit')
    setIsProcessing(true)
    const details = await fetchDetails(row, modelName)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setActiveTabForMaster('master')

    const targetMode = forcedMode || (isModal ? 'modal' : isPage ? 'page' : 'drawer')
    if (targetMode === 'modal') {
      setIsDrawerOpen(false)
      setIsPageVisible(false)
      setIsModalOpen(true)
    } else if (targetMode === 'page') {
      setIsModalOpen(false)
      setIsDrawerOpen(false)
      setIsPageVisible(true)
    } else {
      setIsModalOpen(false)
      setIsPageVisible(false)
      setIsDrawerOpen(true)
    }
  }

  const handleEditLevel = (levelIndex: number, row: any) => {
    const levelConfig = mindmapLevels?.[levelIndex]
    if (levelConfig && levelConfig.edit_usecase_slug) {
      const targetSlug = levelConfig.edit_usecase_slug

      let levelPkName = 'id'
      if (levelConfig.model_id && project?.models) {
        const levelModel = project.models.find((m: any) => String(m.id) === String(levelConfig.model_id))
        if (levelModel && levelModel.fields) {
          const pkField = levelModel.fields.find((f: any) => f.is_primary_key)
          if (pkField && pkField.db_column_name) {
            levelPkName = pkField.db_column_name
          }
        }
      } else {
        levelPkName = primaryKeyName || 'id'
      }

      const rowId =
        row[levelPkName] !== undefined
          ? row[levelPkName]
          : row[levelPkName.toUpperCase()] !== undefined
          ? row[levelPkName.toUpperCase()]
          : row.id !== undefined
          ? row.id
          : row.ID
      let params = `edit_id=${rowId}`
      if (typeof window !== 'undefined' && window.location.search.includes('preview=')) {
        const previewParam = new URLSearchParams(window.location.search).get('preview')
        params += `&preview=${previewParam}`
      }

      const isDrawer = levelConfig.edit_usecase_open_mode === 'drawer'
      const isPageMode = levelConfig.edit_usecase_open_mode === 'page'

      const finalUrl = isEjectedApp
        ? `/${targetSlug}?${params}`
        : `/${workspace.slug}/${project.slug}/${targetSlug}?${params}`

      if (isPageMode) {
        window.location.href = finalUrl
      } else {
        setIframeUrl(`${finalUrl}&embedded=true`)
        setIframeTitle(`Editar Registro`)
        if (isDrawer) {
          setIsIframeDrawerOpen(true)
        } else {
          setIsIframeModalOpen(true)
        }
      }
    } else {
      if (levelIndex === 0) {
        const mode = levelConfig?.edit_usecase_open_mode || (isModal ? 'modal' : isPage ? 'page' : 'drawer')
        handleOpenEdit(row, mode)
      }
    }
  }

  const handleOpenDelete = (row: any) => {
    setSelectedRow(row)
    setIsDeleteModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header com Branding Dinâmico */}
      <ViewPageHeader
        viewName={viewName}
        description={description}
        icon={icon}
        workspace={workspace}
        project={project}
        isAutomationsEnabled={isAutomationsEnabled}
        viewId={viewId}
        logicType={logicType}
        canExport={canExport}
        exportFormats={exportFormats}
        modelName={modelName}
        cleanDisplayFields={cleanDisplayFields}
        joins={joins}
        globalFilterValues={globalFilterValues}
        isPageVisible={isPageVisible}
        isModalOpen={isModalOpen}
        isDrawerOpen={isDrawerOpen}
        selectedRow={selectedRow}
        activeRelations={activeRelations}
        masterModelId={masterModelId}
        tableDictionary={tableDictionary}
        primaryKeyName={primaryKeyName}
        canAdd={canAdd}
        btnAdd={btnAdd}
        labelAdd={labelAdd}
        handleOpenAdd={handleOpenAdd}
        getButtonStyles={getButtonStyles}
      />

      <main className="px-10 py-6 pb-8 space-y-8">
        {(isPage && isPageVisible) || isCadastroOnly ? (
          <ViewPageFormRenderer
            logicType={logicType}
            formHeaderTitle={formHeaderTitle}
            formHeaderSubtitleField={formHeaderSubtitleField}
            drawerMode={drawerMode}
            selectedRow={selectedRow}
            isCadastroOnly={isCadastroOnly}
            setIsPageVisible={setIsPageVisible}
            cleanFormFields={cleanFormFields}
            customSlots={customSlots}
            masterModelId={masterModelId}
            autoOpenSlotConfig={autoOpenSlotConfig}
            modelName={modelName}
            project={project}
            tunnelChannel={tunnelChannel}
            isTunnelReady={isTunnelReady}
            handleSave={handleSave}
            isProcessing={isProcessing}
            dictionary={dictionary}
            joins={joins}
            customActions={customActions}
            handleCustomAction={handleCustomAction}
            refreshKey={refreshKey}
            relationalRefreshKey={relationalRefreshKey}
            detailsInterfaceTypes={detailsInterfaceTypes}
            detailsInlineTypes={detailsInlineTypes}
            detailsItemTitles={detailsItemTitles}
            detailsTabTitles={detailsTabTitles}
            detailsDisplayMode={detailsDisplayMode}
            tabsStyleConfig={tabsStyleConfig}
            masterTabTitle={masterTabTitle}
            hiddenDetails={hiddenDetails}
            handleEditDetail={handleEditDetail}
            handleDeleteDetail={handleDeleteDetail}
            handleOpenAddDetail={handleOpenAddDetail}
            projectRelations={projectRelations}
            activeTabForMaster={activeTabForMaster}
            setActiveTabForMaster={setActiveTabForMaster}
          />
        ) : (
          <>
            {(logicType === 'analytics' ||
              (localAnalyticsConfig?.widgets?.length ?? initialAnalyticsConfig?.widgets?.length ?? 0) > 0) && (
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
              onEditLevel={handleEditLevel}
              onDelete={handleOpenDelete}
              customActions={gridCustomActions}
              onCustomAction={handleCustomAction}
              projectRelations={projectRelations}
              initialItemsPerPage={initialItemsPerPage}
            />
          </>
        )}
      </main>

      <ViewActionModals
        isDrawerOpen={isDrawerOpen}
        isModalOpen={isModalOpen}
        isDeleteModalOpen={isDeleteModalOpen}
        isIframeModalOpen={isIframeModalOpen}
        isIframeDrawerOpen={isIframeDrawerOpen}
        isWidgetModalOpen={isWidgetModalOpen}
        setOpen={setOpen}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        setIsIframeModalOpen={setIsIframeModalOpen}
        setIsIframeDrawerOpen={setIsIframeDrawerOpen}
        setIsWidgetModalOpen={setIsWidgetModalOpen}
        setEditingWidget={setEditingWidget}
        drawerMode={drawerMode}
        selectedRow={selectedRow}
        iframeTitle={iframeTitle}
        iframeUrl={iframeUrl}
        editingWidget={editingWidget}
        handleSave={handleSave}
        handleDelete={handleDelete}
        handleSaveWidgetRuntime={handleSaveWidgetRuntime}
        cleanFormFields={cleanFormFields}
        modelName={modelName}
        project={project}
        dictionary={dictionary}
        detailsDisplayMode={detailsDisplayMode}
        detailsInterfaceTypes={detailsInterfaceTypes}
        detailsInlineTypes={detailsInlineTypes}
        detailsModalSizes={detailsModalSizes}
        detailsModalWidths={detailsModalWidths}
        detailsModalHeights={detailsModalHeights}
        masterTabTitle={masterTabTitle}
        detailsTabTitles={detailsTabTitles}
        detailsItemTitles={detailsItemTitles}
        tabsStyleConfig={tabsStyleConfig}
        logicType={logicType}
        isTunnelReady={isTunnelReady}
        tunnelChannel={tunnelChannel}
        isProcessing={isProcessing}
        masterModelId={masterModelId}
        handleEditDetail={handleEditDetail}
        handleDeleteDetail={handleDeleteDetail}
        handleOpenAddDetail={handleOpenAddDetail}
        joins={joins}
        activeTabForMaster={activeTabForMaster}
        setActiveTabForMaster={setActiveTabForMaster}
        customActions={customActions}
        handleCustomAction={handleCustomAction}
        refreshKey={refreshKey}
        customSlots={customSlots}
      />

      <ViewDetailModals
        detailHistory={detailHistory}
        project={project}
        detailsInterfaceTypes={detailsInterfaceTypes}
        detailsTabTitles={detailsTabTitles}
        detailsItemTitles={detailsItemTitles}
        detailsDisplayMode={detailsDisplayMode}
        tabsStyleConfig={tabsStyleConfig}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        detailsModalSizes={detailsModalSizes}
        detailsModalWidths={detailsModalWidths}
        detailsModalHeights={detailsModalHeights}
        handleCloseDetail={handleCloseDetail}
        tunnelChannel={tunnelChannel}
        isTunnelReady={isTunnelReady}
        customActions={customActions}
        handleCustomAction={handleCustomAction}
        projectRelations={projectRelations}
        formFields={formFields}
        currentDetailTable={currentDetailTable}
        selectedDetail={selectedDetail}
        isDetailModalOpen={isDetailModalOpen}
        isDetailDrawerOpen={isDetailDrawerOpen}
        detailModalMode={detailModalMode}
        detailFieldsToRender={detailFieldsToRender}
        handleSaveDetail={handleSaveDetail}
        isProcessing={isProcessing}
        handleEditDetail={handleEditDetail}
        handleDeleteDetail={handleDeleteDetail}
        handleOpenAddDetail={handleOpenAddDetail}
        activeTabForDetail={activeTabForDetail}
        setActiveTabForDetail={setActiveTabForDetail}
        refreshKey={refreshKey}
        isDetailDeleteModalOpen={isDetailDeleteModalOpen}
        setIsDetailDeleteModalOpen={setIsDetailDeleteModalOpen}
        itemToDelete={itemToDelete}
        setItemToDelete={setItemToDelete}
        handleConfirmDeleteDetail={handleConfirmDeleteDetail}
      />
    </div>
  )
}
