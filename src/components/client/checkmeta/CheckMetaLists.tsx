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

  // 1. Fetch current user and profile
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
        setCurrentUser({
          id: user.id,
          full_name: profile?.full_name || 'Desconhecido'
        })
      }
    })
  }, [])

  // 2. Presence setup for lounge:checkmeta
  useEffect(() => {
    let isCancelled = false

    // Clean up any existing channel with the same topic before subscribing
    const existing = supabase.getChannels().find((c: any) => c.topic === 'realtime:lounge:checkmeta')
    if (existing) {
      supabase.removeChannel(existing)
    }

    const channel = supabase.channel('lounge:checkmeta')

    channel
      .on('presence', { event: 'sync' }, () => {
        if (isCancelled) return
        const state = channel.presenceState()
        const users = Object.values(state).map((presence: any) => presence[0])
        setOnlineUsers(users)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED' && !isCancelled && currentUser) {
          await channel.track({
            user_id: currentUser.id,
            full_name: currentUser.full_name,
            status: 'available',
            online_at: new Date().toISOString()
          })
        }
      })

    return () => {
      isCancelled = true
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id])

  // 3. Direct challenges listener
  useEffect(() => {
    if (!currentUser?.id) return

    const challengesSub = supabase
      .channel(`challenges_${currentUser.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkmeta_challenges', filter: `challenged_id=eq.${currentUser.id}` }, async (payload) => {
        const { data: challenger } = await supabase.from('profiles').select('full_name').eq('id', payload.new.challenger_id).single()
        const accepted = window.confirm(`${challenger?.full_name || 'Alguém'} desafiou você para uma partida! Aceitar?`)
        if (accepted) {
          const { data: match, error } = await supabase.from('checkmeta_matches').insert({
            player_white_id: payload.new.challenger_id,
            player_black_id: currentUser.id,
            status: 'playing'
          }).select().single()
          
          if (!error && match) {
            await supabase.from('checkmeta_challenges').update({ status: 'accepted', match_id: match.id }).eq('id', payload.new.id)
            toast('Partida iniciada!', 'success')
            navigateToMatch(match.id)
          }
        } else {
          await supabase.from('checkmeta_challenges').update({ status: 'declined' }).eq('id', payload.new.id)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkmeta_challenges', filter: `challenger_id=eq.${currentUser.id}` }, (payload) => {
        if (payload.new.status === 'accepted' && payload.new.match_id) {
          toast('Desafio aceito! A partida vai começar.', 'success')
          navigateToMatch(payload.new.match_id)
        } else if (payload.new.status === 'declined') {
          toast(`O desafio foi recusado.`, 'info')
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(challengesSub)
    }
  }, [currentUser?.id])

  // 4. Matches loader and realtime listener
  useEffect(() => {
    let isCancelled = false

    const fetchMatches = async () => {
      try {
        const { data: matchesData, error } = await supabase
          .from('checkmeta_matches')
          .select('id, status, player_white_id, player_black_id, created_at, time_control_minutes, time_control_increment')
          .eq('status', 'playing')
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error("Error fetching matches:", error)
          return
        }

        if (isCancelled) return

        if (!matchesData || matchesData.length === 0) {
          setMatches([])
          return
        }

        const userIds = Array.from(new Set(
          matchesData.flatMap((m: any) => [m.player_white_id, m.player_black_id]).filter(Boolean)
        ))

        let profilesMap: Record<string, string> = {}
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)
          
          if (profilesData) {
            profilesData.forEach((p: any) => {
              profilesMap[p.id] = p.full_name || 'Jogador'
            })
          }
        }

        if (isCancelled) return

        const enriched = matchesData.map((m: any) => ({
          ...m,
          player_white: { full_name: profilesMap[m.player_white_id] || 'Brancas' },
          player_black: { full_name: profilesMap[m.player_black_id] || 'Pretas' }
        }))

        setMatches(enriched)
      } catch (err) {
        console.error("Failed to load matches:", err)
      }
    }

    fetchMatches()

    const matchesSubscription = supabase
      .channel('public:checkmeta_matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkmeta_matches' }, () => {
        fetchMatches()
      })
      .subscribe()

    const pollInterval = setInterval(fetchMatches, 4000)

    return () => {
      isCancelled = true
      clearInterval(pollInterval)
      supabase.removeChannel(matchesSubscription)
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
          {onlineUsers.filter(u => 
            u.status === 'available' && 
            u.user_id !== currentUser?.id &&
            !matches.some((m: any) => m.player_white_id === u.user_id || m.player_black_id === u.user_id)
          ).length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">Nenhum usuário disponível agora.</p>
          ) : (
            onlineUsers
              .filter(u => 
                u.status === 'available' && 
                u.user_id !== currentUser?.id &&
                !matches.some((m: any) => m.player_white_id === u.user_id || m.player_black_id === u.user_id)
              )
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
                  onClick={async () => {
                    toast(`Desafio enviado para ${u.full_name}`, 'info')
                    await supabase.from('checkmeta_challenges').insert({
                      challenger_id: currentUser?.id,
                      challenged_id: u.user_id
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
                <button 
                  onClick={() => navigateToMatch(m.id)}
                  className="p-2 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500 hover:text-white rounded-lg transition-all" 
                  title="Assistir"
                >
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
