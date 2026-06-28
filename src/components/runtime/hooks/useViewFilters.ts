import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export function useViewFilters({
  projectId,
  modelName,
  project,
  tunnelChannel,
  isTunnelReady,
  filterFields,
  displayFields,
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
        if (!['embedded', 'preview', 'return_to', 'edit_id'].includes(key)) {
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

      const allFieldsWithRelational = [...(filterFields || []), ...(displayFields || [])]
      const uniqueFields = Array.from(new Map(allFieldsWithRelational.map(f => [f.id, f])).values())

      for (const field of uniqueFields) {
        const config = field.config?.filter_config || field.config?.grid_config || field.config
        const comp = config?.component
        const isRelationalComp = comp?.type && (['select', 'radio', 'checkbox', 'Combo (Select)'].includes(comp.type) || comp.options_type === 'relational' || comp.options_type === 'enumeration')
        
        if (isRelationalComp && comp.options_type === 'relational' && comp.rel_table) {
          try {
            let data: any[] = []
            if (projectId) {
              if (!tunnelChannel || !isTunnelReady) continue;
              const queryId = crypto.randomUUID()
              const filterCol = comp.filter_column ? `, "${comp.filter_column}"` : ''
              const rawQuery = `SELECT "${comp.rel_label}", "${comp.rel_value}"${filterCol} FROM "${comp.rel_table}"`
              const schemaToUse = project?.models?.find((m: any) => m.db_table_name?.toLowerCase() === comp.rel_table?.toLowerCase())?.db_schema_name || project?.slug || 'public'

              data = await new Promise<any[]>((resolve, reject) => {
                let resolved = false
                const cleanup = () => {
                  try {
                    if (tunnelChannel.removeListener) {
                      tunnelChannel.removeListener(`query_result_${queryId}`, handleResult)
                      tunnelChannel.removeListener('sql_result', handleResult)
                    }
                    const bindings = tunnelChannel.bindings?.broadcast
                    if (Array.isArray(bindings)) {
                      tunnelChannel.bindings.broadcast = bindings.filter((b: any) => b.callback !== handleResult)
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

            if (data) {
              newOptions[field.id] = data.map((item: any) => ({
                label: item[comp.rel_label] || item[comp.rel_label?.toLowerCase()] || item[comp.rel_label?.toUpperCase()],
                value: item[comp.rel_value] || item[comp.rel_value?.toLowerCase()] || item[comp.rel_value?.toUpperCase()],
                filter_value: comp.filter_column ? (item[comp.filter_column] || item[comp.filter_column?.toLowerCase()] || item[comp.filter_column?.toUpperCase()]) : undefined
              }))
            }
          } catch (err) {
            console.error(`Error fetching relational options for field ${field.id}:`, err)
          }
        } else if (isRelationalComp && comp.options_type === 'enumeration' && comp.rel_table) {
          try {
            const res = await fetch(`/api/enumerations?id=${comp.rel_table}`)
            if (res.ok) {
              const result = await res.json()
              if (result.data && result.data.values) {
                newOptions[field.id] = result.data.values.map((v: any) => ({
                  label: v.description || v.value,
                  value: v.value
                }))
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
