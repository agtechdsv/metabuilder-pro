import { useState, useEffect, useCallback } from 'react'
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
  const handleMove = useCallback(async (recordId: string, newValue: any) => {}, [])

  const fetchData = useCallback(async (filters?: any, forceRefresh?: boolean, append?: boolean) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('page', String(currentPage || 1))
      if (itemsPerPage) params.append('limit', String(itemsPerPage))
      
      if (filterValues) {
        for (const [key, val] of Object.entries(filterValues)) {
          if (val !== undefined && val !== '') {
             params.append(`filter_${key}`, String(val))
          }
        }
      }

      const res = await fetch(`/api/${modelName}?${params.toString()}`)
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Erro ao buscar dados')
      }

      const json = await res.json()
      setData(json.data || [])
      setTotalServerRows(json.count || 0)
    } catch (err: any) {
      setError(err.message)
      toast(err.message, 'error')
    } finally {
      setIsLoading(false)
      setIsFetchingBackground(false)
    }
  }, [modelName, filterValues, currentPage, itemsPerPage, refreshKey])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
