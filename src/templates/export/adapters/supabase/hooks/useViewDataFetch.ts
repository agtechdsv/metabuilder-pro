import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useToast } from '@/components/ui/Toast'

export function useViewDataFetch({
  modelName,
  primaryKeyName,
  joins,
  displayFields,
  filterValues,
  currentPage,
  itemsPerPage,
  refreshKey // Assuming ViewPageContent passes this to force refresh
}: any) {
  const { toast } = useToast()
  const supabase = createClient()
  
  const [data, setData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingBackground, setIsFetchingBackground] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalServerRows, setTotalServerRows] = useState<number>(0)
  const [hasFetchedInitial, setHasFetchedInitial] = useState(false)
  const hasFetchedRef = useRef(false)
  const handleMove = useCallback(async (recordId: string, newValue: any) => {}, [])

  const fetchData = useCallback(async (filters?: any, forceRefresh?: boolean, append?: boolean) => {
    if (hasFetchedRef.current && !forceRefresh && !append) {
      setIsFetchingBackground(true)
    } else if (hasFetchedRef.current && forceRefresh) {
      setIsFetchingBackground(true)
    } else {
      setIsLoading(true)
    }
    setError(null)
    try {
      let query = supabase.from(modelName).select('*', { count: 'exact' })
      
      if (filterValues) {
        for (const [key, val] of Object.entries(filterValues)) {
          if (val !== undefined && val !== '') {
             query = query.eq(key, val)
          }
        }
      }

      if (itemsPerPage) {
        const from = (currentPage - 1) * itemsPerPage
        const to = from + itemsPerPage - 1
        query = query.range(from, to)
      }

      const { data: resultData, count, error: fetchError } = await query
      
      if (fetchError) throw fetchError

      setData(resultData || [])
      setTotalServerRows(count || 0)
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
