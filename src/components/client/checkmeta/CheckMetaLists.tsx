import React, { useEffect, useState } from 'react'
import { Eye, Users, Search, Play, Swords } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function CheckMetaLists() {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const supabase = createClient()
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigateToMatch = (matchId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('matchId', matchId)
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    // Supabase Presence setup for lounge:checkmeta
    const channel = supabase.channel('lounge:checkmeta')
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        // Map presence state to online users array
        const users = Object.values(state).map((presence: any) => presence[0])
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track current user
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
            const u = {
              id: user.id,
              full_name: profile?.full_name || 'Desconhecido'
            }
            setCurrentUser(u)
            await channel.track({
              user_id: u.id,
              full_name: u.full_name,
              status: 'available',
              online_at: new Date().toISOString()
            })
          }
        }
      })
      .on('broadcast', { event: 'challenge' }, async (payload) => {
        if (currentUser && payload.payload.to === currentUser.id) {
          const accepted = window.confirm(`${payload.payload.fromName} desafiou você para uma partida! Aceitar?`)
          if (accepted) {
            // Create match
            const { data: match, error } = await supabase
              .from('checkmeta_matches')
              .insert({
                player_white_id: payload.payload.from,
                player_black_id: currentUser.id,
                status: 'playing'
              })
              .select()
              .single()
            
            if (!error && match) {
              toast('Partida iniciada!', 'success')
              // Notify challenger that match started
              channel.send({
                type: 'broadcast',
                event: 'challenge_accepted',
                payload: { to: payload.payload.from, matchId: match.id }
              })
              navigateToMatch(match.id)
            }
          } else {
            channel.send({
              type: 'broadcast',
              event: 'challenge_rejected',
              payload: { to: payload.payload.from, fromName: currentUser.full_name }
            })
          }
        }
      })
      .on('broadcast', { event: 'challenge_accepted' }, (payload) => {
        if (currentUser && payload.payload.to === currentUser.id) {
          toast('Desafio aceito! A partida vai começar.', 'success')
          navigateToMatch(payload.payload.matchId)
        }
      })
      .on('broadcast', { event: 'challenge_rejected' }, (payload) => {
        if (currentUser && payload.payload.to === currentUser.id) {
          toast(`${payload.payload.fromName} recusou o desafio.`, 'info')
        }
      })

    // Fetch Matches
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('checkmeta_matches')
        .select(`
          id,
          status,
          player_white:profiles!checkmeta_matches_player_white_id_fkey(full_name),
          player_black:profiles!checkmeta_matches_player_black_id_fkey(full_name)
        `)
        .eq('status', 'playing')
        .order('created_at', { ascending: false })
      
      if (data) setMatches(data)
    }

    fetchMatches()

    // Realtime subscription for matches
    const matchesSubscription = supabase
      .channel('public:checkmeta_matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkmeta_matches' }, payload => {
        fetchMatches()
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
      matchesSubscription.unsubscribe()
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      
      {/* Online Users Card */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Usuários Online</h3>
          </div>
          <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 rounded-full text-xs font-bold">
            {onlineUsers.length} online
          </span>
        </div>

        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto no-scrollbar">
          {onlineUsers.filter(u => u.status === 'available' && u.user_id !== currentUser?.id).length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">Nenhum usuário disponível agora.</p>
          ) : (
            onlineUsers
              .filter(u => u.status === 'available' && u.user_id !== currentUser?.id)
              .map((u, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase">
                      {u.full_name?.substring(0, 2)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-neutral-900 rounded-full"></div>
                  </div>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{u.full_name}</span>
                </div>
                
                <button 
                  onClick={() => {
                    toast(`Desafio enviado para ${u.full_name}`, 'info')
                    const channel = supabase.channel('lounge:checkmeta')
                    channel.send({
                      type: 'broadcast',
                      event: 'challenge',
                      payload: { from: currentUser?.id, fromName: currentUser?.full_name, to: u.user_id }
                    })
                  }}
                  className="p-2 text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors"
                  title="Desafiar"
                >
                  <Swords className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Ongoing Matches Card */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Partidas em Andamento</h3>
          </div>
        </div>

        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto no-scrollbar">
          {matches.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">Nenhuma partida no momento.</p>
          ) : (
            matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800/50">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-neutral-500">Ao vivo</span>
                  <div className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <span className="truncate max-w-[80px]">{m.player_white?.full_name?.split(' ')[0] || 'Brancas'}</span>
                    <span className="text-neutral-400 text-xs">vs</span>
                    <span className="truncate max-w-[80px]">{m.player_black?.full_name?.split(' ')[0] || 'Pretas'}</span>
                  </div>
                </div>
                <button className="p-2 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500 hover:text-white rounded-lg transition-all" title="Assistir">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
