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
  Database 
} from 'lucide-react'
import { HeaderActions } from '@/components/layout/HeaderActions'
import RecordDrawer from './RecordDrawer'
import RecordModal from './RecordModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'
import { useI18n } from '@/i18n/I18nContext'

import RecordForm from './RecordForm'
import { RuntimeHeader } from './RuntimeHeader'
import AnalyticsDashboard from './AnalyticsDashboard'
import { BIWidgetEditor as BIWidgetConfigEditor } from '@/components/shared/BIWidgetEditor'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { ExportDropdown, ActiveDownloadsWidget } from './ExportControls'

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
  schedulerConfig?: any
  dictionary?: any
  joins?: any[]
  masterModelId?: string
  detailDisplayMode?: 'tabs' | 'sections'
  actionInterfaceType?: 'drawer' | 'modal' | 'page'
  detailsInterfaceTypes?: Record<string, string>
  detailsInlineTypes?: Record<string, boolean>
  baseUrl?: string
  breadcrumbs?: { label: string; href: string }[]
  description?: string
  icon?: string
  analyticsConfig?: {
    widgets: any[]
    allow_runtime_edit: boolean
  }
  exportFormats?: string[]
}

import { RuntimeBreadcrumbs } from './RuntimeBreadcrumbs'

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
  schedulerConfig,
  dictionary = {},
  joins = [],
  masterModelId,
  detailDisplayMode,
  detailsInterfaceTypes,
  detailsInlineTypes,
  actionInterfaceType = 'drawer',
  baseUrl,
  breadcrumbs = [],
  description,
  icon,
  exportFormats = ['xlsx', 'csv', 'json'],
  analyticsConfig: initialAnalyticsConfig
}: ViewPageContentProps) {

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

  const { t } = useI18n()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [isDetailDeleteModalOpen, setIsDetailDeleteModalOpen] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<any>(null)
  const [detailFieldsToRender, setDetailFieldsToRender] = useState<any[]>([])
  const [detailModalMode, setDetailModalMode] = useState<'create' | 'edit'>('edit')
  const [currentDetailTable, setCurrentDetailTable] = useState('')
  const [parentRowIdForDetail, setParentRowIdForDetail] = useState<any>(null)
  const [itemToDelete, setItemToDelete] = useState<any>(null)
  const [detailHistory, setDetailHistory] = useState<any[]>([])
  const [activeTabForDetail, setActiveTabForDetail] = useState<string>('master')
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)

  const { toast } = useToast()
  const [localAnalyticsConfig, setLocalAnalyticsConfig] = useState(initialAnalyticsConfig)
  const [editingWidget, setEditingWidget] = useState<any>(null)
  const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false)
  const [globalFilterValues, setGlobalFilterValues] = useState<Record<string, string>>({})

  // --- GESTÃO CENTRALIZADA DO TÚNEL SEGURO ---
  const supabase = createClient()
  const [tunnelChannel, setTunnelChannel] = useState<any>(null)
  const [isTunnelReady, setIsTunnelReady] = useState(false)

  useEffect(() => {
    if (!project?.id) return

    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)
    
    console.log(`[MetaBuilder] 📡 Abrindo Túnel Centralizado: ${channelName}`)
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[MetaBuilder] ✅ Túnel Centralizado PRONTO.`)
        setTunnelChannel(channel)
        setIsTunnelReady(true)
      }
    })

    return () => {
      console.log(`[MetaBuilder] 🔌 Fechando Túnel Centralizado.`)
      channel.unsubscribe()
      setTunnelChannel(null)
      setIsTunnelReady(false)
    }
  }, [project?.id])

  // --- REAL-TIME DOWNLOAD PROGRESS LISTENER ---
  const [activeDownloads, setActiveDownloads] = useState<any[]>([])

  const handleRemoveDownload = (jobId: string) => {
    setActiveDownloads(prev => prev.filter(d => d.jobId !== jobId))
  }

  useEffect(() => {
    if (!tunnelChannel || !isTunnelReady) return

    const handleDownloadProgress = (payload: any) => {
      const job = payload.payload
      if (!job || !job.jobId) return

      console.log('[MetaBuilder] Live download progress event:', job)

      setActiveDownloads(prev => {
        // Automatically hide completed/failed jobs after 10 seconds
        if (job.status === 'completed' || job.status === 'failed') {
          setTimeout(() => {
            setActiveDownloads(current => current.filter(d => d.jobId !== job.jobId))
          }, 10000)
        }

        const exists = prev.some(d => d.jobId === job.jobId)
        if (exists) {
          return prev.map(d => d.jobId === job.jobId ? job : d)
        } else {
          return [...prev, job]
        }
      })
    }

    tunnelChannel.on('broadcast', { event: 'download_progress' }, handleDownloadProgress)

    return () => {
      const bindings = tunnelChannel.bindings?.broadcast
      if (Array.isArray(bindings)) {
        const binding = bindings.find((b: any) => b.callback === handleDownloadProgress)
        if (binding) {
          if (tunnelChannel.channelAdapter) {
            tunnelChannel.channelAdapter.off('broadcast', binding.ref)
          }
          tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleDownloadProgress)
        }
      }
    }
  }, [tunnelChannel, isTunnelReady])

  const handleAddWidgetRuntime = () => {
    setEditingWidget({
      id: Math.random().toString(36).substr(2, 9),
      title: 'Novo Widget',
      type: 'kpi',
      model_id: project.models?.[0]?.id || '',
      field: '',
      calc: 'COUNT',
      group_by: '',
      width: 'half'
    })
    setIsWidgetModalOpen(true)
  }

  const handleEditWidgetRuntime = (widget: any) => {
    setEditingWidget(widget)
    setIsWidgetModalOpen(true)
  }

  const handleSaveWidgetRuntime = async (updatedWidget: any) => {
    const currentConfig = localAnalyticsConfig || initialAnalyticsConfig || { widgets: [], allow_runtime_edit: true }
    const currentWidgets = currentConfig.widgets || []
    const exists = currentWidgets.find((w: any) => w.id === updatedWidget.id)
    
    let newWidgets
    if (exists) {
      newWidgets = currentWidgets.map((w: any) => w.id === updatedWidget.id ? updatedWidget : w)
    } else {
      newWidgets = [...currentWidgets, updatedWidget]
    }

    const newConfig = { ...currentConfig, widgets: newWidgets }
    setLocalAnalyticsConfig(newConfig)
    setIsWidgetModalOpen(false)
    setEditingWidget(null)

    // Persistir no banco
    try {
      // Primeiro buscamos a view atual para não sobrescrever outros campos do layout_config
      const { data: viewData } = await supabase.from('ui_views').select('layout_config').eq('id', viewId).single()
      const updatedLayoutConfig = { ...viewData?.layout_config, analytics_config: newConfig }

      // Auto-Discovery: Atualiza tables_config baseado nos widgets do BI para garantir carregamento correto
      const widgetModels = (newWidgets || []).map((w: any) => w.model_id)
      const joinModels = (viewData?.layout_config?.joins || []).flatMap((j: any) => {
        const fromModel = project.models?.find((m: any) => m.db_table_name === j.from)
        const toModel = project.models?.find((m: any) => m.db_table_name === j.to)
        return [fromModel?.id, toModel?.id].filter(Boolean)
      })
      const allInvolved = Array.from(new Set([...widgetModels, ...joinModels])).filter(Boolean)

      const { error } = await supabase
        .from('ui_views')
        .update({ 
          layout_config: updatedLayoutConfig,
          tables_config: allInvolved // Sincroniza as tabelas necessárias
        })
        .eq('id', viewId)
      
      if (error) throw error
      toast('Dashboard atualizado com sucesso!', 'success')
    } catch (err: any) {
      console.error('Error persisting dashboard:', err)
      toast('Erro ao salvar dashboard: ' + err.message, 'error')
    }
  }

  const handleSaveDashboardLayout = async (newWidgets: any[]) => {
    const currentConfig = localAnalyticsConfig || initialAnalyticsConfig || { widgets: [], allow_runtime_edit: true }
    const newConfig = { ...currentConfig, widgets: newWidgets }
    setLocalAnalyticsConfig(newConfig)

    try {
      const { data: viewData } = await supabase.from('ui_views').select('layout_config').eq('id', viewId).single()
      const updatedLayoutConfig = { ...viewData?.layout_config, analytics_config: newConfig }

      const { error } = await supabase
        .from('ui_views')
        .update({ layout_config: updatedLayoutConfig })
        .eq('id', viewId)
      
      if (error) throw error
      toast('Layout do dashboard salvo com sucesso!', 'success')
    } catch (err: any) {
      console.error('Error saving dashboard layout:', err)
      toast('Erro ao salvar ordem do dashboard: ' + err.message, 'error')
    }
  }

  const handleDeleteWidgetRuntime = async (id: string) => {
    const currentConfig = localAnalyticsConfig || initialAnalyticsConfig || { widgets: [], allow_runtime_edit: true }
    const newWidgets = (currentConfig.widgets || []).filter((w: any) => w.id !== id)
    const newConfig = { ...currentConfig, widgets: newWidgets }
    
    setLocalAnalyticsConfig(newConfig)

    try {
      const { data: viewData } = await supabase.from('ui_views').select('layout_config').eq('id', viewId).single()
      const updatedLayoutConfig = { ...viewData?.layout_config, analytics_config: newConfig }
      
      // Auto-Discovery também na deleção para manter limpo
      const widgetModels = (newWidgets || []).map((w: any) => w.model_id)
      const joinModels = (updatedLayoutConfig.joins || []).flatMap((j: any) => {
        const fromModel = project.models?.find((m: any) => m.db_table_name === j.from)
        const toModel = project.models?.find((m: any) => m.db_table_name === j.to)
        return [fromModel?.id, toModel?.id].filter(Boolean)
      })
      const allInvolved = Array.from(new Set([...widgetModels, ...joinModels])).filter(Boolean)

      const { error } = await supabase
        .from('ui_views')
        .update({ 
          layout_config: updatedLayoutConfig,
          tables_config: allInvolved
        })
        .eq('id', viewId)
      
      if (error) throw error
      toast('Indicador removido.', 'info')
    } catch (err: any) {
      console.error('Error deleting widget:', err)
      toast('Erro ao remover indicador.', 'error')
    }
  }

  const isModal = actionInterfaceType === 'modal'
  const isPage = actionInterfaceType === 'page'

  const setOpen = (val: boolean) => {
    if (isModal) setIsModalOpen(val)
    else if (isPage) setIsPageVisible(val)
    else setIsDrawerOpen(val)
  }
  
  const isOpen = isModal ? isModalOpen : (isPage ? isPageVisible : isDrawerOpen)

  const handleOpenAdd = (initialData: any = {}) => {
    setDrawerMode('create')
    setSelectedRow(initialData)
    setOpen(true)
  }

  const fetchDetails = async (parentRow: any, parentModel: string) => {
    if (logicType !== 'master_detail' || !joins || joins.length === 0) return []

    const allDetails: any[] = []
    
    // Para cada join configurado a partir da tabela pai informada
    for (const join of joins) {
      const isMatch = join.from?.toLowerCase() === parentModel?.toLowerCase()
      console.log(`[MetaBuilder] Checking join: ${join.from} -> ${join.to} | Match: ${isMatch} (Parent: ${parentModel})`)

      if (isMatch) {
        const localValue = parentRow[join.localKey] || parentRow[join.localKey.toUpperCase()] || parentRow.id || parentRow.ID
        
        if (localValue === undefined || localValue === null) {
          console.warn(`[MetaBuilder] localValue not found for key ${join.localKey} in row:`, parentRow)
          continue
        }

        console.log(`[MetaBuilder] Fetching details from ${join.to} where ${join.foreignKey} = ${localValue}`)
        
        const { data: detailData, error } = await (supabase as any)
          .from(join.to)
          .select('*')
          .eq(join.foreignKey, localValue)

        if (error) {
          console.error(`[MetaBuilder] Error fetching details from ${join.to}:`, error)
          continue
        }

        if (detailData) {
          const modelField = detailFields.find(f => f.db_column_name.includes(join.to) || f.model_name?.toLowerCase() === join.to?.toLowerCase())
          const friendlyName = dictionary[modelField?.model_id || ''] || join.to

          console.log(`[MetaBuilder] Found ${detailData.length} records in ${join.to}. Friendly Name: ${friendlyName}`)

          allDetails.push(...detailData.map((d: any) => ({ 
            ...d, 
            model_name: join.to, // Mantém o nome original do banco para lógica de campos
            display_model_name: friendlyName // Novo campo para exibição na UI
          })))
        }
      }
    }
    console.log(`[MetaBuilder] Total details fetched: ${allDetails.length}`)
    
    // Garante que não existam registros duplicados (caso existam múltiplos JOINS para a mesma tabela)
    const seen = new Set()
    return allDetails.filter(d => {
      const duplicate = seen.has(d.id || d.ID)
      seen.add(d.id || d.ID)
      return !duplicate
    })
  }

  // Removido o filtro anterior que estava solto

  const handleOpenView = async (row: any) => {
    setDrawerMode('view')
    setIsProcessing(true)
    const details = await fetchDetails(row, modelName)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setOpen(true)
  }

  const handleOpenEdit = async (row: any) => {
    setDrawerMode('edit')
    setIsProcessing(true)
    const details = await fetchDetails(row, modelName)
    setSelectedRow({ ...row, _details: details })
    setIsProcessing(false)
    setOpen(true)
  }

  const handleOpenDelete = (row: any) => {
    setSelectedRow(row)
    setIsDeleteModalOpen(true)
  }

  const handleOpenAddDetail = (tableName: string, parentId?: any) => {
    // Se já houver um detalhe aberto, movemos para o histórico para permitir empilhamento
    if (selectedDetail && (isDetailModalOpen || isDetailDrawerOpen)) {
      setDetailHistory(prev => [...prev, {
        record: selectedDetail,
        tableName: currentDetailTable,
        fields: detailFieldsToRender,
        activeTab: activeTabForDetail
      }])
    }

    // Fecha os toggles atuais para que o nível anterior seja renderizado via history map
    setIsDetailModalOpen(false)
    setIsDetailDrawerOpen(false)

    const fields = detailFields.filter(f => f.model_name === tableName)
    setDetailFieldsToRender(fields)
    setSelectedDetail({})
    setDetailModalMode('create')
    setCurrentDetailTable(tableName)
    setParentRowIdForDetail(parentId || (selectedRow?.id || selectedRow?.ID))
    
    const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === tableName.toLowerCase())
    const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
    
    setTimeout(() => {
      if (interfaceType === 'drawer') setIsDetailDrawerOpen(true)
      else setIsDetailModalOpen(true)
    }, 0)
  }

  const handleEditDetail = async (detail: any) => {
    // Se já houver um detalhe selecionado (ex: Projeto), guardamos ele no histórico antes de ir para o Model
    if (selectedDetail && (isDetailModalOpen || isDetailDrawerOpen)) {
      setDetailHistory(prev => [...prev, {
        record: selectedDetail,
        tableName: currentDetailTable,
        fields: detailFieldsToRender,
        activeTab: activeTabForDetail
      }])
    }

    // Fechamos os toggles do nível atual pois ele será movido para o histórico
    // e renderizado pelo map(detailHistory). O novo nível será aberto no setTimeout.
    setIsDetailModalOpen(false)
    setIsDetailDrawerOpen(false)
    
    setIsProcessing(true)
    const subDetails = await fetchDetails(detail, detail.model_name)
    
    setDetailFieldsToRender(detailFields)
    setSelectedDetail({ ...detail, _details: subDetails })
    setDetailModalMode('edit')
    setCurrentDetailTable(detail.model_name)
    setActiveTabForDetail('master') // Começa nos dados principais do sub-detalhe
    setParentRowIdForDetail(null)
    setIsProcessing(false)
    
    const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === detail.model_name?.toLowerCase())
    const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
    
    // Pequeno tick para garantir que o React desmonte o modal anterior
    // antes de montar o novo (evita colisão de key no mesmo ciclo de render)
    setTimeout(() => {
      if (interfaceType === 'drawer') setIsDetailDrawerOpen(true)
      else setIsDetailModalOpen(true)
    }, 0)
  }

  const handleCloseDetail = () => {
    if (detailHistory.length > 0) {
      const last = detailHistory[detailHistory.length - 1]
      setDetailHistory(prev => prev.slice(0, -1))
      setSelectedDetail(last.record)
      setCurrentDetailTable(last.tableName)
      setDetailFieldsToRender(last.fields)
      setActiveTabForDetail(last.activeTab || 'master')
      setDetailModalMode('edit')
      
      const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === last.tableName?.toLowerCase())
      const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'
      
      if (interfaceType === 'drawer') {
        setIsDetailDrawerOpen(true)
        setIsDetailModalOpen(false)
      } else {
        setIsDetailModalOpen(true)
        setIsDetailDrawerOpen(false)
      }
    } else {
      setIsDetailModalOpen(false)
      setIsDetailDrawerOpen(false)
      setSelectedDetail(null)
      setActiveTabForDetail('master')
    }
  }

  const handleDeleteDetail = (detail: any) => {
    setItemToDelete(detail)
    setIsDetailDeleteModalOpen(true)
  }

  const handleSaveDetail = async (formData: any) => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      const action = detailModalMode
      const tableName = currentDetailTable
      const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
      const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      const detailPkName = pkField.db_column_name.split('.').pop() || 'id'
      
      // Blacklist: same rules as handleSave.
      // Must also skip object values (joined relations) and _key (React internal)
      // or the entire UPDATE will fail on PostgreSQL.
      const INTERNAL_KEYS = new Set(['_details', 'model_name', 'display_model_name'])

      let rawQuery = ''
      const sanitizedData: any = {}
      for (const [k, v] of Object.entries(formData)) {
        const lowKey = k.toLowerCase()
        if (
          INTERNAL_KEYS.has(lowKey) ||
          k.startsWith('_') ||                            // skip _key, _details, etc.
          k.includes('.') ||                             // skip table-prefixed keys
          lowKey === detailPkName.toLowerCase() ||
          lowKey === 'created_at' ||
          lowKey === 'updated_at' ||
          v === null ||
          v === undefined ||
          typeof v === 'object'                          // skip objects/arrays (joined relations)
        ) continue

        sanitizedData[k] = String(v)
      }

      console.log(`[MetaBuilder:handleSaveDetail] RAW formData keys:`, Object.keys(formData))
      console.log(`[MetaBuilder:handleSaveDetail] action=${action} table=${tableName} pk=${detailPkName}`)
      console.log(`[MetaBuilder:handleSaveDetail] sanitizedData:`, sanitizedData)

      // Se for inclusão, garantir que a FK para o mestre esteja correta
      if (action === 'create' && logicType === 'master_detail' && joins) {
        const join = joins.find(j => j.to?.toLowerCase() === tableName?.toLowerCase())
        if (join) {
          const parentId = parentRowIdForDetail || (selectedRow[join.localKey] || selectedRow[join.localKey.toUpperCase()] || selectedRow.id || selectedRow.ID)
          sanitizedData[join.foreignKey] = String(parentId)
        }
      }

      const dPkValue = selectedDetail[detailPkName] || selectedDetail[detailPkName.toUpperCase()] || selectedDetail['id'] || selectedDetail['ID']

      if (action === 'edit') {
        if (Object.keys(sanitizedData).length === 0) {
          // Nothing to update — likely no fields were changed
          setIsProcessing(false)
          return
        }
        const setClause = Object.entries(sanitizedData)
          .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
          .join(', ')
        rawQuery = `UPDATE ${tableName} SET ${setClause} WHERE ${detailPkName} = '${String(dPkValue).replace(/'/g, "''")}'`
      } else {
        const keys = Object.keys(sanitizedData).join(', ')
        const values = Object.values(sanitizedData)
          .map(v => `'${String(v).replace(/'/g, "''")}'`)
          .join(', ')
        rawQuery = `INSERT INTO ${tableName} (${keys}) VALUES (${values})`
      }

      console.log(`[MetaBuilder:handleSaveDetail] rawQuery:`, rawQuery)

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload: {
              queryId,
              table: tableName,
              action: action === 'edit' ? 'update' : 'insert',
              data: sanitizedData,
              sql: rawQuery,
              idColumn: detailPkName,
              idValue: dPkValue
            }
          })

          // Batch save modified sub-details if any (for nested levels)
          if (formData._details && formData._details.length > 0) {
            for (const subDetail of formData._details) {
              const sdTableName = subDetail.model_name
              if (!sdTableName) continue

              const sdFields = detailFields.filter(f => f.model_name?.toLowerCase() === sdTableName.toLowerCase())
              const sPkField = sdFields.find(f => f.is_primary_key) || { db_column_name: 'id' }
              const sdPkName = sPkField.db_column_name.split('.').pop() || 'id'
              const sdPkValue = subDetail[sdPkName] || subDetail[sdPkName.toUpperCase()] || subDetail['id'] || subDetail['ID']

              if (sdPkValue) {
                const sanitizedSD: any = {}
                for (const [k, v] of Object.entries(subDetail)) {
                  if (
                    INTERNAL_KEYS.has(k) ||
                    k.includes('.') ||                            // skip table-prefixed keys
                    k.toLowerCase() === sdPkName.toLowerCase() ||
                    v === null ||
                    v === undefined
                  ) continue
                  sanitizedSD[k] = String(v)
                }

                if (Object.keys(sanitizedSD).length > 0) {
                  const setClause = Object.entries(sanitizedSD)
                    .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
                    .join(', ')
                  const sdQuery = `UPDATE ${sdTableName} SET ${setClause} WHERE ${sdPkName} = '${String(sdPkValue).replace(/'/g, "''")}'`

                  channel.send({
                    type: 'broadcast',
                    event: 'sql_query',
                    payload: {
                      queryId: crypto.randomUUID(),
                      table: sdTableName,
                      action: 'update',
                      data: sanitizedSD,
                      sql: sdQuery,
                      idColumn: sdPkName,
                      idValue: sdPkValue
                    }
                  })
                }
              }
            }
          }
        }
      })

      setTimeout(async () => {
        // Captura snapshot estável ANTES de qualquer setState
        const currentDetail = selectedDetail
        const parentHistory = [...detailHistory]

        // 1. Busca dados frescos do PAI (o que está "atrás" no histórico)
        let freshParentRecord: any = null
        if (parentHistory.length > 0) {
          const lastIdx = parentHistory.length - 1
          const pRec = parentHistory[lastIdx].record
          const pTab = parentHistory[lastIdx].tableName
          if (pRec && pTab) {
            const freshDetails = await fetchDetails(pRec, pTab)
            freshParentRecord = { ...pRec, _details: freshDetails }
          }
        }

        // 2. Recarrega o MESTRE
        if (selectedRow) {
          const upMasterDetails = await fetchDetails(selectedRow, modelName)
          setSelectedRow((prev: any) => prev ? { ...prev, _details: upMasterDetails } : prev)
        }

        // 3. Navega de volta manualmente com dados JA FRESCOS
        // (Não usa handleCloseDetail() porque ele lê estado stale do closure)
        if (parentHistory.length > 0) {
          const last = parentHistory[parentHistory.length - 1]
          const newHistory = parentHistory.slice(0, -1)
          const recordToShow = freshParentRecord || last.record

          setDetailHistory(newHistory)
          setSelectedDetail(recordToShow)
          setCurrentDetailTable(last.tableName)
          setDetailFieldsToRender(last.fields)
          setActiveTabForDetail(last.activeTab || 'master')
          setDetailModalMode('edit')

          const model = (project as any)?.models?.find((m: any) => m.db_table_name.toLowerCase() === last.tableName?.toLowerCase())
          const interfaceType = detailsInterfaceTypes?.[model?.id || ''] || (project.ui_config as any)?.details_interface_types?.[model?.id || ''] || 'modal'

          // Fecha a interface ATUAL e abre a interface CORRETA do pai.
          // Crítico: sem fechar a que está aberta, o conteúdo da modal vai parar dentro do drawer.
          if (interfaceType === 'drawer') {
            setIsDetailModalOpen(false)
            setIsDetailDrawerOpen(true)
          } else {
            setIsDetailDrawerOpen(false)
            setIsDetailModalOpen(true)
          }
        } else {
          setIsDetailModalOpen(false)
          setIsDetailDrawerOpen(false)
        }

        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(`metabuilder_cache_${project.id}:${modelName}`)
        }

        setDetailRefreshKey(prev => prev + 1)
        setRefreshKey(prev => prev + 1)
        setIsProcessing(false)
        supabase.removeChannel(channel)
      }, 1500)

    } catch (error) {
      console.error('Error saving detail:', error)
      setIsProcessing(false)
    }
  }

  const handleConfirmDeleteDetail = async () => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      const tableName = itemToDelete.model_name
      const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
      const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      const detailPkName = pkField.db_column_name.split('.').pop() || 'id'
      const pkValue = itemToDelete[detailPkName] || itemToDelete[detailPkName.toUpperCase()] || itemToDelete['id'] || itemToDelete['ID']
      
      const rawQuery = `DELETE FROM ${tableName} WHERE ${detailPkName} = '${String(pkValue).replace(/'/g, "''")}'`

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload: {
              queryId,
              table: tableName,
              action: 'delete',
              sql: rawQuery,
              idColumn: detailPkName,
              idValue: pkValue
            }
          })
        }
      })

      setTimeout(async () => {
        setIsDetailDeleteModalOpen(false)
        setItemToDelete(null)
        supabase.removeChannel(channel)
        
        if (selectedRow) {
          const updatedDetails = await fetchDetails(selectedRow, modelName)
          setSelectedRow({ ...selectedRow, _details: updatedDetails })
        }
        setIsProcessing(false)
      }, 1500)
    } catch (error) {
      console.error('Error deleting detail:', error)
      setIsProcessing(false)
    }
  }

  const handleSave = async (formData: any) => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      const action = drawerMode === 'create' ? 'insert' : 'update'
      
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const pkName = primaryKeyName
          const cleanPkName = pkName.split('.').pop() || 'id'
          
          // Case-insensitive PK value resolution
          const pkValue = formData[pkName] ?? formData[cleanPkName] ?? formData[pkName.toUpperCase()] ?? formData[pkName.toLowerCase()] ?? formData.id ?? formData.ID
          
          const filters: any = {}
          if (action === 'update' && pkValue !== undefined && pkValue !== null) {
            filters[cleanPkName] = String(pkValue)
          }

          // Blacklist: exclude internal keys, system columns, PK, objects, and arrays.
          // The bug was: joined fields (e.g. 'projects') and React internals ('_key') 
          // were slipping through as '[object Object]', breaking the entire SQL query.
          const MASTER_INTERNAL = new Set(['_details', 'model_name', 'display_model_name'])
          const sanitizedData: any = {}
          for (const [k, v] of Object.entries(formData)) {
            const lowKey = k.toLowerCase()
            if (
              MASTER_INTERNAL.has(lowKey) ||
              k.startsWith('_') ||           // skip _key, _details, etc.
              k.includes('.') ||             // skip table-prefixed duplicates
              lowKey === pkName.toLowerCase() ||
              lowKey === cleanPkName.toLowerCase() ||
              lowKey === 'created_at' ||
              lowKey === 'updated_at' ||
              v === undefined || v === null ||
              typeof v === 'object'           // skip objects and arrays (joined relations)
            ) continue

            sanitizedData[k] = String(v)
          }

          // RAW SQL Builder
          let rawQuery = ''
          if (action === 'update' && pkValue && Object.keys(sanitizedData).length > 0) {
            const setClause = Object.entries(sanitizedData)
              .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            rawQuery = `UPDATE ${modelName} SET ${setClause} WHERE ${cleanPkName} = '${String(pkValue).replace(/'/g, "''")}'`
          } else if (action === 'insert' && Object.keys(sanitizedData).length > 0) {
            const keys = Object.keys(sanitizedData).join(', ')
            const values = Object.values(sanitizedData)
              .map(v => `'${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            rawQuery = `INSERT INTO ${modelName} (${keys}) VALUES (${values})`
          }

          console.log(`[MetaBuilder:handleSave] RAW formData keys:`, Object.keys(formData))
          console.log(`[MetaBuilder:handleSave] action=${action} table=${modelName} pkName=${pkName} cleanPkName=${cleanPkName} pkValue=${pkValue}`)
          console.log(`[MetaBuilder:handleSave] sanitizedData:`, sanitizedData)
          console.log(`[MetaBuilder:handleSave] rawQuery:`, rawQuery)

          const payload: any = {
            queryId,
            table: modelName,
            tableName: modelName, 
            action,
            data: sanitizedData,
            record: sanitizedData, 
            query: rawQuery, 
            sql: rawQuery, 
            idColumn: cleanPkName,   // EXATAMENTE o que o Agente CLI espera
            idValue: pkValue,   // EXATAMENTE o que o Agente CLI espera
            token: project?.secret_token || 'test-token'
          }

          if (Object.keys(filters).length > 0) {
            payload.filters = filters
            payload.where = filters
            payload.id = filters[pkName]
          }

          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload
          })

          // Batch save modified details if any
          if (formData._details && formData._details.length > 0) {
            for (const detail of formData._details) {
              const detailTableName = detail.model_name
              if (!detailTableName) continue
              
              const dFields = detailFields.filter(f => f.model_name?.toLowerCase() === detailTableName.toLowerCase())
              const pkField = dFields.find(f => f.is_primary_key) || { db_column_name: 'id' }
              const dPkName = pkField.db_column_name.split('.').pop() || 'id'
              const dPkValue = detail[dPkName] || detail[dPkName.toUpperCase()] || detail['id'] || detail['ID']
              
              if (dPkValue) {
                const sanitizedDetail: any = {}
                for (const [k, v] of Object.entries(detail)) {
                  const isMatch = dFields.some(f => {
                    const bCol = f.db_column_name.split('.').pop() || f.db_column_name
                    return f.db_column_name.toLowerCase() === k.toLowerCase() || bCol.toLowerCase() === k.toLowerCase()
                  })
                  if (isMatch && k.toLowerCase() !== dPkName.toLowerCase() && k.toLowerCase() !== 'id') {
                    sanitizedDetail[k] = String(v)
                  }
                }

                if (Object.keys(sanitizedDetail).length > 0) {
                  const setClause = Object.entries(sanitizedDetail)
                    .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
                    .join(', ')
                  const detailQuery = `UPDATE ${detailTableName} SET ${setClause} WHERE ${dPkName} = '${String(dPkValue).replace(/'/g, "''")}'`
                  
                  channel.send({
                    type: 'broadcast',
                    event: 'sql_query',
                    payload: {
                      queryId: crypto.randomUUID(),
                      table: detailTableName,
                      action: 'update',
                      data: sanitizedDetail,
                      sql: detailQuery,
                      idColumn: dPkName,
                      idValue: dPkValue
                    }
                  })
                }

                // SUB-DETAILS (Recursividade manual para o 3º nível)
                if (detail._details && detail._details.length > 0) {
                  for (const subDetail of detail._details) {
                    const subTableName = subDetail.model_name
                    if (!subTableName) continue

                    const sdFields = detailFields.filter(f => f.model_name?.toLowerCase() === subTableName.toLowerCase())
                    const sPkField = sdFields.find(f => f.is_primary_key) || { db_column_name: 'id' }
                    const sPkName = sPkField.db_column_name.split('.').pop() || 'id'
                    const sPkValue = subDetail[sPkName] || subDetail[sPkName.toUpperCase()] || subDetail['id'] || subDetail['ID']

                    if (sPkValue) {
                      const sanitizedSub: any = {}
                      for (const [sk, sv] of Object.entries(subDetail)) {
                        const isMatch = sdFields.some(f => {
                          const bCol = f.db_column_name.split('.').pop() || f.db_column_name
                          return f.db_column_name.toLowerCase() === sk.toLowerCase() || bCol.toLowerCase() === sk.toLowerCase()
                        })
                        if (isMatch && sk.toLowerCase() !== sPkName.toLowerCase() && sk.toLowerCase() !== 'id') {
                          sanitizedSub[sk] = String(sv)
                        }
                      }

                      if (Object.keys(sanitizedSub).length > 0) {
                        const subSetClause = Object.entries(sanitizedSub)
                          .map(([k, v]) => `${k} = '${String(v).replace(/'/g, "''")}'`)
                          .join(', ')
                        const subQuery = `UPDATE ${subTableName} SET ${subSetClause} WHERE ${sPkName} = '${String(sPkValue).replace(/'/g, "''")}'`
                        
                        channel.send({
                          type: 'broadcast',
                          event: 'sql_query',
                          payload: {
                            queryId: crypto.randomUUID(),
                            table: subTableName,
                            action: 'update',
                            data: sanitizedSub,
                            sql: subQuery,
                            idColumn: sPkName,
                            idValue: sPkValue
                          }
                        })
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })

      // Ouvir confirmação (opcional, ou apenas assumir sucesso e recarregar)
      setTimeout(() => {
        if (isPage) setIsPageVisible(false)
        else setOpen(false)
        
        setIsProcessing(false)
        supabase.removeChannel(channel)
        
        // Limpar cache para forçar refresh real
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(`metabuilder_cache_${project.id}:${modelName}`)
        }
        
        setRefreshKey(prev => prev + 1)
        
        // Limpar seleção para garantir refresh limpo
        if (!isPage) setSelectedRow(null)
      }, 1500)

    } catch (error) {
      console.error('Error saving:', error)
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${project.id}`
    const channel = supabase.channel(channelName)

    try {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          const pkName = primaryKeyName
          const cleanPkName = pkName.split('.').pop() || 'id'

          const filters: any = {}
          let pkValue = selectedRow[pkName] ?? selectedRow[cleanPkName] ?? selectedRow.id ?? selectedRow.ID

          if (pkValue !== undefined && pkValue !== null) {
            filters[cleanPkName] = String(pkValue)
          }

          let rawQuery = ''
          if (pkValue !== undefined && pkValue !== null) {
            rawQuery = `DELETE FROM ${modelName} WHERE ${cleanPkName} = '${String(pkValue).replace(/'/g, "''")}'`
          }

          console.log(`[MetaBuilder] Executing delete on ${modelName}`, { filters, pkName, cleanPkName, pkValue, rawQuery })

          const payload: any = {
            queryId,
            table: modelName,
            tableName: modelName,
            action: 'delete',
            query: rawQuery,
            sql: rawQuery,
            idColumn: cleanPkName,
            idValue: pkValue,
            token: project?.secret_token || 'test-token'
          }

          if (Object.keys(filters).length > 0) {
            payload.filters = filters
            payload.where = filters
            payload.id = filters[pkName]
          }

          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload
          })
        }
      })

      setTimeout(() => {
        setIsDeleteModalOpen(false)
        setIsProcessing(false)
        supabase.removeChannel(channel)
        setRefreshKey(prev => prev + 1)
      }, 1500)
    } catch (error) {
      console.error('Error deleting:', error)
      setIsProcessing(false)
    }
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
            {logicType !== 'analytics' && project.theme_config?.enable_downloads !== false && canExport && (
              <ExportDropdown 
                projectId={project.id}
                workspaceSlug={workspace.slug}
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
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-all font-bold text-xs shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {t('runtime.new_record')}
              </button>
            )}
          </div>
        )}
      />

      <main className="px-10 py-6 pb-8 space-y-8">
        {isPage && isPageVisible ? (
          <RecordForm 
            mode={drawerMode}
            fields={cleanFormFields}
            initialData={selectedRow}
            onSave={handleSave}
            onCancel={() => setIsPageVisible(false)}
            isLoading={isProcessing}
            logicType={logicType}
            masterModelId={masterModelId}
            masterModelName={modelName}
            detailDisplayMode={detailDisplayMode}
            isPageMode={true}
            onEditDetail={handleEditDetail}
            onDeleteDetail={handleDeleteDetail}
            onAddDetail={handleOpenAddDetail}
            joins={joins}
            dictionary={dictionary}
            detailsInlineTypes={detailsInlineTypes}
            initialTab={activeTabForDetail}
            onTabChange={setActiveTabForDetail}
          />
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
              />
            )}

            <ViewContainer 
              key={refreshKey}
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
              schedulerConfig={schedulerConfig}
              masterModelId={masterModelId}
              detailDisplayMode={detailDisplayMode}
              dictionary={dictionary}
              joins={joins}
              actionInterfaceType={actionInterfaceType}
              externalFilters={globalFilterValues}
              onFiltersChange={setGlobalFilterValues}
              tunnelChannel={tunnelChannel}
              isTunnelReady={isTunnelReady}
              onAdd={handleOpenAdd}
              onView={handleOpenView}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
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
          detailDisplayMode={detailDisplayMode}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
          joins={joins}
          dictionary={dictionary}
          detailsInlineTypes={detailsInlineTypes}
          initialTab={activeTabForDetail}
          onTabChange={setActiveTabForDetail}
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
          detailDisplayMode={detailDisplayMode}
          onEditDetail={handleEditDetail}
          onDeleteDetail={handleDeleteDetail}
          onAddDetail={handleOpenAddDetail}
          joins={joins}
          dictionary={dictionary}
          detailsInlineTypes={detailsInlineTypes}
          initialTab={activeTabForDetail}
          onTabChange={setActiveTabForDetail}
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
          joins: joins,
          dictionary: dictionary,
          detailsInlineTypes: detailsInlineTypes,
          initialTab: item.activeTab,
          onSave: async () => {},
          onClose: () => {
            const levelsToRemove = detailHistory.length - idx
            let newHistory = [...detailHistory]
            for(let i=0; i < levelsToRemove; i++) handleCloseDetail()
          }
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
        onEditDetail={handleEditDetail}
        onDeleteDetail={handleDeleteDetail}
        onAddDetail={handleOpenAddDetail}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        initialTab={activeTabForDetail}
        onTabChange={setActiveTabForDetail}
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
        onEditDetail={handleEditDetail}
        onDeleteDetail={handleDeleteDetail}
        onAddDetail={handleOpenAddDetail}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        initialTab={activeTabForDetail}
        onTabChange={setActiveTabForDetail}
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
             <button onClick={() => setIsWidgetModalOpen(false)} className="flex-1 px-4 py-3.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancelar</button>
             <button onClick={() => handleSaveWidgetRuntime(editingWidget)} className="flex-1 px-4 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 transition-all active:scale-95">Salvar Dashboard</button>
          </div>
        </div>
      </Modal>

      {project.theme_config?.enable_downloads !== false && canExport && (
        <ActiveDownloadsWidget 
          downloads={activeDownloads} 
          onRemove={handleRemoveDownload} 
          workspaceSlug={workspace?.slug}
          projectSlug={project?.slug}
        />
      )}
    </div>
  )
}
