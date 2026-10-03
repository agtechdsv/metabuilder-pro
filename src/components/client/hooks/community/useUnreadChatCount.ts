import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { getUnreadChatCount } from '@/app/actions/community'

/** Total de mensagens do MetaBuilders não lidas; atualiza sozinho quando chega ou é lida uma mensagem */
export function useUnreadChatCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    const refresh = async () => {
      const r = await getUnreadChatCount()
      if (!cancelled && r.success) setCount(r.count)
    }
    refresh()
    const channel = supabase
      .channel(`unread_chat_count_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_chat_messages' }, refresh)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return count
}
