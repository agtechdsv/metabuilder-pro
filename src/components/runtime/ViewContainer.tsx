'use client'

import { useState } from 'react'
import { LayoutGrid, List, Search, Filter, Plus, Pencil, Trash2, RefreshCcw, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import DynamicGrid from '@/components/DynamicGrid'
import { useI18n } from '@/i18n/I18nContext'

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
  onView?: (row: any) => void
  onEdit?: (row: any) => void
  onDelete?: (row: any) => void
  logicType?: string
  primaryKeyName?: string
  kanbanGroupField?: string
  mindmapCentralField?: string
  masterModelId?: string
  detailDisplayMode?: 'tabs' | 'sections'
  dictionary?: any
  joins?: any[]
  actionInterfaceType?: 'drawer' | 'modal'
  externalFilters?: Record<string, string>
  onFiltersChange?: (filters: Record<string, string>) => void
}

import DynamicCardList from './DynamicCardList'
import DynamicKanban from './DynamicKanban'
import DynamicMindMap from './DynamicMindMap'
import { useEffect } from 'react'
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
  onView,
  onEdit,
  onDelete,
  logicType,
  primaryKeyName = 'id',
  kanbanGroupField,
  mindmapCentralField,
  masterModelId,
  detailDisplayMode = 'tabs',
  dictionary = {},
  joins = [],
  actionInterfaceType = 'drawer',
  externalFilters = {},
  onFiltersChange
}: ViewContainerProps) {
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'kanban' | 'mapa_mental'>(
    logicType === 'mapa_mental' ? 'mapa_mental' : logicType === 'kanban' ? 'kanban' : (displayType === 'both' ? defaultView : (displayType as any))
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
      const supabase = createClient()
      const newOptions: Record<string, any[]> = {}
      
      for (const field of filterFields) {
        // Tenta pegar a config específica de filtro, senão usa a global
        const config = field.config?.filter_config || field.config
        const comp = config?.component
        if (comp?.type && ['select', 'radio', 'checkbox'].includes(comp.type) && comp.options_type === 'relational' && comp.rel_table) {
          try {
            console.log(`[MetaBuilder] Fetching filter options for ${field.display_name} from ${comp.rel_table}`)
            const { data } = await supabase
              .from(comp.rel_table)
              .select(`${comp.rel_label}, ${comp.rel_value}`)
            
            if (data) {
              newOptions[field.id] = data.map(item => ({
                label: item[comp.rel_label],
                value: item[comp.rel_value]
              }))
            }
          } catch (err) {
            console.error(`Error fetching relational options for filter field ${field.id}:`, err)
          }
        }
      }
      setRelationalOptions(newOptions)
    }
    
    if (filterFields.length > 0) {
      fetchAllRelational()
    }
  }, [filterFields])

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
  
  // Como agora este componente roda apenas no Cliente (SSR: false), 
  // podemos inicializar direto do sessionStorage sem medo de Hydration Mismatch.
  const [data, setData] = useState<any[]>(() => getCachedData(`${projectId}:${modelName}`) || [])
  const [isLoading, setIsLoading] = useState(!getCachedData(`${projectId}:${modelName}`))
  const [error, setError] = useState<string | null>(null)

  // Paginação e Ordenação
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(viewMode === 'list' ? 15 : 10)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

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

  const fetchData = async (currentFilters: any = {}, forceRefresh: boolean = false) => {
    const cacheKey = `${projectId}:${modelName}`
    const cached = getCachedData(cacheKey)

    // Se não for um refresh forçado e já tivermos dados no cache, não busca de novo
    if (!forceRefresh && cached && !Object.keys(currentFilters).length) {
      setData(cached)
      setIsLoading(false)
      return
    }

    // 1. Gera um ID único para esta requisição e limpa estados anteriores
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${projectId}`
    
    // Se não temos cache, mostramos o loader. Se temos, buscamos em background
    if (!cached) setIsLoading(true)
    setError(null)
    
    console.log(`[MetaBuilder] Iniciando busca ${queryId}...`, { table: modelName, filters: currentFilters })
    
    const channel = supabase.channel(channelName)

    // 2. Se inscreve para ouvir a resposta do Agente
    channel
      .on('broadcast', { event: `query_result_${queryId}` }, (payload) => {
        console.log(`[MetaBuilder] Resposta recebida para ${queryId}`, payload)
        if (payload.payload.success) {
          let resultData = payload.payload.data.map((row: any) => ({
            ...row,
            _key: crypto.randomUUID()
          }))

          // Lógica de Agrupamento para Mestre-Detalhe
          if (logicType === 'master_detail') {
            const grouped: Record<string, any> = {}
            resultData.forEach((row: any) => {
              const pkValue = String(row[primaryKeyName] || row.id || row.ID)
              if (!grouped[pkValue]) {
                grouped[pkValue] = { ...row, _details: [] }
              }
              // Se houver dados de JOIN (campos da tabela detalhe), adiciona ao array _details
              // Identificamos campos de detalhe por não pertencerem à tabela mestre (simplificado aqui)
              grouped[pkValue]._details.push(row)
            })
            resultData = Object.values(grouped)
          }

          setData(resultData)
          // Salva no cache se for uma busca sem filtros (carga inicial)
          if (!Object.keys(currentFilters).length) {
            setCachedData(cacheKey, resultData)
          }
        } else {
          setError(payload.payload.error)
        }
        setIsLoading(false)
        supabase.removeChannel(channel) // Limpa após receber
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Build raw SQL query with aliases to avoid column name shadowing (e.g. multiple 'name' columns)
          // We must also build the JOINs manually if we provide a raw query
          const buildJoinsSql = (joinsList: any[]) => {
            if (!joinsList || joinsList.length === 0) return ''
            return joinsList.map(j => `LEFT JOIN ${j.toTable} ON ${j.table}.${j.on} = ${j.toTable}.${j.toOn}`).join(' ')
          }
          
          const columns = displayFields.map(f => f.sql_expression || f.db_column_name).join(', ')
          const rawQuery = `SELECT ${columns} FROM ${modelName} ${buildJoinsSql(joins)}`

          const payload: any = {
            queryId: queryId,
            table: modelName,
            tableName: modelName,
            action: 'select',
            query: rawQuery,
            sql: rawQuery,
            token: 'test-token',
            joins: joins
          }

          if (currentFilters && Object.keys(currentFilters).length > 0) {
            payload.filters = currentFilters
          }

          // Pequeno delay para garantir que o canal de broadcast esteja "quente"
          setTimeout(() => {
            channel.send({
              type: 'broadcast',
              event: 'sql_query',
              payload
            })
          }, 200)
          
          // Timeout de segurança
          setTimeout(() => {
            setIsLoading(prev => {
              if (prev) {
                console.warn(`[MetaBuilder] Timeout na requisição ${queryId}`)
                setError(t('dashboard.projects.studio.config.saved_error') || 'Timeout')
                return false
              }
              return prev
            })
          }, 10000)
        }
      })
  }

  const handleMove = async (recordId: string, newValue: any) => {
    // 1. Descobrir o valor real da chave primária para enviar ao DB
    const movedItem = data.find(item => String(item._key || item.id || item.ID || item[primaryKeyName]) === recordId)
    if (!movedItem) return
    const actualPrimaryKey = movedItem[primaryKeyName] || movedItem.id || movedItem.ID

    // 2. Otimismo: Atualiza localmente o estado
    const groupFieldDef = displayFields.find(f => f.id === kanbanGroupField) || displayFields.find(f => f.db_column_name === 'status') || { db_column_name: 'status' }
    const groupFieldName = groupFieldDef.db_column_name
    
    setData(prev => prev.map(item => {
      const itemId = String(item._key || item.id || item.ID || item[primaryKeyName])
      if (itemId === recordId) {
        return { ...item, [groupFieldName]: newValue }
      }
      return item
    }))

    // 3. Dispara o Update via Tunnel
    const queryId = crypto.randomUUID()
    const channelName = `tunnel:${projectId}`
    const channel = supabase.channel(channelName)

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const rawQuery = `UPDATE ${modelName} SET ${groupFieldName} = '${String(newValue).replace(/'/g, "''")}' WHERE ${primaryKeyName} = '${String(actualPrimaryKey).replace(/'/g, "''")}'`
        
        const payload: any = {
          queryId,
          table: modelName,
          tableName: modelName,
          action: 'update',
          data: { [groupFieldName]: newValue },
          query: rawQuery,
          sql: rawQuery,
          idColumn: primaryKeyName,
          idValue: actualPrimaryKey,
          token: 'test-token'
        }

        channel.send({
          type: 'broadcast',
          event: 'sql_query',
          payload
        })
        
        // Limpa canal após um tempo
        setTimeout(() => supabase.removeChannel(channel), 2000)
      }
    })
  }

  useEffect(() => {
    // Só faz o fetch inicial se não houver cache para esta tabela
    const cacheKey = `${projectId}:${modelName}`
    const cached = getCachedData(cacheKey)
    if (!cached) {
      fetchData()
    } else {
      setIsLoading(false)
    }
  }, [projectId, modelName])

  const handleSearch = () => {
    fetchData(filterValues, true) // Busca sempre força o refresh
  }

  const handleClear = () => {
    setFilterValues({})
    fetchData({}, true) // Limpar força o refresh
  }

  const { t } = useI18n()

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

  // Lógica de Paginação Local
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleSort = (columnName: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === columnName && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key: columnName, direction })
  }

  return (
    <div className="space-y-6">
      {/* Toolbar - Minimalist, only showing view toggles if both are available */}
      {displayType === 'both' && (
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-6">
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
        </div>
      )}

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
                        fontSize: zoneConfig.label?.size,
                        color: zoneConfig.label?.color,
                      }}
                      className={cn(
                        "text-[10px] font-black tracking-widest ml-1",
                        !zoneConfig.label?.color && "text-neutral-400",
                        !zoneConfig.label?.font && "uppercase" // Mantém uppercase apenas se for o padrão do sistema
                      )}
                    >
                      {zoneConfig.label?.text || field.display_name}
                    </label>
                    <div className="relative group">
                      {(() => {
                        const comp = zoneConfig.component || { type: 'text' }
                        const fieldType = comp.type || 'text'
                      const options = comp.options_type === 'relational' 
                        ? (relationalOptions[field.id] || [])
                        : parseFixedOptions(comp.fixed_options)
                      
                      const commonClasses = cn(
                        "w-full py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm outline-none focus:border-indigo-500 transition-all shadow-sm",
                        !field.config?.content?.color && "text-neutral-900 dark:text-neutral-300",
                        fieldType === 'select' ? "px-4" : "pl-9 pr-4"
                      )

                      const style = {
                        fontFamily: field.config?.content?.font,
                        fontSize: field.config?.content?.size,
                        color: field.config?.content?.color,
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
                  className="h-[42px] px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  {t('runtime.search')}
                </button>
              )}

              {canClear && (
                <button 
                  onClick={handleClear}
                  className="h-[42px] px-6 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  {t('runtime.clear')}
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
                      className="px-6 py-4 text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em] whitespace-nowrap cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors group/th"
                    >
                      <div className="flex items-center gap-2">
                        {field.display_name}
                        {field.is_primary_key && <span className="text-indigo-500" title={t('runtime.primary_key')}>🔑</span>}
                        <div className="opacity-0 group-hover/th:opacity-100 transition-opacity">
                          {sortConfig?.key === field.db_column_name ? (
                            sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-30 bg-neutral-100 dark:bg-neutral-900 px-4 py-4 text-right text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em] border-l border-neutral-200/50 dark:border-neutral-700/50 shadow-[-4px_0_10px_rgba(0,0,0,0.03)]">
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
      ) : (
        <div className="space-y-6">
          <DynamicCardList 
            fields={displayFields.filter(f => !f.hidden)}
            data={paginatedData}
            buttonsConfig={buttonsConfig}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
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
            <div className="bg-white dark:bg-neutral-900 px-6 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
              {t('runtime.page')} <span className="text-indigo-600">{currentPage}</span> {t('runtime.of')} {totalPages || 1}
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
    </div>
  )
}
