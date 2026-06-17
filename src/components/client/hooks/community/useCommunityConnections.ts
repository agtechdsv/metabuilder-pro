import { useState, useEffect } from 'react'
import { getConnections, getDiscoverySuggestions, sendConnectionRequest, acceptConnection, rejectOrRemoveConnection } from '@/app/actions/community'

export function useCommunityConnections(supabase: any, isSimulator: boolean) {
  const [connections, setConnections] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoadingConnections, setIsLoadingConnections] = useState(true)
  const [isProcessingConnection, setIsProcessingConnection] = useState<Record<string, boolean>>({})

  const fetchConnectionsData = async (silent = false) => {
    if (!silent) setIsLoadingConnections(true)
    try {
      const [connResult, suggResult] = await Promise.all([
        getConnections(),
        getDiscoverySuggestions()
      ])
      
      if (connResult.success && connResult.connections) {
        setConnections(connResult.connections)
      }
      if (suggResult.success && suggResult.suggestions) {
        setSuggestions(suggResult.suggestions)
      }
    } catch (err) {
      console.error("COMMUNITY_DEBUG [fetchConnectionsData exception]:", err)
    }
    setIsLoadingConnections(false)
  }

  useEffect(() => {
    fetchConnectionsData()
  }, [])

  useEffect(() => {
    if (isSimulator) return

    const connectionsChannel = supabase
      .channel('community_connections_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_connections' }, () => {
        fetchConnectionsData(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(connectionsChannel)
    }
  }, [isSimulator, supabase])

  const handleConnectionAction = async (action: 'send' | 'accept' | 'reject' | 'remove', id: string) => {
    setIsProcessingConnection(prev => ({ ...prev, [id]: true }))

    if (isSimulator) {
      setTimeout(() => {
        if (action === 'send') {
          const suggUser = suggestions.find(s => s.id === id)
          if (suggUser) {
            setSuggestions(prev => prev.filter(s => s.id !== id))
            setConnections(prev => [...prev, {
              id: `mock-conn-${Date.now()}`,
              status: 'PENDING',
              isRequester: true,
              user: {
                id: suggUser.id,
                name: suggUser.name,
                avatar: suggUser.avatar,
                role: suggUser.role
              }
            }])
          }
        } else if (action === 'accept') {
          setConnections(prev => prev.map(c => {
            if (c.id === id) return { ...c, status: 'ACCEPTED' }
            return c
          }))
        } else {
          setConnections(prev => prev.filter(c => c.id !== id))
        }
        setIsProcessingConnection(prev => ({ ...prev, [id]: false }))
      }, 500)
      return
    }
    
    let result: { success: boolean, error?: string }
    if (action === 'send') {
      result = await sendConnectionRequest(id)
    } else if (action === 'accept') {
      result = await acceptConnection(id)
    } else {
      result = await rejectOrRemoveConnection(id)
    }

    if (result.success) {
      await fetchConnectionsData(true)
    } else {
      alert('Erro ao processar conexão: ' + result.error)
    }

    setIsProcessingConnection(prev => ({ ...prev, [id]: false }))
  }

  return {
    connections, setConnections,
    suggestions, setSuggestions,
    isLoadingConnections,
    isProcessingConnection,
    fetchConnectionsData,
    handleConnectionAction
  }
}
