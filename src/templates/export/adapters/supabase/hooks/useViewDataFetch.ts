import { useState, useCallback, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'

export function useViewDataFetch({
  modelName,
  primaryKeyName,
  joins,
  displayFields,
  filterValues,
  currentPage,
  itemsPerPage,
  refreshKey
}: any) {
  const { toast } = useToast()

  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingBackground, setIsFetchingBackground] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalServerRows, setTotalServerRows] = useState<number>(0)
  const [hasFetchedInitial, setHasFetchedInitial] = useState(false)
  const hasFetchedRef = useRef(false)
  const handleMove = useCallback(async (_recordId: string, _newValue: any) => {}, [])

  const fetchData = useCallback(async (filters?: any, forceRefresh?: boolean, _append?: boolean) => {
    // First fetch → show full loading; subsequent fetches → silent background refresh
    if (hasFetchedRef.current && forceRefresh) {
      setIsFetchingBackground(true)
    } else if (hasFetchedRef.current) {
      setIsFetchingBackground(true)
    } else {
      setIsLoading(true)
    }
    setError(null)

    try {
      const params = new URLSearchParams()
      params.append('page', String(currentPage || 1))
      if (itemsPerPage) params.append('limit', String(itemsPerPage))

      const activeFilters = filters ?? filterValues
      if (activeFilters) {
        for (const [key, val] of Object.entries(activeFilters)) {
          if (val !== undefined && val !== '') {
            params.append(`filter_${key}`, String(val))
          }
        }
      }

      if (joins && joins.length > 0) {
        params.append('joins', JSON.stringify(joins))
      }

      const res = await fetch(`/api/${modelName}?${params.toString()}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Erro ao buscar dados')
      }

      const json = await res.json()
      setData(json.data || [])
      setTotalServerRows(json.count || 0)
      hasFetchedRef.current = true
      setHasFetchedInitial(true)
    } catch (err: any) {
      setError(err.message)
      toast(err.message, 'error')
    } finally {
      setIsLoading(false)
      setIsFetchingBackground(false)
    }
  }, [modelName, filterValues, currentPage, itemsPerPage, refreshKey])

  return {
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
  }
}
