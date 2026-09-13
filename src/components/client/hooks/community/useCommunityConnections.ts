import { useState, useEffect } from 'react'
import { getConnections, getDiscoverySuggestions, sendConnectionRequest, acceptConnection, rejectOrRemoveConnection, getUnreadMessageCounts } from '@/app/actions/community'
import { useToast } from '@/components/ui/Toast'

export function useCommunityConnections(supabase: any, isSimulator: boolean, currentUser: any) {
  const [connections, setConnections] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoadingConnections, setIsLoadingConnections] = useState(true)
  const [isProcessingConnection, setIsProcessingConnection] = useState<Record<string, boolean>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const { toast } = useToast()

  const fetchConnectionsData = async (silent = false) => {
    if (!silent) setIsLoadingConnections(true)
    try {
      const [connResult, suggResult, unreadResult] = await Promise.all([
        getConnections(),
        getDiscoverySuggestions(),
        getUnreadMessageCounts()
      ])
      
      if (connResult.success && connResult.connections) {
        setConnections(connResult.connections)
      }
      if (suggResult.success && suggResult.suggestions) {
        setSuggestions(suggResult.suggestions)
      }
      if (unreadResult && unreadResult.success && unreadResult.counts) {
        setUnreadCounts(unreadResult.counts)
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

    const chatChannel = supabase
      .channel('community_global_chat_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_chat_messages' }, (payload: any) => {
        if (currentUser && payload.new.sender_id !== currentUser.id) {
          setUnreadCounts(prev => ({
            ...prev,
            [payload.new.sender_id]: (prev[payload.new.sender_id] || 0) + 1
          }))
          
          // Toast notification
          const senderConn = connections.find(c => c.user.id === payload.new.sender_id)
          const senderName = senderConn ? senderConn.user.name : 'Alguém'
          toast(`🔔 Nova mensagem de ${senderName}!`, 'info')
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(connectionsChannel)
      supabase.removeChannel(chatChannel)
    }
  }, [isSimulator, supabase, currentUser, connections])

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
    unreadCounts,
    setUnreadCounts,
    fetchConnectionsData,
    handleConnectionAction
  }
}
