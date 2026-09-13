import React, { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const TIME_CONTROLS = [
  { min: 1, inc: 0, label: 'Bullet' },
  { min: 2, inc: 1, label: 'Bullet' },
  { min: 3, inc: 0, label: 'Blitz' },
  { min: 3, inc: 2, label: 'Blitz' },
  { min: 5, inc: 0, label: 'Blitz' },
  { min: 5, inc: 3, label: 'Blitz' },
  { min: 10, inc: 0, label: 'Rápida' },
  { min: 10, inc: 5, label: 'Rápida' },
  { min: 15, inc: 10, label: 'Rápida' },
]

export function CheckMetaLobby() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isSearching, setIsSearching] = useState<{ min: number, inc: number } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUser(user)
    })
  }, [supabase])

  useEffect(() => {
    if (!currentUser) return

    const handleMatchFound = (payload: any) => {
      const match = payload.new
      if (match.player_white_id === currentUser.id || match.player_black_id === currentUser.id) {
        // I am in this match!
        const params = new URLSearchParams(searchParams.toString())
        params.set('matchId', match.id)
        router.push(`${pathname}?${params.toString()}`)
      }
    }

    const channelWhite = supabase.channel('matchmaking_white')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkmeta_matches', filter: `player_white_id=eq.${currentUser.id}` }, handleMatchFound)
      .subscribe()

    const channelBlack = supabase.channel('matchmaking_black')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkmeta_matches', filter: `player_black_id=eq.${currentUser.id}` }, handleMatchFound)
      .subscribe()

    return () => {
      supabase.removeChannel(channelWhite)
      supabase.removeChannel(channelBlack)
    }
  }, [currentUser, pathname, router, searchParams, supabase])

  const joinQueue = async (min: number, inc: number) => {
    if (!currentUser) return
    setIsSearching({ min, inc })
    
    const { data: matchId, error } = await supabase.rpc('join_matchmaking_queue', {
      p_minutes: min,
      p_increment: inc
    })

    if (error) {
      console.error("Matchmaking error:", error)
      setIsSearching(null)
      return
    }

    if (matchId) {
      // Instant match
      const params = new URLSearchParams(searchParams.toString())
      params.set('matchId', matchId)
      router.push(`${pathname}?${params.toString()}`)
    } else {
      // Waiting in queue
    }
  }

  const cancelSearch = async () => {
    await supabase.rpc('leave_matchmaking_queue')
    setIsSearching(null)
  }

  // Cleanup queue if unmounts while searching
  useEffect(() => {
    return () => {
      if (isSearching) {
        supabase.rpc('leave_matchmaking_queue')
      }
    }
  }, [isSearching, supabase])

  return (
    <div className="w-full flex flex-col gap-4">
      <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">Partida Rápida (Quick Pairing)</h3>
      
      {isSearching ? (
        <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
          <p className="text-neutral-700 dark:text-neutral-300 font-medium mb-1">
            Procurando oponente...
          </p>
          <p className="text-sm text-neutral-500 mb-6">
            Tempo: {isSearching.min}+{isSearching.inc} • Pareamento Glicko-2
          </p>
          <button 
            onClick={cancelSearch}
            className="px-6 py-2 bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-800 dark:text-white rounded-xl transition-colors font-medium text-sm"
          >
            Cancelar Busca
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {TIME_CONTROLS.map((tc, i) => (
            <button
              key={i}
              onClick={() => joinQueue(tc.min, tc.inc)}
              className="flex flex-col items-center justify-center p-3 bg-neutral-50 hover:bg-indigo-50 dark:bg-neutral-800/50 dark:hover:bg-indigo-900/30 border border-neutral-200 hover:border-indigo-200 dark:border-neutral-800 dark:hover:border-indigo-800 rounded-xl transition-all group"
            >
              <span className="text-lg font-black text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                {tc.min}+{tc.inc}
              </span>
              <span className="text-xs text-neutral-500 font-medium">
                {tc.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
