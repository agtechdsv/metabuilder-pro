'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Search, Filter, Plus, Pencil, Trash2, RefreshCcw, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Zap, Link, Database, Globe, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import DynamicGrid from '@/components/DynamicGrid'
import DynamicIcon from '@/components/runtime/DynamicIcon'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'
import { ViewFilterBar } from './ViewFilterBar'
import { ViewListRenderer } from './ViewListRenderer'

import DynamicCardList from './DynamicCardList'
import DynamicKanban from './DynamicKanban'
import DynamicMindMap from './DynamicMindMap'
import DynamicScheduler from './DynamicScheduler'
import DynamicGallery from './DynamicGallery'
import DynamicTimeline from './DynamicTimeline'
import DynamicMap from './DynamicMap'
import DynamicGantt from './DynamicGantt'
import DynamicBlueprint from './DynamicBlueprint'

import { useViewCustomActions } from './hooks/useViewCustomActions'
import { useViewFilters } from './hooks/useViewFilters'
import { useViewDataFetch } from './hooks/useViewDataFetch'

interface ViewContainerProps {
  projectId: string
  modelName: string
  displayFields: any[]
  filterFields: any[]
  formFields: any[]
  displayType: 'list' | 'card' | 'both'
  defaultView?: 'list' | 'card'
  buttonsConfig: any[]
  locale: string
  onAdd?: (initialData?: any) => void
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onEditLevel?: (levelIndex: number, row: any) => void
  onDelete?: (row: any) => void
  logicType?: string
  primaryKeyName?: string
  kanbanGroupField?: string
  kanbanGroupDisplayField?: string
  kanbanCardFields?: string[]
  mindmapCentralField?: string
  mindmapLevels?: any[]
  schedulerConfig?: any
  timelineConfig?: any
  initialEditId?: string | null
  mapConfig?: any
  ganttConfig?: any
  blueprintConfig?: any
  masterModelId?: string
  dictionary?: any
  joins?: any[]
  project?: any
  actionInterfaceType?: 'drawer' | 'modal' | 'page'
  externalFilters?: Record<string, string>
  advancedStaticFilters?: any[]
  onFiltersChange?: (filters: Record<string, string>) => void
  tunnelChannel?: any
  isTunnelReady?: boolean
  galleryClickBehavior?: 'fullscreen' | 'thumbnail'
  galleryConfig?: any
  customActions?: any[]
  externalRefreshTrigger?: number
  onCustomAction?: (action: any, row?: any) => void
  projectRelations?: any[]
  detailsDisplayMode?: Record<string, string>
  initialItemsPerPage?: number
  filterGridColumns?: string
  exportFormats?: string[]
}

const getBulkActionClasses = (color: string) => {
  const normalized = color?.toLowerCase() || 'indigo'
  switch (normalized) {
    case 'emerald':
      return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
    case 'amber':
      return 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
    case 'red':
      return 'bg-red-655 hover:bg-red-500 text-white shadow-red-500/20'
    case 'blue':
      return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
    case 'violet':
      return 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-500/20'
    case 'pink':
      return 'bg-pink-655 hover:bg-pink-500 text-white shadow-pink-500/20'
    case 'rose':
      return 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
    case 'neutral':
    case 'gray':
      return 'bg-neutral-600 hover:bg-neutral-500 text-white shadow-neutral-500/20'
    case 'indigo':
    default:
      return 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
  }
}

const getFontFamily = (font?: string) => {
  if (!font) return undefined;
  const cleanFont = font.replace(' (Padrão)', '');
  if (cleanFont.includes('Mono')) return `"${cleanFont}", monospace`;
  return `"${cleanFont}", sans-serif`;
}

const getFontSize = (size?: string) => {
  if (!size) return undefined;
  if (!isNaN(Number(size))) return `${size}px`;
  return size;
}

export default function ViewContainer({
  projectId,
  modelName,
  displayFields,
  filterFields = [],
  displayType = 'list',
  defaultView = 'list',
  buttonsConfig = [],
  formFields = [],
  locale,
  onAdd,
  onView,
  onEdit,
  onDelete,
  logicType,
  primaryKeyName = 'id',
  kanbanGroupField,
  kanbanGroupDisplayField,
  kanbanCardFields,
  mindmapCentralField,
  mindmapLevels,
  schedulerConfig,
  timelineConfig,
  initialEditId,
  mapConfig,
  ganttConfig,
  blueprintConfig,
  masterModelId,
  dictionary = {},
  joins = [],
  project,
  actionInterfaceType = 'drawer',
  externalFilters = {},
  advancedStaticFilters = [],
  onFiltersChange,
  tunnelChannel,
  isTunnelReady,
  galleryClickBehavior,
  galleryConfig,
  customActions = [],
  externalRefreshTrigger = 0,
  onCustomAction,
  projectRelations = [],
  initialItemsPerPage,
  onEditLevel,
  filterGridColumns = '12'
}: ViewContainerProps) {
  const { toast } = useToast()
  const router = useRouter()
  const { t } = useI18n()

  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [timelineDirection, setTimelineDirection] = useState<'horizontal' | 'vertical'>(timelineConfig?.layout_direction || 'vertical')

  useEffect(() => {
    if (timelineConfig?.layout_direction) {
      setTimelineDirection(timelineConfig.layout_direction)
    }
  }, [timelineConfig?.layout_direction])

  const initialViewMode = logicType === 'mapa_mental' ? 'mapa_mental' : logicType === 'blueprint' ? 'blueprint' : logicType === 'timeline' ? 'timeline' : logicType === 'map' ? 'map' : logicType === 'gantt' ? 'gantt' : logicType === 'kanban' ? 'kanban' : logicType === 'scheduler' ? 'scheduler' : logicType === 'galeria' ? 'galeria' : (displayType === 'both' ? defaultView : (displayType as any))
  const [viewMode, setViewModeState] = useState<'list' | 'card' | 'kanban' | 'mapa_mental' | 'scheduler' | 'galeria' | 'timeline' | 'map' | 'gantt' | 'blueprint'>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(`metabuilder_viewmode_${projectId}_${modelName}`);
      if (saved) return saved as any;
    }
    return initialViewMode;
  });

  const setViewMode = (mode: 'list' | 'card' | 'kanban' | 'mapa_mental' | 'scheduler' | 'galeria' | 'timeline' | 'map' | 'gantt' | 'blueprint') => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`metabuilder_viewmode_${projectId}_${modelName}`, mode);
    }
  }

  // 1. Hook de Ações Customizadas
  const {
    iframeUrl,
    setIframeUrl,
    iframeTitle,
    setIframeTitle,
    isIframeModalOpen,
    setIsIframeModalOpen,
    iframeModalSize,
    setIframeModalSize,
    iframeModalWidth,
    setIframeModalWidth,
    iframeModalHeight,
    setIframeModalHeight,
    isIframeDrawerOpen,
    setIsIframeDrawerOpen,
    handleCustomAction
  } = useViewCustomActions({
    projectId,
    modelName,
    project,
    tunnelChannel,
    isTunnelReady: isTunnelReady ?? false,
    onCustomAction,
    setRefreshTrigger
  })

  // 2. Hook de Filtros
  const {
    searchQuery,
    setSearchQuery,
    internalFilters,
    filterValues,
    setFilterValues,
    relationalOptions,
    parseFixedOptions,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortConfig,
    setSortConfig,
    handleSort,
    handleClear,
    computeDynamicDate
  } = useViewFilters({
    projectId,
    modelName,
    project,
    tunnelChannel,
    isTunnelReady: isTunnelReady ?? false,
    filterFields,
    displayFields,
    externalFilters,
    onFiltersChange,
    refreshTrigger,
    initialItemsPerPage,
    viewMode
  })

  // 3. Hook de Fetch de Dados
  const {
    data,
    setData,
    isLoading,
    isFetchingBackground,
    error,
    totalServerRows,
    fetchData,
    handleMove,
    hasFetchedInitial,
    setHasFetchedInitial
  } = useViewDataFetch({
    projectId,
    modelName,
    project,
    tunnelChannel,
    isTunnelReady,
    primaryKeyName,
    joins,
    projectRelations,
    displayFields,
    filterFields,
    formFields,
    advancedStaticFilters,
    kanbanGroupField,
    kanbanCardFields,
    galleryConfig,
    schedulerConfig,
    timelineConfig,
    mapConfig,
    ganttConfig,
    blueprintConfig,
    logicType,
    timelineDirection,
    currentPage,
    itemsPerPage,
    filterValues,
    initialEditId,
    onEdit,
    onCustomAction
  })

  // Efeitos para Sincronizar Fetch com Filtros e Eventos
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (!isTunnelReady) return

    if (isFirstRender.current) {
      // already managed mostly by hook init, debounce to fetch fresh
    }

    const handler = setTimeout(() => {
      fetchData(filterValues, true)
      isFirstRender.current = false
    }, isFirstRender.current ? 50 : 400)

    return () => clearTimeout(handler)
  }, [projectId, modelName, isTunnelReady, JSON.stringify(filterValues)])

  useEffect(() => {
    if (isTunnelReady && tunnelChannel && !hasFetchedInitial && data.length === 0) {
      setHasFetchedInitial(true)
      fetchData(filterValues)
    }
  }, [isTunnelReady, tunnelChannel, hasFetchedInitial, data.length])

  const isFirstRenderPag = useRef(true)
  useEffect(() => {
    if (isFirstRenderPag.current) {
      isFirstRenderPag.current = false
      return
    }
    if (isTunnelReady) {
      fetchData(filterValues, true)
    }
  }, [currentPage, itemsPerPage, timelineDirection])

  useEffect(() => {
    if (refreshTrigger > 0) {
      toast('Atualizando dados...', 'info')
      fetchData(filterValues, true)
    }
  }, [refreshTrigger])

  useEffect(() => {
    if (externalRefreshTrigger > 0) {
      fetchData(filterValues, true)
    }
  }, [externalRefreshTrigger])

  const prevExternalFiltersStr = useRef(JSON.stringify(externalFilters || {}))
  useEffect(() => {
    const currentStr = JSON.stringify(externalFilters || {})
    if (prevExternalFiltersStr.current !== currentStr) {
      prevExternalFiltersStr.current = currentStr
      if (hasFetchedInitial && isTunnelReady) {
        const newFilterValues = { ...(externalFilters || {}), ...internalFilters }
        fetchData(newFilterValues, true)
      }
    }
  }, [externalFilters, hasFetchedInitial, isTunnelReady, internalFilters])

  const handleSearchClick = () => {
    fetchData(filterValues, true)
  }

  // Ordenação Local (como os dados já vêm ordenados do servidor se a coluna assim mandar, isso permite sort na página)
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0
    const { key, direction } = sortConfig
    const valA = a[key]
    const valB = b[key]
    if (valA < valB) return direction === 'asc' ? -1 : 1
    if (valA > valB) return direction === 'asc' ? 1 : -1
    return 0
  })

  const totalPages = totalServerRows > 0 ? Math.ceil(totalServerRows / itemsPerPage) : Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = sortedData

  const canSearch = buttonsConfig.find((b: any) => b.id === 'search')?.visible === true
  const canClear = buttonsConfig.find((b: any) => b.id === 'clear')?.visible === true

  const getButtonStyles = (btn: any) => {
    if (!btn) return {}
    const styles: React.CSSProperties = {}
    if (btn.font_family && btn.font_family !== 'Inter (Padrão)') styles.fontFamily = btn.font_family
    if (btn.font_size) styles.fontSize = btn.font_size
    if (btn.text_color) styles.color = btn.text_color
    if (btn.bg_color) {
      styles.backgroundColor = btn.bg_color
      styles.borderColor = btn.bg_color
    }
    const textTrans = btn.text_transform !== undefined ? btn.text_transform : 'capitalize'
    if (textTrans && textTrans !== 'none') styles.textTransform = textTrans
    return styles
  }

  const btnSearch = buttonsConfig?.find((b: any) => b.id === 'search')
  const btnClear = buttonsConfig?.find((b: any) => b.id === 'clear')

  const labelSearch = btnSearch?.custom_label !== undefined && btnSearch.custom_label !== '' ? btnSearch.custom_label : t('runtime.search')
  const labelClear = btnClear?.custom_label !== undefined && btnClear.custom_label !== '' ? btnClear.custom_label : t('runtime.clear')

  let correctedKanbanGroupDisplayField = kanbanGroupDisplayField;
  
  const { resolveDynamicFieldDef } = require('@/lib/field-resolver');
  const actualGroupField = resolveDynamicFieldDef(kanbanGroupField, displayFields, modelName) 
    || displayFields.find(f => f.db_column_name === 'status') 
    || { db_column_name: 'status' };
    
  if (kanbanGroupDisplayField && !kanbanGroupDisplayField.includes('.')) {
    const join = joins?.find(j => j.localKey === actualGroupField.db_column_name || j.foreignKey === actualGroupField.db_column_name);
    if (join) {
      const relTableName = join.to === modelName ? join.from : join.to;
      correctedKanbanGroupDisplayField = `${relTableName}.${kanbanGroupDisplayField}`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar - Custom Actions & Toggles */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {customActions.filter(a => (a.contexts ? (Array.isArray(a.contexts) ? a.contexts : [a.contexts]) : [a.context]).includes('bulk')).map(action => (
            <button
              key={action.id}
              onClick={() => handleCustomAction(action)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs capitalize tracking-wider transition-all shadow-lg",
                getBulkActionClasses(action.color)
              )}
            >
              <DynamicIcon icon={action.icon || 'Zap'} className="w-3.5 h-3.5" />
              {action.label}
            </button>
          ))}
        </div>

        {displayType === 'both' && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900/50 p-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
              {defaultView === 'card' ? (
                <>
                  <button onClick={() => setViewMode('card')} className={cn("p-2 rounded-lg transition-all", viewMode === 'card' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600')}><LayoutGrid className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600')}><List className="w-4 h-4" /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setViewMode('list')} className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600')}><List className="w-4 h-4" /></button>
                  <button onClick={() => setViewMode('card')} className={cn("p-2 rounded-lg transition-all", viewMode === 'card' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600')}><LayoutGrid className="w-4 h-4" /></button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Filter Arguments Bar */}
      {filterFields.length > 0 && <ViewFilterBar
        filterFields={filterFields} filterValues={filterValues} setFilterValues={setFilterValues}
        relationalOptions={relationalOptions} parseFixedOptions={parseFixedOptions}
        btnSearch={btnSearch} btnClear={btnClear} canSearch={canSearch} canClear={canClear}
        handleSearchClick={handleSearchClick} handleClear={handleClear} fetchData={fetchData}
        t={t} getButtonStyles={getButtonStyles} getFontFamily={getFontFamily} getFontSize={getFontSize}
        filterGridColumns={filterGridColumns}
      />}
      {/* Data Display */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-neutral-400 bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem]">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <div className="text-center">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-200">{t('runtime.connecting')}</h3>
            <p className="text-sm">{t('runtime.fetching_tunnel')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="py-20 text-center bg-red-50/10 border border-red-500/20 rounded-[2rem]">
          <p className="text-red-500 font-bold">{error}</p>
        </div>
      ) : viewMode === 'list' ? (
        <ViewListRenderer
          displayFields={displayFields} paginatedData={paginatedData} buttonsConfig={buttonsConfig}
          customActions={customActions} handleCustomAction={handleCustomAction} relationalOptions={relationalOptions}
          handleSort={handleSort} sortConfig={sortConfig} onView={onView} onEdit={onEdit} onDelete={onDelete}
          isFetchingBackground={isFetchingBackground} isLoading={isLoading} itemsPerPage={itemsPerPage}
          setItemsPerPage={setItemsPerPage} currentPage={currentPage} setCurrentPage={setCurrentPage}
          totalServerRows={totalServerRows} totalPages={totalPages} fetchData={fetchData} filterValues={filterValues} data={data}
          t={t} getFontFamily={getFontFamily} getFontSize={getFontSize}
        />
      ) : viewMode === 'kanban' ? (
        <div className={cn("space-y-6 transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicKanban
            data={data}
            fields={displayFields}
            groupField={actualGroupField}
            kanbanGroupDisplayField={correctedKanbanGroupDisplayField}
            kanbanCardFields={kanbanCardFields}
            relationalOptions={relationalOptions}
            dictionary={dictionary}
            onMove={handleMove}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            customActions={customActions}
            onCustomAction={handleCustomAction}
          />
        </div>
      ) : viewMode === 'scheduler' ? (
        <div className={cn("transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicScheduler
            data={data}
            fields={displayFields}
            schedulerConfig={schedulerConfig || {}}
            kanbanCardFields={kanbanCardFields}
            relationalOptions={relationalOptions}
            onMove={handleMove}
            onAdd={onAdd}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            dictionary={dictionary}
            customActions={customActions}
            onCustomAction={handleCustomAction}
          />
        </div>
      ) : viewMode === 'timeline' ? (
        <div className={cn("transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicTimeline
            data={data}
            fields={displayFields}
            timelineConfig={timelineConfig || {}}
            relationalOptions={relationalOptions}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onRefresh={() => fetchData(filterValues, true)}
            dictionary={dictionary}
            customActions={customActions}
            onCustomAction={handleCustomAction}
            onLoadMore={() => fetchData(filterValues, false, true)}
            hasMore={data.length < totalServerRows}
            totalRecords={totalServerRows}
            direction={timelineDirection}
            onDirectionChange={(newDir) => {
              setTimelineDirection(newDir);
              setData([]);
              setCurrentPage(1);
            }}
          />
        </div>
      ) : viewMode === 'map' ? (
        <div className={cn("transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicMap
            data={data}
            fields={displayFields}
            mapConfig={mapConfig || {}}
            relationalOptions={relationalOptions}
            onView={onView!}
            onEdit={onEdit!}
            onDelete={onDelete!}
            customActions={customActions}
            onCustomAction={handleCustomAction}
          />
        </div>
      ) : viewMode === 'gantt' ? (
        <div className={cn("transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicGantt
            data={data}
            fields={displayFields}
            ganttConfig={ganttConfig || {}}
            relationalOptions={relationalOptions}
            onView={onView!}
            onEdit={onEdit!}
            onDelete={onDelete!}
            dictionary={dictionary}
            customActions={customActions}
            onCustomAction={handleCustomAction}
          />
        </div>
      ) : viewMode === 'blueprint' ? (
        <div className={cn("transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicBlueprint
            data={data}
            fields={displayFields}
            blueprintConfig={blueprintConfig || {}}
            relationalOptions={relationalOptions}
            onView={onView!}
            onEdit={onEdit!}
            onDelete={onDelete!}
            onMove={handleMove}
            onRefresh={() => fetchData(filterValues, true)}
            dictionary={dictionary}
            customActions={customActions}
            onCustomAction={handleCustomAction}
          />
        </div>
      ) : viewMode === 'mapa_mental' ? (
        <div className={cn("transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicMindMap
            data={data}
            fields={displayFields}
            centralFieldId={mindmapCentralField}
            relationalOptions={relationalOptions}
            mindmapLevels={mindmapLevels}
            projectId={projectId}
            onView={onView}
            onEdit={onEdit}
            onEditLevel={onEditLevel}
            onDelete={onDelete}
            primaryKeyName={primaryKeyName}
            dictionary={dictionary}
            models={project?.models || []}
            project={project}
            tunnelChannel={tunnelChannel}
            isTunnelReady={isTunnelReady}
            customActions={customActions}
            onCustomAction={handleCustomAction}
            refreshTrigger={refreshTrigger + (externalRefreshTrigger || 0)}
          />
        </div>
      ) : viewMode === 'galeria' ? (
        <div className={cn("transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicGallery
            data={data}
            fields={displayFields}
            buttonsConfig={buttonsConfig}
            relationalOptions={relationalOptions}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            galleryClickBehavior={galleryClickBehavior}
            galleryConfig={galleryConfig}
            customActions={customActions}
            onCustomAction={handleCustomAction}
          />
        </div>
      ) : (
        <div className={cn("space-y-6 transition-opacity duration-300", isFetchingBackground && "opacity-50 pointer-events-none")}>
          <DynamicCardList
            fields={displayFields.filter(f => !f.hidden)}
            data={paginatedData}
            buttonsConfig={buttonsConfig}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            customActions={customActions}
            onCustomAction={handleCustomAction}
            relationalOptions={relationalOptions}
          />

          <div className="flex items-center justify-center gap-4 py-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 bg-white dark:bg-neutral-900 px-6 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
              <span>{t('runtime.page')} <span className="text-indigo-600">{currentPage}</span> {t('runtime.of')} {totalPages || 1}</span>
              {data.length >= 100 && (data.length % 100 === 0) && (
                <>
                  <span className="mx-1 opacity-20">|</span>
                  <button
                    onClick={() => fetchData(filterValues, false, true)}
                    disabled={isLoading}
                    className="text-indigo-600 dark:text-indigo-400 hover:opacity-80 transition-all disabled:opacity-50 flex items-center gap-1 font-black"
                  >
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                    {t('runtime.more', 'Mais')}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-600 transition-all shadow-sm disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {viewMode !== 'list' && viewMode !== 'card' && data.length > 0 && data.length < totalServerRows && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <button
            onClick={() => fetchData(filterValues, false, true)}
            disabled={isLoading}
            className="px-6 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-full text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl disabled:opacity-50 flex items-center gap-2 ring-1 ring-black/5 dark:ring-white/10"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <RefreshCcw className="w-4 h-4 text-indigo-500" />}
            {t('runtime.load_more_dynamic', 'Carregar mais')} ({data.length} de {totalServerRows})
          </button>
        </div>
      )}

      <Modal
        isOpen={isIframeModalOpen}
        onClose={() => {
          setIsIframeModalOpen(false)
          setIframeUrl('')
          setRefreshTrigger(prev => prev + 1)
        }}
        title={iframeTitle}
        size={iframeModalSize === 'custom' ? 'custom' : (iframeModalSize as any || '4xl')}
        customWidth={iframeModalSize === 'custom' ? iframeModalWidth : undefined}
        customHeight={iframeModalSize === 'custom' ? iframeModalHeight : undefined}
        hideHeader={true}
        className="!p-0 bg-transparent shadow-none border-none dark:bg-transparent"
      >
        <div
          className="w-full bg-white dark:bg-neutral-950 rounded-[2.5rem] overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800"
          style={{ height: iframeModalSize === 'custom' && iframeModalHeight ? (isNaN(Number(iframeModalHeight)) ? iframeModalHeight : `${iframeModalHeight}px`) : '85vh' }}
        >
          {isIframeModalOpen && <iframe src={iframeUrl} className="w-full h-full border-none" />}
        </div>
      </Modal>

      <Drawer
        isOpen={isIframeDrawerOpen}
        onClose={() => {
          setIsIframeDrawerOpen(false)
          setIframeUrl('')
          setRefreshTrigger(prev => prev + 1)
        }}
        title={iframeTitle}
        hideHeader={true}
      >
        <div className="w-full h-full bg-white dark:bg-neutral-950">
          {isIframeDrawerOpen && <iframe src={iframeUrl} className="w-full h-full border-none" />}
        </div>
      </Drawer>
    </div>
  )
}
