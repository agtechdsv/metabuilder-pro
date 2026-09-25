import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getModelSchemaName } from '@/components/runtime/utils/schemaHelper'

export function useViewFilters({
  projectId,
  modelName,
  project,
  tunnelChannel,
  isTunnelReady,
  filterFields,
  displayFields,
  formFields = [],
  externalFilters,
  onFiltersChange,
  refreshTrigger,
  initialItemsPerPage,
  viewMode
}: {
  projectId: string
  modelName: string
  project: any
  tunnelChannel: any
  isTunnelReady: boolean
  filterFields: any[]
  displayFields: any[]
  formFields?: any[]
  externalFilters: Record<string, string>
  onFiltersChange?: (filters: Record<string, string>) => void
  refreshTrigger: number
  initialItemsPerPage?: number
  viewMode: string
}) {
  const [searchQuery, setSearchQuery] = useState('')

  const computeDynamicDate = (num: number, unit: string) => {
    const d = new Date()
    if (unit === 'hours') d.setHours(d.getHours() - num)
    if (unit === 'days') d.setDate(d.getDate() - num)
    if (unit === 'weeks') d.setDate(d.getDate() - (num * 7))
    if (unit === 'months') d.setMonth(d.getMonth() - num)
    if (unit === 'years') d.setFullYear(d.getFullYear() - num)
    return d.toISOString().split('T')[0]
  }

  const [internalFilters, setInternalFilters] = useState<Record<string, any>>(() => {
    const defaults: Record<string, any> = {}
    if (filterFields && filterFields.length > 0) {
      filterFields.forEach((f: any) => {
        const zc = f.config?.filter_config || f.config || {}
        const op = zc.content?.filter_operator || 'ilike'

        if (zc.content?.default_value_type === 'relative') {
          const num = parseInt(zc.content.default_value_relative_number || '1', 10)
          const unit = zc.content.default_value_relative_unit || 'days'
          const computedDate = computeDynamicDate(num, unit)

          if (op === 'between') {
            defaults[`${f.db_column_name}_start`] = computedDate
            defaults[`${f.db_column_name}_end`] = new Date().toISOString().split('T')[0]
          } else {
            defaults[f.db_column_name] = computedDate
          }
        } else if (op === 'between') {
          if (zc.content?.default_value_start) defaults[`${f.db_column_name}_start`] = zc.content.default_value_start
          if (zc.content?.default_value_end) defaults[`${f.db_column_name}_end`] = zc.content.default_value_end
        } else {
          if (zc.content?.default_value) defaults[f.db_column_name] = zc.content.default_value
        }
      })
    }

    // Preenche com os parâmetros vindos da URL (query string)
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      searchParams.forEach((value, key) => {
        if (!['embedded', 'preview', 'return_to', 'edit_id', 'standalone', 'mode'].includes(key)) {
          defaults[key] = value
        }
      })
    }

    return defaults
  })

  const filterValues = { ...(externalFilters || {}), ...internalFilters }

  const setFilterValues = (newVal: any) => {
    const updated = typeof newVal === 'function' ? newVal(filterValues) : newVal
    setInternalFilters(updated)
    onFiltersChange?.(updated)
  }

  const [relationalOptions, setRelationalOptions] = useState<Record<string, any[]>>({})

  // Busca opções relacionais
  useEffect(() => {
    const fetchAllRelational = async () => {
      const supabaseClient = createClient()
      const newOptions: Record<string, any[]> = {}

      // Mescla displayFields e filterFields garantindo que configurações de filtro ricas
      // (como enums e dropdowns) NUNCA sejam sobrescritas por campos brutos ou dummies da zona grid/kanban
      const fieldsMap = new Map<string, any>()
      const allFields = [...(displayFields || []), ...(filterFields || []), ...(formFields || [])]
      for (const f of allFields) {
        if (!f || !f.id) continue
        const existing = fieldsMap.get(f.id)
        if (!existing) {
          fieldsMap.set(f.id, f)
        } else {
          const existingComp = existing.config?.filter_config?.component || existing.config?.grid_config?.component || existing.config?.form_config?.component || existing.config?.component
          const newComp = f.config?.filter_config?.component || f.config?.grid_config?.component || f.config?.form_config?.component || f.config?.component
          fieldsMap.set(f.id, {
            ...existing,
            ...f,
            config: {
              ...(existing.config || {}),
              ...(f.config || {}),
              ...(Object.keys(f.config || {}).length === 0 ? existing.config : {}),
              component: newComp || existingComp
            }
          })
        }
      }
      const uniqueFields = Array.from(fieldsMap.values())

      for (const field of uniqueFields) {
        // Busca o componente em TODAS as zonas — não para na primeira zona que existir,
        // pois grid_config pode existir sem componente (só com content/label).
        // Ordem de prioridade: filter_config > form_config > grid_config > raiz
        const comp =
          field.config?.filter_config?.component ||
          field.config?.form_config?.component ||
          field.config?.grid_config?.component ||
          field.config?.component ||
          field._injected_rel
        const config = field.config?.filter_config || field.config?.form_config || field.config?.grid_config || field.config
        const isRelationalComp = comp && (['select', 'radio', 'checkbox', 'autocomplete', 'Combo (Select)', 'Autocomplete (Busca Dinâmica)', 'Seleção (Dropdown)'].includes(comp.type) || comp.options_type === 'relational' || comp.options_type === 'enumeration')
        
        if (isRelationalComp && comp.options_type === 'relational' && comp.rel_table) {
          try {
            let data: any[] = []
            const isEjectedApp = process.env.NEXT_PUBLIC_IS_EJECTED_APP === 'true'

            if (isEjectedApp) {
              const res = await fetch(`/api/${comp.rel_table}?limit=1000`)
              const json = await res.json()
              if (json.data) data = json.data
            } else if (tunnelChannel || isTunnelReady || projectId) {
              const queryId = crypto.randomUUID()
              const dbType = (project?.db_type || 'postgres').toLowerCase()
              const isOracle = dbType === 'oracle'
              const relLabel = isOracle ? comp.rel_label.toUpperCase() : comp.rel_label
              const relVal = isOracle ? comp.rel_value.toUpperCase() : comp.rel_value
              const filterCol = comp.filter_column ? (isOracle ? comp.filter_column.toUpperCase() : comp.filter_column) : null
              const colsToSelect = Array.from(new Set([`"${relLabel}"`, `"${relVal}"`, filterCol ? `"${filterCol}"` : null].filter(Boolean))).join(', ')
              const relTable = isOracle ? `"${comp.rel_table.toUpperCase()}"` : `"${comp.rel_table}"`
              const rawQuery = `SELECT ${colsToSelect} FROM ${relTable}`
              const schemaToUse = getModelSchemaName(project, comp.rel_table)

              const isTemp = !tunnelChannel || !isTunnelReady
              const channel = isTemp ? supabaseClient.channel(`tunnel:${projectId}`) : tunnelChannel

              data = await new Promise<any[]>((resolve, reject) => {
                let resolved = false
                const cleanup = () => {
                  try {
                    const bindings = channel.bindings?.broadcast
                    if (Array.isArray(bindings)) {
                      channel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
                    }
                    if (isTemp) {
                      channel.unsubscribe()
                      supabaseClient.removeChannel(channel)
                    }
                  } catch (e) { }
                }

                const handleResult = (payload: any) => {
                  if (payload.payload?.queryId === queryId) {
                    resolved = true
                    cleanup()
                    if (payload.payload.success) resolve(payload.payload.data || [])
                    else reject(new Error(payload.payload.error || 'Error fetching relational options'))
                  }
                }

                channel.on('broadcast', { event: `query_result_${queryId}` }, handleResult)
                channel.on('broadcast', { event: 'sql_result' }, handleResult)

                const sendPayload = {
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
                }

                if (isTemp) {
                  channel.subscribe((status: string) => {
                    if (status === 'SUBSCRIBED') {
                      channel.send(sendPayload)
                    }
                  })
                } else {
                  channel.send(sendPayload)
                }

                setTimeout(() => {
                  if (!resolved) {
                    resolved = true
                    cleanup()
                    resolve([])
                  }
                }, 8000)
              })
            } else {
              const filterCol = comp.filter_column ? `, ${comp.filter_column}` : ''
              const { data: directData } = await supabaseClient
                .from(comp.rel_table)
                .select(`${comp.rel_label}, ${comp.rel_value}${filterCol}`)
              if (directData) data = directData
            }

            if (data && data.length > 0) {
              const mappedOpts = data.map((item: any) => {
                const getVal = (key: string) => {
                  if (!key) return undefined
                  const searchKey = key.includes('.') ? key.split('.').pop()! : key
                  const foundKey = Object.keys(item).find(k => k.toLowerCase() === searchKey.toLowerCase())
                  return foundKey ? item[foundKey] : undefined
                }
                return {
                  label: getVal(comp.rel_label) || item.display_label || Object.values(item)[1] || Object.values(item)[0],
                  value: getVal(comp.rel_value) || item.id || item.ID || Object.values(item)[0],
                  filter_value: comp.filter_column ? getVal(comp.filter_column) : undefined,
                  ...item
                }
              })

              newOptions[field.id] = mappedOpts
              if (field.db_column_name) {
                newOptions[field.db_column_name] = mappedOpts
                const cleanCol = field.db_column_name.includes('.') ? field.db_column_name.split('.').pop() : field.db_column_name
                if (cleanCol) {
                  newOptions[cleanCol] = mappedOpts
                }
              }
            }
          } catch (err) {
            console.error(`Error fetching relational options for field ${field.id}:`, err)
          }
        } else if (isRelationalComp && comp.options_type === 'enumeration' && comp.rel_table) {
          try {
            const res = await fetch(`/api/enumerations?id=${encodeURIComponent(comp.rel_table)}`)
            if (res.ok) {
              const result = await res.json()
              if (result.data && result.data.values) {
                const formatted = result.data.values.map((v: any) => {
                  if (typeof v === 'string') return { label: v, value: v }
                  return {
                    label: v.description || v.label || v.value || '',
                    value: v.value !== undefined ? v.value : (v.description || '')
                  }
                })
                newOptions[field.id] = formatted
                if (field.db_column_name) {
                  newOptions[field.db_column_name] = formatted
                }
              }
            }
          } catch (err) {
            console.error(`Error fetching enum options for field ${field.id}:`, err)
          }
        }
      }
      setRelationalOptions(newOptions)
    }

    if ((filterFields && filterFields.length > 0) || (displayFields && displayFields.length > 0)) {
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

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage || (viewMode === 'list' ? 15 : 10))
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)

  useEffect(() => {
    if (initialItemsPerPage) {
      setItemsPerPage(initialItemsPerPage)
    } else {
      setItemsPerPage(viewMode === 'list' ? 15 : 10)
    }
    setCurrentPage(1)
  }, [viewMode, initialItemsPerPage])

  const handleSort = (columnName: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === columnName && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key: columnName, direction })
  }

  const handleClear = (fetchDataCallback: (filters: any, forceRefresh: boolean) => void) => {
    const defaults: Record<string, any> = {}
    if (filterFields && filterFields.length > 0) {
      filterFields.forEach((f: any) => {
        const zc = f.config?.filter_config || f.config || {}
        const op = zc.content?.filter_operator || 'ilike'

        if (zc.content?.default_value_type === 'relative') {
          const num = parseInt(zc.content.default_value_relative_number || '1', 10)
          const unit = zc.content.default_value_relative_unit || 'days'
          const computedDate = computeDynamicDate(num, unit)

          if (op === 'between') {
            defaults[`${f.db_column_name}_start`] = computedDate
            defaults[`${f.db_column_name}_end`] = new Date().toISOString().split('T')[0]
          } else {
            defaults[f.db_column_name] = computedDate
          }
        } else if (op === 'between') {
          if (zc.content?.default_value_start) defaults[`${f.db_column_name}_start`] = zc.content.default_value_start
          if (zc.content?.default_value_end) defaults[`${f.db_column_name}_end`] = zc.content.default_value_end
        } else {
          if (zc.content?.default_value) defaults[f.db_column_name] = zc.content.default_value
        }
      })
    }
    setFilterValues(defaults)
    fetchDataCallback({ ...(externalFilters || {}), ...defaults }, true)
  }

  return {
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
  }
}
