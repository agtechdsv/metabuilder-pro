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
  Workflow
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
import { useRouter } from 'next/navigation'
import { ExportDropdown } from './ExportControls'

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
  timelineConfig?: any
  mapConfig?: any
  ganttConfig?: any
  blueprintConfig?: any
  dictionary?: any
  joins?: any[]
  masterModelId?: string
  detailDisplayMode?: 'tabs' | 'sections'
  actionInterfaceType?: 'drawer' | 'modal' | 'page'
  detailsInterfaceTypes?: Record<string, string>
  detailsInlineTypes?: Record<string, boolean>
  masterTabTitle?: string
  detailsTabTitles?: Record<string, string>
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
  galleryClickBehavior?: 'lightbox' | 'thumbnail'
  customActions?: any[]
  isAutomationsEnabled?: boolean
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
  timelineConfig,
  mapConfig,
  ganttConfig,
  blueprintConfig,
  dictionary = {},
  joins = [],
  masterModelId,
  detailDisplayMode,
  detailsInterfaceTypes,
  detailsInlineTypes,
  masterTabTitle,
  detailsTabTitles,
  tabsStyleConfig,
  actionInterfaceType = 'drawer',
  baseUrl,
  breadcrumbs = [],
  description,
  icon,
  exportFormats = ['xlsx', 'csv', 'json'],
  analyticsConfig: initialAnalyticsConfig,
  galleryClickBehavior,
  customActions = [],
  isAutomationsEnabled = false
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
  const [activeTabForMaster, setActiveTabForMaster] = useState<string>('master')
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
  
  const [initialEditId, setInitialEditId] = useState<string | null>(null)

  // Custom Actions iframes state
  const [iframeUrl, setIframeUrl] = useState<string>('')
  const [iframeTitle, setIframeTitle] = useState<string>('')
  const [isIframeModalOpen, setIsIframeModalOpen] = useState(false)
  const [isIframeDrawerOpen, setIsIframeDrawerOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const paramsObj: Record<string, string> = {};
      
      const validColumnNames = new Set([
        ...displayFields.map((f: any) => f.db_column_name),
        ...filterFields.map((f: any) => f.db_column_name)
      ]);
      const pk = primaryKeyName || 'id';
      validColumnNames.add(pk);

      searchParams.forEach((value, key) => {
        if (key !== 'embedded') {
          if (!validColumnNames.has(key) && (key.endsWith('_id') || key === 'id')) {
             paramsObj[pk] = value;
          } else if (validColumnNames.has(key)) {
             paramsObj[key] = value;
          } else {
             paramsObj[key] = value;
          }
        }
      });
      
      if (Object.keys(paramsObj).length > 0) {
        setGlobalFilterValues(paramsObj);
        
        if (logicType !== 'list_only') {
          // No modo cadastro sem displayFields/filterFields, qualquer param de ID conta
          const idVal = paramsObj['id'] || paramsObj[pk] ||
            (logicType === 'cadastro'
              ? Object.entries(paramsObj).find(([k]) => k.endsWith('_id') || k === 'id')?.[1]
              : undefined);
          if (idVal) {
            setInitialEditId(idVal);
          }
        }
      }
    }
  }, [logicType, primaryKeyName, displayFields, filterFields]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CLOSE_MODAL') {
        setIsIframeModalOpen(false)
        setIsIframeDrawerOpen(false)
        setIframeUrl('')
        setRefreshKey(prev => prev + 1)
        setRelationalRefreshKey(prev => prev + 1)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleCustomAction = async (action: any, rowData?: any) => {
    const interpolate = (str: string) => {
      if (!str || !rowData) return str
      return str.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
        return rowData[key] !== undefined ? String(rowData[key]) : match
      })
    }

    if (action.linked_bpm_workflows && action.linked_bpm_workflows.length > 0) {
      if (!tunnelChannel || !isTunnelReady) {
        toast('Túnel com banco de dados não está pronto para automações.', 'error')
      } else {
        const payload: any = {
          action: 'trigger_bpm',
          workflows: action.linked_bpm_workflows,
          rowData: rowData || {},
          token: project?.secret_token || 'test-token',
          tableName: modelName,
          schemaName: project?.slug || 'public'
        }
        tunnelChannel.send({ type: 'broadcast', event: 'sql_query', payload })
        
        // Atualização silenciosa da tela após 1.5s para dar tempo ao fluxo de processar
        setTimeout(() => {
          setRefreshKey(prev => prev + 1)
          setRelationalRefreshKey(prev => prev + 1)
          setDetailRefreshKey(prev => prev + 1)
          toast('Ação executada com sucesso!', 'success')
        }, 1500)
      }
    }

    if (action.trigger_type === 'sql') {
      if (!tunnelChannel || !isTunnelReady) {
        toast('Túnel com banco de dados não está pronto.', 'error')
        return
      }
      const queryId = crypto.randomUUID()
      const currentModel = project?.models?.find((m: any) => m.db_table_name === modelName)
      const actualSchemaName = currentModel?.db_schema_name || project?.slug || 'public'
      const customQuery = interpolate(action.sql_query || '')

      const payload: any = { 
        queryId, 
        query: customQuery, 
        sql: customQuery,
        params: [],
        action: 'execute_custom', 
        token: project?.secret_token || 'test-token',
        schemaName: actualSchemaName,
        table: modelName
      }
      tunnelChannel.send({ type: 'broadcast', event: 'sql_query', payload })
      toast(`Executando ação: ${action.label}...`, 'info')
    } 
    else if (action.trigger_type === 'usecase') {
      if (!action.usecase_slug) {
        return; // Just BPM was intended
      }
      const slug = interpolate(action.usecase_slug)
      const params = interpolate(action.usecase_params) || ''
      const selectedFields = action.usecase_selected_fields || []
      const fieldsParams = selectedFields
        .map((f: string) => `${f}=${rowData?.[f] !== undefined ? encodeURIComponent(rowData[f]) : ''}`)
        .join('&')
        
      const allParams = [fieldsParams, params].filter(Boolean).join('&')
      const pathParts = window.location.pathname.split('/').filter(Boolean)
      const isAdminPath = pathParts[0] === 'admin'
      const currentWorkspaceSlug = isAdminPath ? pathParts[1] : pathParts[0]
      const currentProjectSlug = isAdminPath ? pathParts[2] : pathParts[1]
      const url = `/${project?.workspace?.slug || currentWorkspaceSlug}/${project?.slug || currentProjectSlug}/${slug}${allParams ? '?' + allParams : ''}`
      const openMode = action.usecase_open_mode || 'page'
      
      if (openMode === 'modal') {
        setIframeUrl(url + (allParams ? '&embedded=true' : '?embedded=true'))
        setIframeTitle(action.label || 'Visualizar')
        setIsIframeModalOpen(true)
      } else if (openMode === 'drawer') {
        setIframeUrl(url + (allParams ? '&embedded=true' : '?embedded=true'))
        setIframeTitle(action.label || 'Visualizar')
        setIsIframeDrawerOpen(true)
      } else {
        router.push(url)
      }
    }
    else if (action.trigger_type === 'rest') {
      const url = interpolate(action.rest_url)
      try {
        toast(`Executando chamada REST...`, 'info')
        const options: RequestInit = {
          method: action.rest_method || 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
        if (['POST', 'PUT', 'PATCH'].includes(action.rest_method) && action.rest_body) {
          options.body = interpolate(action.rest_body)
        }
        const res = await fetch(url, options)
        if (res.ok) {
          toast(`Ação "${action.label}" executada com sucesso!`, 'success')
        } else {
          toast(`Erro ao executar API: ${res.status} ${res.statusText}`, 'error')
        }
      } catch (err: any) {
        toast(`Erro de rede: ${err.message}`, 'error')
      }
    }
  }

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

    channel.on('broadcast', { event: 'bpm_workflow_completed' }, (payload) => {
      console.log('[MetaBuilder] 🔄 BPM Workflow Completed! Silently refreshing UI...', payload)
      // Atualiza as listagens
      setRefreshKey(prev => prev + 1)
      setRelationalRefreshKey(prev => prev + 1)
      setDetailRefreshKey(prev => prev + 1)

      const bpmTable = payload.payload?.table
      const bpmData = payload.payload?.data

      // Atualiza o registro aberto (se houver) sem fechar a tela
      if (bpmData && bpmTable === modelName) {
        setSelectedRow((prev: any) => {
          if (!prev) return prev
          const pkValue = bpmData[primaryKeyName] || bpmData.id || bpmData.ID || bpmData[primaryKeyName?.toUpperCase()]
          const prevPkValue = prev[primaryKeyName] || prev.id || prev.ID || prev[primaryKeyName?.toUpperCase()]
          
          if (String(prevPkValue) === String(pkValue)) {
            console.log('[MetaBuilder] 🔄 Atualizando formulário aberto com dados do BPM')
            return { ...prev, ...bpmData, _details: prev._details }
          }
          return prev
        })
      }
    })

    return () => {
      console.log(`[MetaBuilder] 🔌 Fechando Túnel Centralizado.`)
      channel.unsubscribe()
      setTunnelChannel(null)
      setIsTunnelReady(false)
    }
  }, [project?.id])

  // Modo "Apenas Cadastro" com ID passado por parâmetro: busca o registro e abre em edição
  useEffect(() => {
    if (!isCadastroOnly || !initialEditId || !isTunnelReady || !tunnelChannel) return

    const queryId = crypto.randomUUID()
    const cleanPk = (primaryKeyName || 'id').split('.').pop() || 'id'
    const currentModel = project?.models?.find((m: any) => m.db_table_name === modelName)
    const actualSchemaName = currentModel?.db_schema_name || project?.slug || 'public'
    const rawQuery = `SELECT * FROM "${modelName}" WHERE "${cleanPk}" = '${String(initialEditId).replace(/'/g, "''")}' LIMIT 1`

    console.log(`[MetaBuilder] 🔍 Buscando registro para edição no modo Cadastro: ${rawQuery}`)

    const handleResult = (payload: any) => {
      if (payload.payload?.queryId !== queryId) return
      if (payload.payload?.success && payload.payload?.data?.length > 0) {
        const record = payload.payload.data[0]
        setSelectedRow(record)
        setDrawerMode('edit')
        setIsPageVisible(true)
        console.log(`[MetaBuilder] ✅ Registro encontrado para edição:`, record)
      }
      // Limpa o listener após receber
      try {
        const bindings = tunnelChannel.bindings?.broadcast
        if (Array.isArray(bindings)) {
          tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
        }
      } catch (e) {}
    }

    tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
    tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult)

    tunnelChannel.send({
      type: 'broadcast',
      event: 'sql_query',
      payload: {
        queryId,
        table: modelName,
        schemaName: actualSchemaName,
        action: 'select',
        query: rawQuery,
        sql: rawQuery,
        token: project?.secret_token || 'test-token',
        joins: [],
        limit: 1,
        offset: 0
      }
    })
  }, [isCadastroOnly, initialEditId, isTunnelReady, tunnelChannel])


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
    // Prevent React synthetic events from being used as initialData
    if (initialData && typeof initialData === 'object' && ('nativeEvent' in initialData || initialData._reactName || typeof initialData.preventDefault === 'function')) {
      initialData = {}
    }
    setDrawerMode('create')
    setSelectedRow(initialData)
    setActiveTabForMaster('master')
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
        
        const queryId = crypto.randomUUID()
        const rawQuery = `SELECT * FROM "${join.to}" WHERE "${join.foreignKey}" = '${String(localValue).replace(/'/g, "''")}'`
        
        let detailData: any[] = []
        try {
          detailData = await new Promise<any[]>((resolve, reject) => {
            const isTemporary = !tunnelChannel || !isTunnelReady
            const channelName = `tunnel:${project.id}`
            const channel = isTemporary ? supabase.channel(channelName) : tunnelChannel
            let resolved = false

            const handleResult = (payload: any) => {
              if (payload.payload?.queryId === queryId) {
                resolved = true
                cleanup()
                if (payload.payload.success) {
                  resolve(payload.payload.data || [])
                } else {
                  reject(new Error(payload.payload.error || 'Error fetching details'))
                }
              }
            }

            const cleanup = () => {
              try {
                const bindings = channel.bindings?.broadcast
                if (Array.isArray(bindings)) {
                  const cleanBindings = bindings.filter((b: any) => {
                    const match = b.callback === handleResult
                    if (match && channel.channelAdapter) {
                      channel.channelAdapter.off('broadcast', b.ref)
                    }
                    return !match
                  })
                  channel.bindings.broadcast = cleanBindings
                }

                if (isTemporary) {
                  channel.unsubscribe()
                  supabase.removeChannel(channel)
                }
              } catch (err) {
                console.error('[MetaBuilder] Error cleaning up channel in fetchDetails:', err)
              }
            }

            channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
            channel.on('broadcast', { event: 'sql_result' }, handleResult)

            const sendPayload = {
              type: 'broadcast',
              event: 'sql_query',
              payload: {
                queryId,
                table: join.to,
                action: 'select',
                query: rawQuery,
                sql: rawQuery,
                token: project?.secret_token || 'test-token',
                schemaName: project?.models?.find((m: any) => m.db_table_name === join.to)?.db_schema_name || project?.slug || 'public',
                slug: project?.slug,
                joins: [],
                limit: 100,
                offset: 0
              }
            }

            if (isTemporary) {
              channel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                  channel.send(sendPayload)
                }
              })
            } else {
              channel.send(sendPayload)
            }

            // Timeout fallback
            setTimeout(() => {
              if (!resolved) {
                resolved = true
                cleanup()
                console.warn(`[MetaBuilder] Timeout fetching details for queryId ${queryId}`)
                resolve([])
              }
            }, 8000)
          })
        } catch (err) {
          console.error(`[MetaBuilder] Error fetching details from ${join.to} via tunnel:`, err)
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
    setActiveTabForMaster('master')
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

    const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
    setDetailFieldsToRender(fields)
    setSelectedDetail({})
    setDetailModalMode('create')
    setCurrentDetailTable(tableName)
    setParentRowIdForDetail(parentId || (selectedRow?.id || selectedRow?.ID))
    setActiveTabForDetail('master') // GARANTE que o novo registro inicie na aba principal
    
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
    
    const fields = detailFields.filter(f => f.model_name?.toLowerCase() === detail.model_name?.toLowerCase())
    setDetailFieldsToRender(fields)
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
    const isTemporary = !tunnelChannel || !isTunnelReady
    const channel = isTemporary ? supabase.channel(`tunnel:${project.id}`) : tunnelChannel

    try {
      const action = detailModalMode
      const tableName = currentDetailTable
      const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
      const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      const detailPkName = pkField.db_column_name.split('.').pop() || 'id'

      // Resolve PK value from selectedDetail using multiple strategies
      const dPkValue = selectedDetail?.[detailPkName] 
        ?? selectedDetail?.[detailPkName.toUpperCase()] 
        ?? selectedDetail?.['id'] 
        ?? selectedDetail?.['ID']
        ?? Object.entries(selectedDetail || {}).find(([k]) => k.toLowerCase() === detailPkName.toLowerCase())?.[1]

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
          v === undefined ||
          typeof v === 'object'                          // skip objects/arrays (joined relations)
        ) continue

        sanitizedData[k] = (v === null || v === '' || String(v).trim() === '') ? null : String(v)
      }

      // Se for inclusão, garantir que a FK para o mestre esteja correta
      if (action === 'create' && logicType === 'master_detail' && joins) {
        const join = joins.find(j => j.to?.toLowerCase() === tableName?.toLowerCase())
        if (join) {
          const parentId = parentRowIdForDetail || (selectedRow[join.localKey] || selectedRow[join.localKey.toUpperCase()] || selectedRow.id || selectedRow.ID)
          sanitizedData[join.foreignKey] = String(parentId)
        }
      }

      if (action === 'edit') {
        if (Object.keys(sanitizedData).length === 0) {
          // Nothing to update — use all non-pk, non-internal fields from formData as fallback
          console.warn(`[MetaBuilder:handleSaveDetail] sanitizedData empty for table=${tableName}. Attempting fallback with all formData fields.`)
          for (const [k, v] of Object.entries(formData)) {
            const lowKey = k.toLowerCase()
            if (
              k.startsWith('_') ||
              k.includes('.') ||
              lowKey === detailPkName.toLowerCase() ||
              lowKey === 'created_at' ||
              lowKey === 'updated_at' ||
              v === undefined ||
              typeof v === 'object'
            ) continue
            sanitizedData[k] = (v === null || v === '' || String(v).trim() === '') ? null : String(v)
          }
          if (Object.keys(sanitizedData).length === 0) {
            console.warn(`[MetaBuilder:handleSaveDetail] Fallback sanitizedData also empty — nothing to save.`)
            setIsProcessing(false)
            return
          }
        }
        const setClause = Object.entries(sanitizedData)
          .map(([k, v]) => (v === null || v === '' || String(v).trim() === '') ? `${k} = NULL` : `${k} = '${String(v).replace(/'/g, "''")}'`)
          .join(', ')
        rawQuery = `UPDATE ${tableName} SET ${setClause} WHERE ${detailPkName} = '${String(dPkValue).replace(/'/g, "''")}'`
      } else {
        const keys = Object.keys(sanitizedData).join(', ')
        const values = Object.values(sanitizedData)
          .map(v => (v === null || v === '' || String(v).trim() === '') ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
          .join(', ')
        rawQuery = `INSERT INTO ${tableName} (${keys}) VALUES (${values})`
      }

      // Helper: parse column name from PostgreSQL generated-column error
      // PT: 'a coluna "col" só pode ser atualizada para DEFAULT'
      // EN: 'column "col" can only be updated to DEFAULT'
      const parseGeneratedColError = (err: string): string | null => {
        const m = err?.match(/[""]([^"""]+)["""]/)
        return m ? m[1] : null
      }

      // Session-level cache of known generated/computed columns per table
      const GENERATED_COLS_KEY = `__mb_gen_cols_${tableName}`
      const cachedGenCols: string[] = JSON.parse(sessionStorage.getItem(GENERATED_COLS_KEY) || '[]')
      // Remove known generated columns upfront
      for (const gc of cachedGenCols) {
        delete sanitizedData[gc]
      }

      // Send with automatic retry when PostgreSQL rejects a generated column
      const sendWithRetry = async (): Promise<boolean> => {
        let currentData = { ...sanitizedData }
        let attempts = 0
        const MAX_RETRIES = 5

        while (attempts < MAX_RETRIES) {
          attempts++
          if (Object.keys(currentData).length === 0) {
            console.warn(`[MetaBuilder:handleSaveDetail] No updateable columns left after filtering generated columns.`)
            return false
          }

          // Rebuild rawQuery with current data
          const setClause = Object.entries(currentData)
            .map(([k, v]) => (v === null || v === '' || String(v).trim() === '') ? `${k} = NULL` : `${k} = '${String(v).replace(/'/g, "''")}'`)
            .join(', ')
          const currentQuery = action === 'edit'
            ? `UPDATE ${tableName} SET ${setClause} WHERE ${detailPkName} = '${String(dPkValue).replace(/'/g, "''")}'`
            : rawQuery

          const attemptQueryId = attempts === 1 ? queryId : crypto.randomUUID()

          const result = await new Promise<{ success: boolean; error?: string; data?: any[] }>((resolve) => {
            const isTemp = !tunnelChannel || !isTunnelReady
            const ch = isTemp ? supabase.channel(`tunnel:${project.id}`) : tunnelChannel
            let settled = false

            const handleResult = (payload: any) => {
              if (payload.payload?.queryId === attemptQueryId) {
                settled = true
                cleanup()
                resolve({ success: payload.payload.success, error: payload.payload.error, data: payload.payload.data })
              }
            }

            const cleanup = () => {
              try {
                const bindings = ch.bindings?.broadcast
                if (Array.isArray(bindings)) {
                  ch.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
                }
                if (isTemp) { ch.unsubscribe(); supabase.removeChannel(ch) }
              } catch (_) {}
            }

            ch.on('broadcast', { event: `query_result_${attemptQueryId}` }, handleResult)
            ch.on('broadcast', { event: 'sql_result' }, handleResult)

            const doSend = () => {
              ch.send({
                type: 'broadcast',
                event: 'sql_query',
                payload: {
                  queryId: attemptQueryId,
                  table: tableName,
                  action: action === 'edit' ? 'update' : 'insert',
                  data: currentData,
                  sql: currentQuery,
                  idColumn: detailPkName,
                  idValue: dPkValue,
                  token: project?.secret_token || 'test-token',
                  schemaName: project?.models?.find((m: any) => m.db_table_name === tableName)?.db_schema_name || project?.slug || 'public',
                  slug: project?.slug
                }
              })
            }

            if (isTemp) {
              ch.subscribe((status: string) => { if (status === 'SUBSCRIBED') doSend() })
            } else {
              doSend()
            }

            setTimeout(() => {
              if (!settled) {
                settled = true
                cleanup()
                resolve({ success: false, error: 'Timeout' })
              }
            }, 9000)
          })

          if (result.success) {
            return true
          }

          // Check if this is a generated-column error and retry
          const genCol = parseGeneratedColError(result.error || '')
          if (genCol && result.error?.includes('DEFAULT')) {
            // Cache this column so future saves skip it immediately
            if (!cachedGenCols.includes(genCol)) {
              cachedGenCols.push(genCol)
              sessionStorage.setItem(GENERATED_COLS_KEY, JSON.stringify(cachedGenCols))
            }
            delete currentData[genCol]
            continue
          }

          // Non-retryable error
          toast(result.error || 'Erro ao salvar', 'error')
          return false
        }

        toast('Não foi possível salvar após múltiplas tentativas.', 'error')
        return false
      }

      const saveSucceeded = await sendWithRetry()

      // After save confirmed (or timed out), refresh UI
      const parentHistory = [...detailHistory]

      if (saveSucceeded) {
        toast(
          detailModalMode === 'create'
            ? t('runtime.create_success', 'Registro criado com sucesso!')
            : t('runtime.update_success', 'Registro atualizado com sucesso!'),
          'success'
        )
        await new Promise(resolve => setTimeout(resolve, 300))
      } else {
        setIsProcessing(false)
        return
      }

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
      let freshMasterDetails: any[] = []
      if (selectedRow) {
        freshMasterDetails = await fetchDetails(selectedRow, modelName)
        setSelectedRow((prev: any) => prev ? { ...prev, _details: freshMasterDetails } : prev)
      }

      // 3. Navega de volta manualmente com dados JA FRESCOS
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
        setSelectedDetail(null)
      }

      if (typeof window !== 'undefined') {
        // Cache is updated silently by fetchData, do not remove it to prevent loader flashing
      }

      setDetailRefreshKey(prev => prev + 1)
      setRefreshKey(prev => prev + 1)
      setIsProcessing(false)


    } catch (error) {
      console.error('Error saving detail:', error)
      setIsProcessing(false)
    }
  }

  const getFkErrorMessage = (errorMsg: string, fallbackMsg: string) => {
    const regex = /(?:on table|na tabela)\s+(?:"[^"]+"\.)?"([^"]+)"/gi;
    const matches = [...errorMsg.matchAll(regex)];
    const tables = matches.map(m => m[1]);

    if (tables.length >= 2) {
      const parentTable = tables[0];
      const childTable = tables[1];

      const parentModel = project?.models?.find(
        (m: any) => m.db_table_name?.toLowerCase() === parentTable.toLowerCase()
      );
      const childModel = project?.models?.find(
        (m: any) => m.db_table_name?.toLowerCase() === childTable.toLowerCase()
      );

      const parentName = parentModel?.display_name || parentTable;
      const childName = childModel?.display_name || childTable;

      return `Não é possível excluir este ${parentName} pois ele possui relacionamento(s) ativo(s) com ${childName}.`;
    }
    
    if (tables.length === 1) {
      const parentModel = project?.models?.find(
        (m: any) => m.db_table_name?.toLowerCase() === modelName.toLowerCase()
      );
      const childTable = tables[0];
      const childModel = project?.models?.find(
        (m: any) => m.db_table_name?.toLowerCase() === childTable.toLowerCase()
      );
      
      const parentName = parentModel?.display_name || modelName;
      const childName = childModel?.display_name || childTable;
      
      return `Não é possível excluir este ${parentName} pois ele possui relacionamento(s) ativo(s) com ${childName}.`;
    }

    return fallbackMsg;
  }

  const handleConfirmDeleteDetail = async () => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()

    try {
      const tableName = itemToDelete.model_name
      const fields = detailFields.filter(f => f.model_name?.toLowerCase() === tableName?.toLowerCase())
      const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
      const detailPkName = pkField.db_column_name.split('.').pop() || 'id'
      const pkValue = itemToDelete[detailPkName] || itemToDelete[detailPkName.toUpperCase()] || itemToDelete['id'] || itemToDelete['ID']
      
      const rawQuery = `DELETE FROM ${tableName} WHERE ${detailPkName} = '${String(pkValue).replace(/'/g, "''")}'`

      const payload = {
        queryId,
        table: tableName,
        action: 'delete',
        sql: rawQuery,
        idColumn: detailPkName,
        idValue: pkValue,
        token: project?.secret_token || 'test-token',
        schemaName: project?.models?.find((m: any) => m.db_table_name === tableName)?.db_schema_name || project?.slug || 'public',
        slug: project?.slug
      }

      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const isTemp = !tunnelChannel || !isTunnelReady
        const ch = isTemp ? supabase.channel(`tunnel:${project.id}`) : tunnelChannel
        let settled = false

        const handleResult = (payload: any) => {
          if (payload.payload?.queryId === queryId) {
            settled = true
            cleanup()
            resolve({ success: payload.payload.success, error: payload.payload.error })
          }
        }

        const cleanup = () => {
          try {
            const bindings = ch.bindings?.broadcast
            if (Array.isArray(bindings)) {
              ch.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
            }
            if (isTemp) {
              ch.unsubscribe()
              supabase.removeChannel(ch)
            }
          } catch (_) {}
        }

        ch.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
        ch.on('broadcast', { event: 'sql_result' }, handleResult)

        const doSend = () => {
          ch.send({
            type: 'broadcast',
            event: 'sql_query',
            payload
          })
        }

        if (isTemp) {
          ch.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              doSend()
            }
          })
        } else {
          doSend()
        }

        setTimeout(() => {
          if (!settled) {
            settled = true
            cleanup()
            resolve({ success: false, error: 'Timeout' })
          }
        }, 9000)
      })

      setIsDetailDeleteModalOpen(false)
      setItemToDelete(null)
      setIsProcessing(false)

      if (result.success) {
        if (selectedRow) {
          const updatedDetails = await fetchDetails(selectedRow, modelName)
          setSelectedRow({ ...selectedRow, _details: updatedDetails })
        }
        toast(t('runtime.delete_success', 'Registro excluído com sucesso!'), 'success')
      } else {
        let errorMsg = result.error || 'Erro ao excluir o detalhe.'
        if (errorMsg.includes('foreign key constraint') || errorMsg.includes('violates foreign key') || errorMsg.includes('chave estrangeira')) {
          const defaultFkError = t('runtime.delete_fk_error', 'Não é possível excluir este registro pois ele possui relacionamentos ativos (chave estrangeira).')
          errorMsg = getFkErrorMessage(errorMsg, defaultFkError)
        }
        toast(errorMsg, 'error')
      }
    } catch (error) {
      console.error('Error deleting detail:', error)
      setIsProcessing(false)
    }
  }

  const handleSave = async (formData: any) => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()
    const isTemporary = !tunnelChannel || !isTunnelReady
    const channel = isTemporary ? supabase.channel(`tunnel:${project.id}`) : tunnelChannel

    try {
      const action = drawerMode === 'create' ? 'insert' : 'update'

      const parseGeneratedColError = (err: string): string | null => {
        const m = err?.match(/[""]([^"""]+)["""]/)
        return m ? m[1] : null
      }


        const pkName = primaryKeyName
        const cleanPkName = pkName.split('.').pop() || 'id'
        
        // Case-insensitive PK value resolution
        const pkValue = formData[pkName] ?? formData[cleanPkName] ?? formData[pkName.toUpperCase()] ?? formData[pkName.toLowerCase()] ?? formData.id ?? formData.ID
        
        const filters: any = {}
        if (action === 'update' && pkValue !== undefined && pkValue !== null) {
          filters[cleanPkName] = String(pkValue)
        }

        // Blacklist: exclude internal keys, system columns, PK, objects, and arrays.
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
            v === undefined ||
            typeof v === 'object'           // skip objects and arrays (joined relations)
          ) continue

          sanitizedData[k] = (v === null || v === '' || String(v).trim() === '') ? null : String(v)
        }

        const sendWithRetry = async (): Promise<{ success: boolean; data?: any[] }> => {
        let currentData = { ...sanitizedData }
        let attempts = 0
        const MAX_RETRIES = 5

        while (attempts < MAX_RETRIES) {
          attempts++
          // RAW SQL Builder
          let currentQuery = ''
          if (action === 'update' && pkValue && Object.keys(currentData).length > 0) {
            const setClause = Object.entries(currentData)
              .map(([k, v]) => (v === null || v === '' || String(v).trim() === '') ? `${k} = NULL` : `${k} = '${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            currentQuery = `UPDATE ${modelName} SET ${setClause} WHERE ${cleanPkName} = '${String(pkValue).replace(/'/g, "''")}' RETURNING *`
          } else if (action === 'insert' && Object.keys(currentData).length > 0) {
            const keys = Object.keys(currentData).join(', ')
            const values = Object.values(currentData)
              .map(v => (v === null || v === '' || String(v).trim() === '') ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
              .join(', ')
            currentQuery = `INSERT INTO ${modelName} (${keys}) VALUES (${values}) RETURNING *`
          }

          const attemptQueryId = attempts === 1 ? queryId : crypto.randomUUID()

          const result = await new Promise<{ success: boolean; error?: string; data?: any[] }>((resolve) => {
            const isTemp = !tunnelChannel || !isTunnelReady
            const ch = isTemp ? supabase.channel(`tunnel:${project.id}`) : tunnelChannel
            let settled = false

            const handleResult = (payload: any) => {
              if (payload.payload?.queryId === attemptQueryId) {
                settled = true
                cleanup()
                resolve({ success: payload.payload.success, error: payload.payload.error, data: payload.payload.data })
              }
            }

            const cleanup = () => {
              try {
                const bindings = ch.bindings?.broadcast
                if (Array.isArray(bindings)) {
                  ch.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
                }
                if (isTemp) { ch.unsubscribe(); supabase.removeChannel(ch) }
              } catch (_) {}
            }

            ch.on('broadcast', { event: `query_result_${attemptQueryId}` }, handleResult)
            ch.on('broadcast', { event: 'sql_result' }, handleResult)

            const doSend = () => {
              const payload: any = {
                queryId: attemptQueryId,
                table: modelName,
                tableName: modelName, 
                action,
                data: currentData,
                record: currentData, 
                query: currentQuery, 
                sql: currentQuery, 
                idColumn: cleanPkName,
                idValue: pkValue,
                token: project?.secret_token || 'test-token',
                schemaName: project?.models?.find((m: any) => m.db_table_name === modelName)?.db_schema_name || project?.slug || 'public',
                slug: project?.slug
              }

              if (action === 'update' && Object.keys(filters).length > 0) {
                payload.filters = filters
                payload.where = filters
                payload.id = filters[pkName]
              }

              ch.send({
                type: 'broadcast',
                event: 'sql_query',
                payload
              })
            }

            if (isTemp) {
              ch.subscribe((status: string) => { if (status === 'SUBSCRIBED') doSend() })
            } else {
              doSend()
            }

            setTimeout(() => {
              if (!settled) {
                settled = true
                cleanup()
                resolve({ success: false, error: 'Timeout' })
              }
            }, 9000)
          })

          if (result.success) {
            return { success: true, data: result.data }
          }

          const genCol = parseGeneratedColError(result.error || '')
          if (genCol && result.error?.includes('DEFAULT')) {
            delete currentData[genCol]
            continue
          }

          toast(result.error || 'Erro ao salvar', 'error')
          return { success: false }
        }

        toast('Não foi possível salvar após múltiplas tentativas.', 'error')
        return { success: false }
      }

      const saveResult = await sendWithRetry()

      if (!saveResult.success) {
        setIsProcessing(false)
        return
      }

      // ----------------------------------------------------
      // SALVAR DETALHES INLINE
      // ----------------------------------------------------
      let masterId = pkValue
      if (action === 'insert' && saveResult.data && saveResult.data.length > 0) {
        masterId = saveResult.data[0][cleanPkName] || saveResult.data[0][pkName] || saveResult.data[0][cleanPkName.toUpperCase()] || saveResult.data[0].id || saveResult.data[0].ID
      }

      if (formData._details && formData._details.length > 0) {
        for (const detail of formData._details) {
          const detailTableName = detail.model_name
          if (!detailTableName) continue

          const isNewDetail = detail._isNew
          
          const fields = detailFields.filter(f => f.model_name?.toLowerCase() === detailTableName?.toLowerCase())
          const pkField = fields.find(f => f.is_primary_key) || { db_column_name: 'id' }
          const detailPkName = pkField.db_column_name.split('.').pop() || 'id'
          const dPkValue = detail[detailPkName] ?? detail[detailPkName.toUpperCase()] ?? detail.id ?? detail.ID

          const INTERNAL_KEYS = new Set(['_details', 'model_name', 'display_model_name', '_isNew'])
          const sanitizedDetail: any = {}
          for (const [k, v] of Object.entries(detail)) {
            const lowKey = k.toLowerCase()
            if (INTERNAL_KEYS.has(lowKey) || k.startsWith('_') || k.includes('.') || lowKey === detailPkName.toLowerCase() || lowKey === 'created_at' || lowKey === 'updated_at' || v === undefined || typeof v === 'object') continue
            sanitizedDetail[k] = (v === null || v === '' || String(v).trim() === '') ? null : String(v)
          }

          if (isNewDetail && logicType === 'master_detail' && joins) {
            const join = joins.find(j => j.to?.toLowerCase() === detailTableName?.toLowerCase())
            if (join) {
               sanitizedDetail[join.foreignKey] = String(masterId)
            }
          }

          let detailQuery = ''
          if (!isNewDetail && dPkValue && Object.keys(sanitizedDetail).length > 0) {
            const setClause = Object.entries(sanitizedDetail).map(([k, v]) => (v === null || v === '') ? `${k} = NULL` : `${k} = '${String(v).replace(/'/g, "''")}'`).join(', ')
            detailQuery = `UPDATE ${detailTableName} SET ${setClause} WHERE ${detailPkName} = '${String(dPkValue).replace(/'/g, "''")}'`
          } else if (isNewDetail && Object.keys(sanitizedDetail).length > 0) {
            const keys = Object.keys(sanitizedDetail).join(', ')
            const values = Object.values(sanitizedDetail).map(v => (v === null || v === '') ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`).join(', ')
            detailQuery = `INSERT INTO ${detailTableName} (${keys}) VALUES (${values})`
          }

          if (detailQuery) {
            const detailQueryId = crypto.randomUUID()
            await new Promise<void>((resolve) => {
              let settled = false
              const handleDetailResult = (payload: any) => {
                if (payload.payload?.queryId === detailQueryId) {
                  settled = true
                  cleanupDetail()
                  resolve()
                }
              }
              const cleanupDetail = () => {
                try {
                  const bindings = channel.bindings?.broadcast
                  if (Array.isArray(bindings)) channel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleDetailResult)
                } catch (_) {}
              }
              channel.on('broadcast', { event: `query_result_${detailQueryId}` }, handleDetailResult)
              channel.on('broadcast', { event: 'sql_result' }, handleDetailResult)
              
              channel.send({
                type: 'broadcast',
                event: 'sql_query',
                payload: {
                  queryId: detailQueryId,
                  table: detailTableName,
                  tableName: detailTableName,
                  action: isNewDetail ? 'insert' : 'update',
                  data: sanitizedDetail,
                  record: sanitizedDetail,
                  query: detailQuery,
                  sql: detailQuery,
                  idColumn: detailPkName,
                  idValue: dPkValue,
                  token: project?.secret_token || 'test-token',
                  schemaName: project?.models?.find((m: any) => m.db_table_name === detailTableName)?.db_schema_name || project?.slug || 'public',
                  slug: project?.slug
                }
              })

              setTimeout(() => {
                if (!settled) {
                  settled = true
                  cleanupDetail()
                  resolve()
                }
              }, 4000)
            })
          }
        }
      }

      // Post-save: refresh data and optionally close
      setIsProcessing(false)
      if (isTemporary) {
        supabase.removeChannel(channel)
      }

      if (isCadastroOnly) {
        if (action === 'insert') {
          // No modo "Apenas Cadastro", limpa o formulário para permitir um novo registro
          setSelectedRow(null)
          setDrawerMode('create')
          setIsPageVisible(true)
          setRefreshKey(prev => prev + 1)
        } else {
          // Se foi atualização de um registro no modo modal embed/cadastro, mantém os dados
          setSelectedRow((prev: any) => prev ? { ...prev, ...formData } : prev)
          setRefreshKey(prev => prev + 1)
        }
      } else if (isPage) {
        const updatedRow = { ...(selectedRow || {}), ...formData, [cleanPkName]: masterId }
        const freshDetails = await fetchDetails(updatedRow, modelName)
        setSelectedRow({ ...updatedRow, _details: freshDetails })
        setDrawerMode('edit')
        setRefreshKey(prev => prev + 1)
      } else {
        setOpen(false)
        setSelectedRow(null)
        setRefreshKey(prev => prev + 1)
      }

      toast(
        drawerMode === 'create'
          ? t('runtime.create_success', 'Registro criado com sucesso!')
          : t('runtime.update_success', 'Registro atualizado com sucesso!'),
        'success'
      )

    } catch (error) {
      console.error('Error saving:', error)
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    setIsProcessing(true)
    const queryId = crypto.randomUUID()

    try {
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

      const payload: any = {
        queryId,
        table: modelName,
        tableName: modelName,
        action: 'delete',
        query: rawQuery,
        sql: rawQuery,
        idColumn: cleanPkName,
        idValue: pkValue,
        token: project?.secret_token || 'test-token',
        schemaName: project?.models?.find((m: any) => m.db_table_name === modelName)?.db_schema_name || project?.slug || 'public'
      }

      if (Object.keys(filters).length > 0) {
        payload.filters = filters
        payload.where = filters
        payload.id = filters[pkName]
      }

      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const isTemp = !tunnelChannel || !isTunnelReady
        const ch = isTemp ? supabase.channel(`tunnel:${project.id}`) : tunnelChannel
        let settled = false

        const handleResult = (payload: any) => {
          if (payload.payload?.queryId === queryId) {
            settled = true
            cleanup()
            resolve({ success: payload.payload.success, error: payload.payload.error })
          }
        }

        const cleanup = () => {
          try {
            const bindings = ch.bindings?.broadcast
            if (Array.isArray(bindings)) {
              ch.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
            }
            if (isTemp) {
              ch.unsubscribe()
              supabase.removeChannel(ch)
            }
          } catch (_) {}
        }

        ch.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
        ch.on('broadcast', { event: 'sql_result' }, handleResult)

        const doSend = () => {
          ch.send({
            type: 'broadcast',
            event: 'sql_query',
            payload
          })
        }

        if (isTemp) {
          ch.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              doSend()
            }
          })
        } else {
          doSend()
        }

        setTimeout(() => {
          if (!settled) {
            settled = true
            cleanup()
            resolve({ success: false, error: 'Timeout' })
          }
        }, 9000)
      })

      setIsDeleteModalOpen(false)
      setIsProcessing(false)

      if (result.success) {
        setRefreshKey(prev => prev + 1)
        toast(t('runtime.delete_success', 'Registro excluído com sucesso!'), 'success')
      } else {
        let errorMsg = result.error || 'Erro ao excluir o registro.'
        if (errorMsg.includes('foreign key constraint') || errorMsg.includes('violates foreign key') || errorMsg.includes('chave estrangeira')) {
          const defaultFkError = t('runtime.delete_fk_error', 'Não é possível excluir este registro pois ele possui relacionamentos ativos (chave estrangeira).')
          errorMsg = getFkErrorMessage(errorMsg, defaultFkError)
        }
        toast(errorMsg, 'error')
      }
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
            {isAutomationsEnabled && (
              <button
                onClick={() => router.push(`/${workspace.slug}/${project.slug}/automations?use_case=${viewId}`)}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-full transition-all text-xs font-bold shadow-sm active:scale-95"
                title="Configurar automações e regras de negócio desta tela"
              >
                <Workflow className="w-4 h-4 text-indigo-500" />
                <span className="hidden sm:inline">Automações</span>
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
            tabsStyleConfig={tabsStyleConfig}
            detailDisplayMode={detailDisplayMode}
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
              schedulerConfig={schedulerConfig}
              timelineConfig={timelineConfig}
              mapConfig={mapConfig}
              ganttConfig={ganttConfig}
              blueprintConfig={blueprintConfig}
              initialEditId={initialEditId}
              masterModelId={masterModelId}
              detailDisplayMode={detailDisplayMode}
              dictionary={dictionary}
              joins={joins}
              actionInterfaceType={actionInterfaceType}
              externalFilters={globalFilterValues}
              onFiltersChange={setGlobalFilterValues}
              tunnelChannel={tunnelChannel}
              isTunnelReady={isTunnelReady}
              galleryClickBehavior={galleryClickBehavior}
              onAdd={handleOpenAdd}
              onView={handleOpenView}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
              customActions={customActions}
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
          tabsStyleConfig={tabsStyleConfig}
          detailDisplayMode={detailDisplayMode}
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
          tabsStyleConfig={tabsStyleConfig}
          detailDisplayMode={detailDisplayMode}
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
          masterTabTitle: masterTabTitle,
          detailsTabTitles: detailsTabTitles,
          joins: joins,
          dictionary: dictionary,
          detailsInlineTypes: detailsInlineTypes,
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
          onCustomAction: handleCustomAction
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
        projectId={project.id}
        secretToken={project.secret_token}
        tunnelChannel={tunnelChannel}
        isTunnelReady={isTunnelReady}
        project={project}
        customActions={customActions}
        onCustomAction={handleCustomAction}
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
        onEditDetail={handleEditDetail}
        onDeleteDetail={handleDeleteDetail}
        onAddDetail={handleOpenAddDetail}
        tabsStyleConfig={tabsStyleConfig}
        joins={joins}
        dictionary={dictionary}
        detailsInlineTypes={detailsInlineTypes}
        initialTab={activeTabForDetail}
        onTabChange={setActiveTabForDetail}
        projectId={project.id}
        secretToken={project.secret_token}
        tunnelChannel={tunnelChannel}
        isTunnelReady={isTunnelReady}
        project={project}
        customActions={customActions}
        onCustomAction={handleCustomAction}
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
      >
        <div className="w-full h-full bg-white dark:bg-neutral-950">
          {isIframeDrawerOpen && <iframe src={iframeUrl} className="w-full h-full border-none" />}
        </div>
      </Drawer>

    </div>
  )
}
