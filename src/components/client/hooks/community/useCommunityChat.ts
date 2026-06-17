import { useState, useEffect, useRef } from 'react'
import { getOrCreateChatRoom, getChatMessages, sendChatMessage } from '@/app/actions/community'

export function useCommunityChat(supabase: any, isSimulator: boolean, currentUser: any, setActiveSubTab: (tab: any) => void, setActiveConnection: (conn: any) => void) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [newMessageText, setNewMessageText] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeRoomId || isSimulator) return

    const messagesChannel = supabase
      .channel(`room_${activeRoomId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'community_chat_messages',
          filter: `room_id=eq.${activeRoomId}`
        },
        (payload: any) => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [activeRoomId, isSimulator, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleOpenChat = async (connection: any) => {
    setActiveConnection(connection)
    setActiveSubTab('chat')
    setIsLoadingMessages(true)

    if (isSimulator) {
      setTimeout(() => {
        setMessages([{ id: `mock-msg-1-${Date.now()}`, sender_id: connection.user.id, content: 'Olá! Como posso te ajudar com o projeto?', created_at: new Date(Date.now() - 3600000).toISOString() }])
        setActiveRoomId('mock-room-id')
        setIsLoadingMessages(false)
      }, 500)
      return
    }
    
    const roomResult = await getOrCreateChatRoom(connection.user.id)
    if (roomResult.success && roomResult.roomId) {
      setActiveRoomId(roomResult.roomId)
      const msgResult = await getChatMessages(roomResult.roomId)
      if (msgResult.success && msgResult.messages) setMessages(msgResult.messages)
    } else {
      alert('Erro ao abrir conversa.')
    }
    setIsLoadingMessages(false)
  }

  const handleSendMessage = async () => {
    if (!newMessageText.trim() || (!activeRoomId && !isSimulator)) return
    setIsSendingMessage(true)

    const textToSend = newMessageText
    setNewMessageText('')

    if (isSimulator) {
      setTimeout(() => {
        const myMsg = { id: `mock-msg-sent-${Date.now()}`, sender_id: currentUser?.id || 'me', content: textToSend, created_at: new Date().toISOString() }
        setMessages(prev => [...prev, myMsg])
        setIsSendingMessage(false)
      }, 300)
      return
    }

    const result = await sendChatMessage(activeRoomId!, textToSend)
    if (result.success && result.message) {
      setMessages(prev => {
        if (prev.some(m => m.id === result.message.id)) return prev
        return [...prev, result.message]
      })
    } else {
      alert('Erro ao enviar mensagem: ' + result.error)
    }
    setIsSendingMessage(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return {
    activeRoomId, setActiveRoomId,
    messages, setMessages,
    isLoadingMessages,
    newMessageText, setNewMessageText,
    isSendingMessage,
    handleOpenChat,
    handleSendMessage,
    handleKeyPress,
    messagesEndRef
  }
}
