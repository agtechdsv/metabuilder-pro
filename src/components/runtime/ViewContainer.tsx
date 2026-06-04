'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutGrid, List, Search, Filter, Plus, Pencil, Trash2, RefreshCcw, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Zap, Link, Database, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import DynamicGrid from '@/components/DynamicGrid'
import { DynamicIcon } from '@/components/runtime/DynamicIcon'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Drawer } from '@/components/ui/Drawer'

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
  onDelete?: (row: any) => void
  logicType?: string
  primaryKeyName?: string
  kanbanGroupField?: string
  mindmapCentralField?: string
  schedulerConfig?: any
  timelineConfig?: any
  initialEditId?: string | null
  mapConfig?: any
  ganttConfig?: any
  blueprintConfig?: any
  masterModelId?: string
  detailDisplayMode?: 'tabs' | 'sections'
  dictionary?: any
  joins?: any[]
  project?: any
  actionInterfaceType?: 'drawer' | 'modal' | 'page'
  externalFilters?: Record<string, string>
  onFiltersChange?: (filters: Record<string, string>) => void
  tunnelChannel?: any
  isTunnelReady?: boolean
  galleryClickBehavior?: 'lightbox' | 'thumbnail'
  customActions?: any[]
  externalRefreshTrigger?: number
}

import DynamicCardList from './DynamicCardList'
import DynamicKanban from './DynamicKanban'
import DynamicMindMap from './DynamicMindMap'
import DynamicScheduler from './DynamicScheduler'
import DynamicGallery from './DynamicGallery'
import DynamicTimeline from './DynamicTimeline'
import DynamicMap from './DynamicMap'
import DynamicGantt from './DynamicGantt'
import DynamicBlueprint from './DynamicBlueprint'
import { createClient } from '@/utils/supabase/client'
import { Loader2 } from 'lucide-react'

// Cache persistente entre reloads de página (essencial para troca de idioma via cookie/hard reload)
const getCachedData = (key: string) => {
  if (typeof window === 'undefined') return null
  const cached = sessionStorage.getItem(`metabuilder_cache_${key}`)
  return cached ? JSON.parse(cached) : null
}

const setCachedData = (key: string, data: any[]) => {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(`metabuilder_cache_${key}`, JSON.stringify(data))
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
  mindmapCentralField,
  schedulerConfig,
  timelineConfig,
  initialEditId,
  mapConfig,
  ganttConfig,
  blueprintConfig,
  masterModelId,
  detailDisplayMode = 'tabs',
  dictionary = {},
  joins = [],
  project,
  actionInterfaceType = 'drawer',
  externalFilters = {},
  onFiltersChange,
  tunnelChannel,
  isTunnelReady,
  galleryClickBehavior,
  customActions = [],
  externalRefreshTrigger = 0
}: ViewContainerProps) {
  const { toast } = useToast()
  const router = useRouter()
  const { t } = useI18n()
  
  const [iframeUrl, setIframeUrl] = useState<string>('')
  const [iframeTitle, setIframeTitle] = useState<string>('')
  const [isIframeModalOpen, setIsIframeModalOpen] = useState(false)
  const [isIframeDrawerOpen, setIsIframeDrawerOpen] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CLOSE_MODAL') {
        setIsIframeModalOpen(false)
        setIsIframeDrawerOpen(false)
        setIframeUrl('')
        setRefreshTrigger(prev => prev + 1)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const handleCustomAction = async (action: any, rowData?: any) => {
    // Helper to interpolate variables {{field}}
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
          setRefreshTrigger(prev => prev + 1)
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
      tunnelChannel.send({
        type: 'broadcast',
        event: 'sql_query',
        payload
      })
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
        // page mode
        router.push(url)
      }
    }
    else if (action.trigger_type === 'rest') {
      const url = interpolate(action.rest_url)
      try {
        toast(`Executando chamada REST...`, 'info')
        const options: RequestInit = {
          method: action.rest_method || 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
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
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'kanban' | 'mapa_mental' | 'scheduler' | 'galeria' | 'timeline' | 'map' | 'gantt' | 'blueprint'>(
    logicType === 'mapa_mental' ? 'mapa_mental' : logicType === 'blueprint' ? 'blueprint' : logicType === 'timeline' ? 'timeline' : logicType === 'map' ? 'map' : logicType === 'gantt' ? 'gantt' : logicType === 'kanban' ? 'kanban' : logicType === 'scheduler' ? 'scheduler' : logicType === 'galeria' ? 'galeria' : (displayType === 'both' ? defaultView : (displayType as any))
  )
  const [searchQuery, setSearchQuery] = useState('')
  const filterValues = externalFilters
  const setFilterValues = (newVal: any) => {
    if (typeof newVal === 'function') {
      onFiltersChange?.(newVal(filterValues))
    } else {
      onFiltersChange?.(newVal)
    }
  }
  const [relationalOptions, setRelationalOptions] = useState<Record<string, any[]>>({})

  // Busca opções relacionais para os campos de filtro
  useEffect(() => {
    const fetchAllRelational = async () => {
      const supabaseClient = createClient()
      const newOptions: Record<string, any[]> = {}
      
      const allFieldsWithRelational = [...filterFields, ...displayFields]
      // Remover duplicados por ID
      const uniqueFields = Array.from(new Map(allFieldsWithRelational.map(f => [f.id, f])).values())

      for (const field of uniqueFields) {
        const config = field.config?.filter_config || field.config?.grid_config || field.config
        const comp = config?.component
        const isRelationalComp = comp?.type && (['select', 'radio', 'checkbox', 'Combo (Select)'].includes(comp.type) || comp.options_type === 'relational' || comp.options_type === 'enumeration')
        if (isRelationalComp && comp.options_type === 'relational' && comp.rel_table) {
          try {
            console.log(`[MetaBuilder] Fetching filter options for ${field.display_name} from ${comp.rel_table}`)
            
            let data: any[] = []

            if (projectId && tunnelChannel && isTunnelReady) {
              const queryId = crypto.randomUUID()
              const rawQuery = `SELECT "${comp.rel_label}", "${comp.rel_value}" FROM "${comp.rel_table}"`
              const schemaToUse = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === comp.rel_table?.toLowerCase())?.db_schema_name || project?.slug || 'public'
              
              data = await new Promise<any[]>((resolve, reject) => {
                let resolved = false
                const cleanup = () => {
                  try {
                    const bindings = tunnelChannel.bindings?.broadcast
                    if (Array.isArray(bindings)) {
                      tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
                    }
                  } catch (e) {}
                }

                const handleResult = (payload: any) => {
                  if (payload.payload?.queryId === queryId) {
                    resolved = true
                    cleanup()
                    if (payload.payload.success) resolve(payload.payload.data || [])
                    else reject(new Error(payload.payload.error || 'Error fetching relational options'))
                  }
                }

                tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
                tunnelChannel.on('broadcast', { event: 'sql_result' }, handleResult)
                
                tunnelChannel.send({
                  type: 'broadcast',
                  event: 'sql_query',
                  payload: {
                    queryId,
                    table: comp.rel_table,
                    schemaName: schemaToUse,
                    action: 'select',
                    query: rawQuery,
                    sql: rawQuery,
                    token: project?.secret_token || 'test-token',
                    joins: [],
                    limit: 1000,
                    offset: 0
                  }
                })
                
                setTimeout(() => {
                  if (!resolved) {
                    resolved = true
                    cleanup()
                    console.warn(`[MetaBuilder] Timeout fetching filter options for ${comp.rel_table}`)
                    resolve([])
                  }
                }, 8000)
              })
            } else {
              const { data: directData } = await supabaseClient
                .from(comp.rel_table)
                .select(`${comp.rel_label}, ${comp.rel_value}`)
              if (directData) data = directData
            }
            
            if (data) {
              newOptions[field.id] = data.map((item: any) => ({
                label: item[comp.rel_label] || item[comp.rel_label?.toLowerCase()] || item[comp.rel_label?.toUpperCase()],
                value: item[comp.rel_value] || item[comp.rel_value?.toLowerCase()] || item[comp.rel_value?.toUpperCase()]
              }))
            }
          } catch (err) {
            console.error(`Error fetching relational options for filter field ${field.id}:`, err)
          }
        } else if (isRelationalComp && comp.options_type === 'enumeration' && comp.rel_table) {
          try {
            const { data } = await supabase
              .from('project_enumerations')
              .select('values')
              .eq('id', comp.rel_table)
              .single()

            if (data && data.values) {
              newOptions[field.id] = data.values.map((v: any) => ({
                label: v.description || v.value,
                value: v.value
              }))
            }
          } catch (err) {
            console.error(`Error fetching enumeration options for filter field ${field.id}:`, err)
          }
        }
      }
      setRelationalOptions(newOptions)
    }
    
    if (filterFields.length > 0 || displayFields.length > 0) {
      fetchAllRelational()
    }
  }, [filterFields, displayFields, isTunnelReady, tunnelChannel, project, projectId, refreshTrigger])

  const parseFixedOptions = (str: string) => {
    if (!str) return []
    return str.split(',').map(pair => {
      if (!pair.includes(':')) return { label: pair.trim(), value: pair.trim() }
      const [label, value] = pair.split(':').map(s => s.trim())
      return { label: label || value, value: value || label }
    })
  }

  const canSearch = buttonsConfig.find((b: any) => b.id === 'search')?.visible === true
  const canClear = buttonsConfig.find((b: any) => b.id === 'clear')?.visible === true

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

  const btnSearch = buttonsConfig?.find((b: any) => b.id === 'search')
  const btnClear = buttonsConfig?.find((b: any) => b.id === 'clear')
  
  const labelSearch = btnSearch?.custom_label !== undefined && btnSearch.custom_label !== '' 
    ? btnSearch.custom_label 
    : t('runtime.search')
  
  const labelClear = btnClear?.custom_label !== undefined && btnClear.custom_label !== '' 
    ? btnClear.custom_label 
    : t('runtime.clear')
  
  // Como agora este componente roda apenas no Cliente (SSR: false), 
  // podemos inicializar direto do sessionStorage sem medo de Hydration Mismatch.
  const [data, setData] = useState<any[]>(() => getCachedData(`${projectId}:${modelName}`) || [])
  const [isLoading, setIsLoading] = useState(!getCachedData(`${projectId}:${modelName}`))
  const [error, setError] = useState<string | null>(null)

  // Paginação e Ordenação
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(viewMode === 'list' ? 15 : 10)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [totalServerRows, setTotalServerRows] = useState<number>(0)

  // Recupera do cache inicial se necessário (redundante com useState inicial mas bom para sincronia)
  useEffect(() => {
    const cached = getCachedData(`${projectId}:${modelName}`)
    if (cached && data.length === 0) {
      setData(cached)
      setIsLoading(false)
    }
  }, [projectId, modelName])

  // Cache global para evitar fetch no re-mount por troca de idioma
  const [hasFetchedInitial, setHasFetchedInitial] = useState(false)

  // Atualiza itemsPerPage padrão ao mudar de modo, se o usuário ainda não tiver mudado manualmente
  useEffect(() => {
    setItemsPerPage(viewMode === 'list' ? 15 : 10)
    setCurrentPage(1)
  }, [viewMode])

  const supabase = createClient()

  // 1. Refs e Hooks de topo (Regras do React)
  const activeQueriesRef = useRef<Set<string>>(new Set())
  const queryConfigsRef = useRef<Map<string, { append: boolean }>>(new Map())
  const currentFiltersRef = useRef<any>({})
  const hasAutoOpenedEditRef = useRef<boolean>(false)
  
  useEffect(() => {
    currentFiltersRef.current = externalFilters
  }, [externalFilters])

  // Listener centralizado usando o canal do PAI
  useEffect(() => {
    if (!tunnelChannel || !isTunnelReady) return
    
    console.log(`[MetaBuilder] 📡 Configurando listener da Lista no canal compartilhado.`)
    
    const handleSqlResult = (payload: any) => {
      const qId = payload.payload?.queryId
      if (!qId || !activeQueriesRef.current.has(qId)) return

      console.log(`[MetaBuilder] Resposta recebida na Lista para ${qId}`)
      
      const config = queryConfigsRef.current.get(qId)
      const shouldAppend = config?.append || false
      queryConfigsRef.current.delete(qId)

      if (payload.payload.success) {
        if (payload.payload.action === 'count_records') {
           setTotalServerRows(payload.payload.total || 0)
           activeQueriesRef.current.delete(qId)
           return
        }

        const currentConfigs = queryConfigsRef.current.get(qId)
        const shouldAppend = currentConfigs?.append
        
        let resultData = payload.payload.data || []
        
        // Agrupar mestre/detalhe
        if (logicType === 'master_detail' && joins && joins.length > 0) {
          const primaryKeyName = formFields.find((f: any) => f.is_primary_key)?.db_column_name || 'id'
          
          const grouped: Record<string, any> = {}
          resultData.forEach((row: any) => {
            const pkValue = row[primaryKeyName] || row.id || row.ID
            if (!pkValue) return
            
            if (!grouped[pkValue]) {
              grouped[pkValue] = { ...row, _details: [] }
            }
            grouped[pkValue]._details.push(row)
          })
          resultData = Object.values(grouped)
        }
        
        resultData = resultData.map((row: any) => ({
          ...row,
          _key: crypto.randomUUID()
        }))

        if (shouldAppend) {
          setData(prev => {
            const existingIds = new Set(prev.map(row => String(row[primaryKeyName] || row.id || row.ID)))
            const newRows = resultData.filter((row: any) => !existingIds.has(String(row[primaryKeyName] || row.id || row.ID)))
            return [...prev, ...newRows]
          })
        } else {
          setData(resultData)
          
          if (initialEditId && onEdit) {
            if (!hasAutoOpenedEditRef.current) {
              const rowToEdit = resultData.find((r: any) => String(r[primaryKeyName || 'id'] || r.id) === String(initialEditId))
              if (rowToEdit) {
                hasAutoOpenedEditRef.current = true
                onEdit(rowToEdit)
              }
            }
          }

          const cacheKey = `${projectId}:${modelName}`
          if (!Object.keys(currentFiltersRef.current || {}).length) {
            setCachedData(cacheKey, resultData)
          }
        }
      } else {
        setError(payload.payload.error)
      }
      setIsLoading(false)
      activeQueriesRef.current.delete(qId)
    }

    tunnelChannel.on('broadcast', { event: 'sql_result' }, handleSqlResult)

    return () => {
      const bindings = tunnelChannel.bindings?.broadcast
      if (Array.isArray(bindings)) {
        const binding = bindings.find((b: any) => b.callback === handleSqlResult)
        if (binding) {
          if (tunnelChannel.channelAdapter) {
            tunnelChannel.channelAdapter.off('broadcast', binding.ref)
          }
          tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleSqlResult)
        }
      }
    }
  }, [tunnelChannel, isTunnelReady])

  const fetchDataRef = useRef<any>(null)

  const fetchData = async (currentFilters: any = {}, forceRefresh: boolean = false, append: boolean = false) => {
    if (!tunnelChannel || !isTunnelReady) {
      console.warn(`[MetaBuilder] Busca ignorada: canal do túnel não está pronto ainda.`)
      return
    }

    const cacheKey = `${projectId}:${modelName}`
    const cached = getCachedData(cacheKey)

    if (!forceRefresh && !append && cached && !Object.keys(currentFilters).length) {
      setData(cached)
      setIsLoading(false)
      return
    }

    const queryId = crypto.randomUUID()
    queryConfigsRef.current.set(queryId, { append })
    activeQueriesRef.current.add(queryId)
    
    if (!cached || append) setIsLoading(true)
    setError(null)
    
    console.log(`[MetaBuilder] Solicitando dados via Túnel (${queryId})...`, { table: modelName })
    
    const channelName = `tunnel:${projectId}`
    const channel = supabase.channel(channelName)

    // Aguarda um momento para o canal estar pronto e envia
    setTimeout(() => {
          // Build raw SQL query with aliases to avoid column name shadowing (e.g. multiple 'name' columns)
          // We must also build the JOINs manually if we provide a raw query
          const buildJoinsSql = (joinsList: any[]) => {
            if (!joinsList || joinsList.length === 0) return ''
            
            // Resolvemos os joins caso venham como IDs do Wizard
            const resolvedJoins = joinsList.map(j => {
              if (j.toTable && j.table) return j
              
              // Se já vier da versão nova do Wizard (JoinsEditor) que salva db_table_name e db_column_name
              if (j.localKey && j.foreignKey) {
                return {
                  table: j.from,
                  toTable: j.to,
                  on: j.localKey,
                  toOn: j.foreignKey
                }
              }
              
              if (project?.models) {
                const fromModel = project.models?.find((m: any) => String(m.id) === String(j.from) || m.db_table_name === j.from)
                const toModel = project.models?.find((m: any) => String(m.id) === String(j.to) || m.db_table_name === j.to)
                const fromTable = fromModel?.db_table_name
                const toTable = toModel?.db_table_name
                
                const localField = fromModel?.fields?.find((f: any) => String(f.id) === String(j.local_field) || f.db_column_name === j.local_field)
                const foreignField = toModel?.fields?.find((f: any) => String(f.id) === String(j.foreign_field) || f.db_column_name === j.foreign_field)
                
                if (!fromTable || !toTable || !localField || !foreignField) return null
                
                return {
                  table: fromTable,
                  toTable: toTable,
                  on: localField.db_column_name,
                  toOn: foreignField.db_column_name
                }
              }
              return null
            }).filter(Boolean)

            // Coleta todas as tabelas requeridas por filtros e colunas selecionadas
            const requiredTables = new Set<string>();
            if (currentFilters) {
              Object.keys(currentFilters).forEach(key => {
                if (key.includes('.')) requiredTables.add(key.split('.')[0]);
              });
            }
            if (displayFields) {
               displayFields.forEach(f => {
                 const col = f.sql_expression || f.db_column_name;
                 if (col && col.includes('.')) {
                    requiredTables.add(col.split('.')[0]);
                 }
               });
            }

            // Auto-detect missing joins required by filters and select (multi-hop graph resolution)
            if (requiredTables.size > 0 && project?.models) {
              const findRelation = (modelA: any, modelB: any) => {
                if (!modelA || !modelB) return null;
                const modelBNameSingular = modelB.db_table_name.endsWith('s') ? modelB.db_table_name.slice(0, -1) : modelB.db_table_name;
                const modelBNameShort = modelBNameSingular.slice(0, -2);
                const modelBParts = modelB.db_table_name.split('_');
                
                // Priority 1: Explicit rel_table configuration
                let fkField = modelA.fields?.find((f: any) => {
                  const rel = f.config?.rel_table || '';
                  return rel !== '' && (rel === modelB.db_table_name || rel + 's' === modelB.db_table_name || modelB.db_table_name.includes(rel) || rel.includes(modelBNameSingular));
                });
                if (fkField) {
                  return { table: modelA.db_table_name, toTable: modelB.db_table_name, on: fkField.db_column_name, toOn: 'id' };
                }
                
                // Priority 2: Field name matches pattern and ends with _id
                fkField = modelA.fields?.find((f: any) => {
                  const col = (f.db_column_name || '').toLowerCase();
                  if (!col.endsWith('_id')) return false;
                  
                  if (col.includes(modelBNameSingular.toLowerCase()) || col.includes(modelBNameShort.toLowerCase())) return true;
                  
                  // Try matching first part of snake_case table name (pedidos_compra -> pedido_id)
                  if (modelBParts.length > 1) {
                     const firstPartSingular = modelBParts[0].endsWith('s') ? modelBParts[0].slice(0, -1) : modelBParts[0];
                     if (col.includes(firstPartSingular.toLowerCase())) return true;
                  }
                  
                  return false;
                });
                if (fkField) {
                  return { table: modelA.db_table_name, toTable: modelB.db_table_name, on: fkField.db_column_name, toOn: 'id' };
                }
                return null;
              };

              // Start dependency resolution
              const tablesToJoin = Array.from(requiredTables).filter(t => t !== modelName);
              const currentlyJoined = new Set<string>([modelName.toLowerCase()]);
              let changed = true;

              while (changed && tablesToJoin.length > 0) {
                changed = false;
                for (let i = 0; i < tablesToJoin.length; i++) {
                  const reqTable = tablesToJoin[i];
                  const relModel = project.models.find((m: any) => m.db_table_name === reqTable);
                  if (!relModel) continue;

                  let foundRelation: any = null;
                  for (const joinedTable of currentlyJoined) {
                    const joinedModel = project.models.find((m: any) => m.db_table_name === joinedTable);
                    if (!joinedModel) continue;

                    // Check both directions:
                    // 1. joinedModel -> relModel (foreign key in joinedModel pointing to relModel)
                    foundRelation = findRelation(joinedModel, relModel);
                    if (foundRelation) break;

                    // 2. relModel -> joinedModel (foreign key in relModel pointing to joinedModel)
                    foundRelation = findRelation(relModel, joinedModel);
                    if (foundRelation) break;
                  }

                  if (foundRelation) {
                    const isDuplicate = resolvedJoins.some((rj: any) =>
                      (rj.table === foundRelation.table && rj.toTable === foundRelation.toTable) ||
                      (rj.table === foundRelation.toTable && rj.toTable === foundRelation.table)
                    );
                    if (!isDuplicate) {
                      resolvedJoins.push(foundRelation);
                    }
                    currentlyJoined.add(reqTable.toLowerCase());
                    tablesToJoin.splice(i, 1);
                    changed = true;
                    break;
                  }
                }
              }
            }
  
              if (resolvedJoins.length === 0) return ''
  
              // Mapeamos para garantir que o JOIN seja sempre "OUTRA_TABELA ON TABELA_EXISTENTE.col = OUTRA_TABELA.col"
              const joinedTables = new Set([modelName.toLowerCase()])
              const sqlParts: string[] = []
              
              // Tentamos encaixar cada join no que já temos na query
              let changed = true
              const remaining = [...resolvedJoins]
              while (changed && remaining.length > 0) {
                changed = false
                for (let i = 0; i < remaining.length; i++) {
                  const j = remaining[i]
                  const fromT = j.table.toLowerCase()
                  const toT = j.toTable.toLowerCase()
                  
                  let targetTable = ''
                  let existingTable = ''
                  let localOn = ''
                  let foreignOn = ''
  
                  if (joinedTables.has(fromT) && !joinedTables.has(toT)) {
                    targetTable = j.toTable
                    existingTable = j.table
                    localOn = j.on
                    foreignOn = j.toOn
                  } else if (joinedTables.has(toT) && !joinedTables.has(fromT)) {
                    targetTable = j.table
                    existingTable = j.toTable
                    localOn = j.toOn
                    foreignOn = j.on
                  }
  
                  if (targetTable) {
                    sqlParts.push(`LEFT JOIN "${targetTable}" ON "${existingTable}"."${localOn}" = "${targetTable}"."${foreignOn}"`)
                    joinedTables.add(targetTable.toLowerCase())
                    remaining.splice(i, 1)
                    changed = true
                    break
                  }
                }
              }
              return sqlParts.join(' ')
            }
            
            const selectExprs: string[] = []
            const seenExprs = new Set<string>()

            const addSelectExpr = (expr: string, alias?: string) => {
              const key = alias || expr
              if (seenExprs.has(key.toLowerCase())) return
              seenExprs.add(key.toLowerCase())
              
              const hasAlias = expr.toLowerCase().includes(' as ')
              
              let finalExpr = expr
              if (!expr.includes('.') && !hasAlias) {
                finalExpr = `"${modelName}"."${expr}"`
              }
              
              if (alias && !hasAlias) {
                selectExprs.push(`${finalExpr} AS "${alias}"`)
              } else if (expr.includes('.') && !hasAlias) {
                selectExprs.push(`${finalExpr} AS "${expr}"`)
              } else if (!expr.includes('.') && !hasAlias) {
                selectExprs.push(finalExpr)
              } else {
                selectExprs.push(finalExpr)
              }
            }

            // 1. Sempre selecionar a Chave Primaria
            const cleanPk = primaryKeyName.split('.').pop() || 'id'
            if (primaryKeyName.includes('.')) {
              addSelectExpr(primaryKeyName, primaryKeyName)
            } else {
              addSelectExpr(`"${modelName}"."${cleanPk}"`, cleanPk)
            }

            // 2. Selecionar displayFields
            if (displayFields && displayFields.length > 0) {
              displayFields.forEach(f => {
                if (!f) return
                const expr = f.sql_expression || f.db_column_name
                if (expr) {
                  addSelectExpr(expr, f.db_column_name)
                }
              })
            }

            // 3. Selecionar formFields (tabela principal ou joins)
            if (formFields && formFields.length > 0) {
              formFields.forEach(f => {
                if (!f) return
                const isMasterModel = !f.model_name || f.model_name.toLowerCase() === modelName.toLowerCase()
                const isJoinedModel = joins && joins.some((j: any) => {
                  const toTable = j.toTable || j.to
                  return toTable && f.model_name && toTable.toLowerCase() === f.model_name.toLowerCase()
                })
                if (isMasterModel || isJoinedModel) {
                  const expr = f.sql_expression || f.db_column_name
                  if (expr) {
                    addSelectExpr(expr, f.db_column_name)
                  }
                }
              })
            }

            // 4. Selecionar filterFields (tabela principal ou joins)
            if (filterFields && filterFields.length > 0) {
              filterFields.forEach(f => {
                if (!f) return
                const isMasterModel = !f.model_name || f.model_name.toLowerCase() === modelName.toLowerCase()
                const isJoinedModel = joins && joins.some((j: any) => {
                  const toTable = j.toTable || j.to
                  return toTable && f.model_name && toTable.toLowerCase() === f.model_name.toLowerCase()
                })
                if (isMasterModel || isJoinedModel) {
                  const expr = f.sql_expression || f.db_column_name
                  if (expr) {
                    addSelectExpr(expr, f.db_column_name)
                  }
                }
              })
            }

            const columns = selectExprs.length > 0 ? selectExprs.join(', ') : '*'
          
          const currentOffset = append ? data.length : (currentPage - 1) * itemsPerPage;
          let rawQuery = '';
          if (logicType === 'master_detail') {
            rawQuery = `SELECT ${columns} FROM (
  SELECT * FROM "${modelName}"
  __WHERE_PLACEHOLDER__
  LIMIT ${itemsPerPage} OFFSET ${currentOffset}
) AS "${modelName}" ${buildJoinsSql(joins)}`
          } else {
            rawQuery = `SELECT ${columns} FROM "${modelName}" ${buildJoinsSql(joins)}`
          }

          const currentModel = project?.models?.find((m: any) => m.db_table_name === modelName)
          const actualSchemaName = currentModel?.db_schema_name || project?.slug || 'public'

          const payload: any = {
            queryId: queryId,
            table: modelName,
            tableName: modelName,
            schemaName: actualSchemaName,
            action: 'select',
            query: rawQuery,
            sql: rawQuery,
            token: project?.secret_token || 'test-token',
            joins: joins,
            limit: logicType === 'master_detail' ? null : itemsPerPage,
            offset: logicType === 'master_detail' ? null : currentOffset
          }

          if (currentFilters && Object.keys(currentFilters).length > 0) {
            payload.filters = currentFilters
          }

          // Count payload
          const countQueryId = crypto.randomUUID()
          activeQueriesRef.current.add(countQueryId)
          const countPayload: any = {
            queryId: countQueryId,
            table: modelName,
            tableName: modelName,
            schemaName: actualSchemaName,
            action: 'count_records',
            query: `SELECT COUNT(DISTINCT "${modelName}"."id") as total FROM "${modelName}" ${buildJoinsSql(joins)} __WHERE_PLACEHOLDER__`,
            sql: '',
            token: project?.secret_token || 'test-token',
            joins: joins
          }
          if (currentFilters && Object.keys(currentFilters).length > 0) {
            countPayload.filters = currentFilters
          }

          // Pequeno delay para garantir que o canal de broadcast esteja "quente"
          setTimeout(() => {
            if (!tunnelChannel || !isTunnelReady) return
            
            tunnelChannel.send({
              type: 'broadcast',
              event: 'sql_query',
              payload
            })
            
            if (!append) {
              tunnelChannel.send({
                type: 'broadcast',
                event: 'sql_query',
                payload: countPayload
              })
            }
          }, 200)
          
          // Timeout de segurança
          setTimeout(() => {
            setIsLoading(prev => {
              if (prev) {
                console.warn(`[MetaBuilder] Timeout na requisição ${queryId}`)
                setError('Tempo limite excedido na requisição. Verifique sua conexão ou a configuração da tabela.')
                return false
              }
              return prev
            })
          }, 10000)
      }, 100)
    }

  fetchDataRef.current = fetchData

  const handleMove = async (recordId: string, newValue: any) => {
    // 1. Descobrir o valor real da chave primária para enviar ao DB
    const cleanPrimaryKeyName = primaryKeyName.split('.').pop() || 'id'
    
    // O DynamicBlueprint prioriza row[pkCol], então devemos priorizar cleanPrimaryKeyName aqui!
    const movedItem = data.find(item => String(item[cleanPrimaryKeyName] || item[primaryKeyName] || item._key || item.id || item.ID) === recordId)
    
    if (!movedItem) {
      toast(`Item não encontrado (Procurado ID: ${recordId})`, 'error')
      return
    }

    const actualPrimaryKey = movedItem[cleanPrimaryKeyName] || movedItem[primaryKeyName] || movedItem.id || movedItem.ID
    if (!actualPrimaryKey) {
      toast('Chave primária do item não encontrada.', 'error')
      return
    }

    // 2. Determinar quais colunas atualizar
    let updates: Record<string, any> = {}
    if (newValue && typeof newValue === 'object') {
      updates = newValue
    } else {
      const groupFieldDef = displayFields.find(f => f.id === kanbanGroupField) || displayFields.find(f => f.db_column_name === 'status') || { db_column_name: 'status' }
      const groupFieldName = groupFieldDef.db_column_name
      const cleanGroupFieldName = groupFieldName.split('.').pop() || 'status'
      updates = { [cleanGroupFieldName]: newValue }
    }

    // 3. Otimismo: Atualiza localmente o estado
    setData(prev => {
      const newData = prev.map(item => {
        const itemId = String(item[cleanPrimaryKeyName] || item[primaryKeyName] || item._key || item.id || item.ID)
        if (itemId === recordId) {
          const updatedItem = { ...item }
          for (const [col, val] of Object.entries(updates)) {
            updatedItem[col] = val
            const fullField = displayFields.find(f => f.db_column_name.endsWith(col))?.db_column_name
            if (fullField) {
              updatedItem[fullField] = val
            }
          }
          return updatedItem
        }
        return item
      })
      
      // Atualiza também o cache persistente para não perdermos no F5
      const cacheKey = `${projectId}:${modelName}`
      setCachedData(cacheKey, newData)
      
      return newData
    })

    // 4. Constrói a Query SQL Dinâmica
    const setStatements = Object.entries(updates).map(([col, val]) => {
      const cleanVal = val === null ? 'NULL' : `'${String(val).replace(/'/g, "''")}'`
      return `${col} = ${cleanVal}`
    }).join(', ')

    const rawQuery = `UPDATE ${modelName} SET ${setStatements} WHERE ${cleanPrimaryKeyName} = '${String(actualPrimaryKey).replace(/'/g, "''")}'`
    
    const queryId = crypto.randomUUID()
    const payload: any = {
      queryId,
      table: modelName,
      tableName: modelName,
      schemaName: project?.models?.find((m: any) => m.db_table_name === modelName)?.db_schema_name || project?.slug || 'public',
      slug: project?.slug,
      action: 'update',
      data: updates,
      record: updates,
      query: rawQuery,
      sql: rawQuery,
      idColumn: cleanPrimaryKeyName,
      idValue: actualPrimaryKey,
      token: project?.secret_token || 'test-token'
    }

    const handleResult = (res: any) => {
      if (res.payload?.queryId === queryId) {
        if (!res.payload.success) {
          toast(res.payload.error || 'Erro ao salvar no banco', 'error')
        } else {
          toast('Salvo com sucesso!', 'success')
        }
      }
    }

    if (tunnelChannel && isTunnelReady) {
      tunnelChannel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
      console.log(`[MetaBuilder] 📡 Enviando atualização de movimento via Canal Compartilhado:`, payload)
      tunnelChannel.send({
        type: 'broadcast',
        event: 'sql_query',
        payload
      })
      setTimeout(() => {
        try {
          const bindings = tunnelChannel.bindings?.broadcast
          if (Array.isArray(bindings)) {
             tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
          }
        } catch (_) {}
      }, 5000)
    } else {
      console.log(`[MetaBuilder] ⚠️ Canal compartilhado não pronto. Usando canal temporário.`)
      const channelName = `tunnel:${projectId}`
      const channel = supabase.channel(channelName)

      channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'sql_query',
            payload
          })
          // Limpa canal após um tempo
          setTimeout(() => supabase.removeChannel(channel), 5000)
        }
      })
    }
  }

  const isFirstRender = useRef(true)

  useEffect(() => {
    if (!isTunnelReady) return

    // Na primeira renderização, se tiver cache e nenhum filtro ativo, usa o cache para visualização imediata
    if (isFirstRender.current) {
      const cacheKey = `${projectId}:${modelName}`
      const cached = getCachedData(cacheKey)
      const hasActiveFilters = Object.values(externalFilters).some(v => v !== undefined && v !== '')
      if (cached && !hasActiveFilters) {
        setData(cached)
        setIsLoading(false)
        // NÃO damos return! Deixamos prosseguir para fazer o fetch silencioso em background
      }
    }

    const handler = setTimeout(() => {
      console.log(`[MetaBuilder] Buscando dados frescos com filtros...`, externalFilters)
      fetchData(externalFilters, true)
      isFirstRender.current = false
    }, isFirstRender.current ? 50 : 400) // Debounce apenas nas digitações subsequentes

    return () => clearTimeout(handler)
  }, [projectId, modelName, isTunnelReady, externalFilters])

  const handleSearch = () => {
    fetchData(filterValues, true) // Busca sempre força o refresh
  }

  const handleClear = () => {
    setFilterValues({})
    fetchData({}, true) // Limpar força o refresh
  }

  // Cache global para evitar fetch no re-mount por troca de idioma
  useEffect(() => {
    // Only fetch if tunnel is ready, we haven't fetched yet, and we aren't loading from cache
    if (isTunnelReady && tunnelChannel && !hasFetchedInitial && data.length === 0) {
      console.log(`[MetaBuilder] Túnel pronto. Disparando busca inicial para ${modelName}...`)
      setHasFetchedInitial(true)
      fetchData(currentFiltersRef.current)
    }
  }, [isTunnelReady, tunnelChannel, hasFetchedInitial, data.length])

  const isFirstRenderPag = useRef(true)
  useEffect(() => {
    if (isFirstRenderPag.current) {
      isFirstRenderPag.current = false
      return
    }
    if (isTunnelReady) {
      fetchDataRef.current(currentFiltersRef.current, true)
    }
  }, [currentPage, itemsPerPage])

  useEffect(() => {
    if (refreshTrigger > 0 && fetchDataRef.current) {
      console.log(`[MetaBuilder] Refreshing data because modal was closed...`)
      toast('Atualizando dados...', 'info')
      fetchDataRef.current(currentFiltersRef.current, true)
    }
  }, [refreshTrigger])

  useEffect(() => {
    if (externalRefreshTrigger > 0 && fetchDataRef.current) {
      console.log(`[MetaBuilder] Refreshing data from external trigger...`)
      fetchDataRef.current(currentFiltersRef.current, true)
    }
  }, [externalRefreshTrigger])

  // Lógica de Ordenação Local
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0
    const { key, direction } = sortConfig
    const valA = a[key]
    const valB = b[key]

    if (valA < valB) return direction === 'asc' ? -1 : 1
    if (valA > valB) return direction === 'asc' ? 1 : -1
    return 0
  })

  // Lógica de Paginação Local substituída pela Server Side
  const totalPages = totalServerRows > 0 ? Math.ceil(totalServerRows / itemsPerPage) : Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = sortedData // data já vem paginada do servidor


  const handleSort = (columnName: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === columnName && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key: columnName, direction })
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
              {/* Se o padrão for card, o card vem primeiro. Se for list, a list vem primeiro. */}
              {defaultView === 'card' ? (
                <>
                  <button 
                    onClick={() => setViewMode('card')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'card' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'list' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                    )}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('card')}
                    className={cn(
                      "p-2 rounded-lg transition-all",
                      viewMode === 'card' ? 'bg-white dark:bg-neutral-800 text-indigo-600 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                    )}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Filter Arguments Bar with integrated Search Button */}
      {filterFields.length > 0 && (
        <div className="p-6 bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-inner">
          <div className="flex flex-col lg:flex-row items-end gap-6">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
               {filterFields.map(field => {
                 const zoneConfig = field.config?.filter_config || field.config || {}
                 
                 return (
                  <div key={field.id} className="flex flex-col gap-1.5">
                    <label 
                      style={{
                        fontFamily: zoneConfig.label?.font,
                        fontSize: getFontSize(zoneConfig.label?.size),
                        color: zoneConfig.label?.color,
                      }}
                      className={cn(
                        "text-[10px] font-black tracking-widest ml-1",
                        !zoneConfig.label?.color && "text-neutral-400"
                      )}
                    >
                      {zoneConfig.label?.text || field.display_name}
                    </label>
                    <div className="relative group">
                      {(() => {
                        const comp = zoneConfig.component || { type: 'text' }
                        const fieldType = comp.type || 'text'
                      const options = (comp.options_type === 'relational' || comp.options_type === 'enumeration') 
                        ? (relationalOptions[field.id] || [])
                        : parseFixedOptions(comp.fixed_options)
                      
                      const commonClasses = cn(
                        "w-full py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all shadow-sm",
                        !field.config?.content?.color && "text-neutral-900 dark:text-neutral-300",
                        fieldType === 'select' ? "px-4" : "pl-9 pr-4"
                      )

                      const style = {
                        fontFamily: getFontFamily(zoneConfig.content?.font),
                        fontSize: getFontSize(zoneConfig.content?.size),
                        color: zoneConfig.content?.color,
                      }

                      if (fieldType === 'select') {
                        return (
                          <select
                            value={filterValues[field.db_column_name] || ''}
                            onChange={e => setFilterValues({ ...filterValues, [field.db_column_name]: e.target.value })}
                            style={style}
                            className={commonClasses}
                          >
                            <option value="">{t('common.all', 'Todos')}</option>
                            {options.map((opt: any, i: number) => (
                              <option key={i} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        )
                      }

                      return (
                        <>
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-indigo-500 transition-colors" />
                          <input 
                            type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
                            placeholder={t('runtime.filter_placeholder').replace('{field}', field.display_name)}
                            value={filterValues[field.db_column_name] || ''}
                            onChange={e => setFilterValues({ ...filterValues, [field.db_column_name]: e.target.value })}
                            style={style}
                            className={commonClasses}
                          />
                        </>
                        )
                      })()}
                    </div>
                  </div>
                )})}
            </div>
            
            <div className="flex items-center gap-3 mb-[1px]">
              {canSearch && (
                <button 
                  onClick={handleSearch}
                  style={getButtonStyles(btnSearch)}
                  className={cn(
                    "h-[42px] px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2",
                    (btnSearch?.custom_label !== undefined && btnSearch.custom_label !== '') ? "" : "capitalize tracking-wider"
                  )}
                >
                  <Search className="w-4 h-4" />
                  {labelSearch}
                </button>
              )}

              {canClear && (
                <button 
                  onClick={handleClear}
                  style={getButtonStyles(btnClear)}
                  className={cn(
                    "h-[42px] px-6 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2",
                    (btnClear?.custom_label !== undefined && btnClear.custom_label !== '') ? "" : "capitalize tracking-wider"
                  )}
                >
                  <RefreshCcw className="w-4 h-4" />
                  {labelClear}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
        <div className="bg-white dark:bg-neutral-900/30 border border-neutral-200 dark:border-neutral-800 rounded-[2rem] overflow-hidden shadow-xl dark:shadow-none backdrop-blur-sm flex flex-col w-full">
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead className="sticky top-0 z-20">
                <tr className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="sticky left-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 w-[60px] border-r border-neutral-200/50 dark:border-neutral-700/50 shadow-[4px_0_10px_rgba(0,0,0,0.03)]">
                    <input type="checkbox" className="rounded-md bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-indigo-600 focus:ring-indigo-500 transition-all" />
                  </th>
                  {displayFields.filter(f => !f.hidden).map((field) => (
                    <th 
                      key={field.id} 
                      onClick={() => handleSort(field.db_column_name)}
                      style={{
                        fontFamily: getFontFamily(field.config?.label?.font),
                        fontSize: getFontSize(field.config?.label?.size),
                        color: field.config?.label?.color,
                        fontWeight: field.config?.label?.bold ? 'bold' : undefined,
                        fontStyle: field.config?.label?.italic ? 'italic' : undefined,
                        textTransform: field.config?.label?.uppercase ? 'uppercase' : undefined,
                      }}
                      className="px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] whitespace-nowrap cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors group/th"
                    >
                      <div className="flex items-center gap-2">
                        {field.display_name}
                        {field.is_primary_key && <span className="text-indigo-500" title={t('runtime.primary_key')}>🔑</span>}
                        <div className="opacity-0 group-hover/th:opacity-100 transition-opacity">
                          {sortConfig && sortConfig.key === field.db_column_name ? (
                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 tracking-[0.15em] border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)]">
                    {t('runtime.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                <DynamicGrid 
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
              </tbody>
            </table>
          </div>
          
          {/* Paginador Footer */}
          <div className="px-8 py-4 bg-neutral-50/50 dark:bg-neutral-900/50 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-4 text-[11px] font-bold text-neutral-500 uppercase tracking-widest">
              <span className="opacity-60">{t('runtime.show')}</span>
              <select 
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="bg-transparent border-none outline-none text-indigo-600 focus:ring-0 cursor-pointer"
              >
                <option value={10}>10 {t('runtime.rows')}</option>
                <option value={15}>15 {t('runtime.rows')}</option>
                <option value={25}>25 {t('runtime.rows')}</option>
                <option value={50}>50 {t('runtime.rows')}</option>
              </select>
              <span className="mx-2 opacity-20">|</span>
              <span className="opacity-60">{t('runtime.total')}: <span className="text-neutral-900 dark:text-white">{data.length}</span></span>
              {data.length >= 100 && (data.length % 100 === 0) && (
                <button
                  onClick={() => fetchData(externalFilters, false, true)}
                  disabled={isLoading}
                  className="ml-4 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black capitalize tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                  {t('runtime.load_more', 'Carregar mais 100')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-[10px] font-black transition-all",
                      currentPage === i + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                    )}
                  >
                    {i + 1}
                  </button>
                )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="space-y-6">
          <DynamicKanban 
            data={data}
            fields={displayFields}
            groupField={displayFields.find(f => f.id === kanbanGroupField) || displayFields.find(f => f.db_column_name === 'status') || { db_column_name: 'status' }}
            dictionary={dictionary}
            onMove={handleMove}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
          />
          {data.length >= 100 && (data.length % 100 === 0) && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchData(externalFilters, false, true)}
                disabled={isLoading}
                className="flex items-center gap-2 px-8 py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-black rounded-full text-[11px] font-black capitalize tracking-wider transition-all shadow-xl disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                {t('runtime.load_more_records', 'Carregar Próximos 100 Registros')} (Total: {data.length})
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'scheduler' ? (
        <DynamicScheduler 
          data={data}
          fields={displayFields}
          schedulerConfig={schedulerConfig || {}}
          onMove={handleMove}
          onAdd={onAdd}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          dictionary={dictionary}
        />
      ) : viewMode === 'timeline' ? (
        <DynamicTimeline
          data={data}
          fields={displayFields}
          timelineConfig={timelineConfig || {}}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onRefresh={() => fetchData(currentFiltersRef.current, true)}
          dictionary={dictionary}
        />
      ) : viewMode === 'map' ? (
        <DynamicMap
          data={data}
          fields={displayFields}
          mapConfig={mapConfig || {}}
          onView={onView!}
          onEdit={onEdit!}
          onDelete={onDelete!}
        />
      ) : viewMode === 'gantt' ? (
        <DynamicGantt
          data={data}
          fields={displayFields}
          ganttConfig={ganttConfig || {}}
          onView={onView!}
          onEdit={onEdit!}
          onDelete={onDelete!}
          dictionary={dictionary}
        />
      ) : viewMode === 'blueprint' ? (
        <DynamicBlueprint
          data={data}
          fields={displayFields}
          blueprintConfig={blueprintConfig || {}}
          onView={onView!}
          onEdit={onEdit!}
          onDelete={onDelete!}
          onMove={handleMove}
          onRefresh={() => fetchData(currentFiltersRef.current, true)}
          dictionary={dictionary}
        />
      ) : viewMode === 'mapa_mental' ? (
        <DynamicMindMap 
          data={data}
          fields={displayFields}
          centralFieldId={mindmapCentralField}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          primaryKeyName={primaryKeyName}
          dictionary={dictionary}
        />
      ) : viewMode === 'galeria' ? (
        <DynamicGallery 
          data={data}
          fields={displayFields}
          buttonsConfig={buttonsConfig}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          galleryClickBehavior={galleryClickBehavior}
        />
      ) : (
        <div className="space-y-6">
          <DynamicCardList 
            fields={displayFields.filter(f => !f.hidden)}
            data={paginatedData}
            buttonsConfig={buttonsConfig}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            customActions={customActions}
            onCustomAction={handleCustomAction}
          />

          {/* Paginador Footer para Cards */}
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
                    onClick={() => fetchData(externalFilters, false, true)}
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

      {/* Modal / Drawer for UseCase Actions */}
      <Modal 
        isOpen={isIframeModalOpen} 
        onClose={() => {
          setIsIframeModalOpen(false)
          setIframeUrl('')
          setRefreshTrigger(prev => prev + 1)
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
