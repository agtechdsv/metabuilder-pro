import React, { useEffect, useState } from 'react'
import { Trophy, Plus, Edit, Trash2, Users, UserMinus, UserPlus } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function CheckMetaTournaments({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [tournaments, setTournaments] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const supabase = createClient()
  const { toast } = useToast()
  
  // Basic mock fetch for layout, replace with real data handling
  const fetchTournaments = async () => {
    const { data: user } = await supabase.auth.getUser()
    setCurrentUser(user?.user)

    const { data, error } = await supabase
      .from('checkmeta_tournaments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setTournaments(data)

    const { data: pData } = await supabase
      .from('checkmeta_tournament_participants')
      .select('*, profiles(full_name)')
    
    if (pData) setParticipants(pData)
    
    setLoading(false)
  }

  useEffect(() => {
    fetchTournaments()

    const tSub = supabase
      .channel('public:checkmeta_tournaments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkmeta_tournaments' }, payload => {
        fetchTournaments()
      })
      .subscribe()
      
    const pSub = supabase
      .channel('public:checkmeta_tournament_participants')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkmeta_tournament_participants' }, payload => {
        fetchTournaments()
      })
      .subscribe()

    return () => {
      tSub.unsubscribe()
      pSub.unsubscribe()
    }
  }, [])

  const handleJoin = async (tournamentId: string) => {
    if (!currentUser) return
    const { error } = await supabase
      .from('checkmeta_tournament_participants')
      .insert({ tournament_id: tournamentId, user_id: currentUser.id })
    
    if (error) {
      toast('Erro ao inscrever-se', 'error')
    } else {
      toast('Inscrição realizada!', 'success')
    }
  }

  const handleLeave = async (tournamentId: string) => {
    if (!currentUser) return
    const { error } = await supabase
      .from('checkmeta_tournament_participants')
      .delete()
      .match({ tournament_id: tournamentId, user_id: currentUser.id })
    
    if (error) {
      toast('Erro ao cancelar inscrição', 'error')
    } else {
      toast('Inscrição cancelada', 'success')
    }
  }

  const handleRemoveParticipant = async (tournamentId: string, userId: string) => {
    const { error } = await supabase
      .from('checkmeta_tournament_participants')
      .delete()
      .match({ tournament_id: tournamentId, user_id: userId })
    
    if (error) {
      toast('Erro ao remover participante', 'error')
    } else {
      toast('Participante removido', 'success')
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Torneios Oficiais</h3>
        </div>
        {isSuperAdmin && (
          <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" />
            Criar Torneio
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto no-scrollbar">
        {loading ? (
          <p className="text-sm text-neutral-500 text-center py-4">Carregando torneios...</p>
        ) : tournaments.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-4">Nenhum torneio agendado.</p>
        ) : (
          tournaments.map((t) => {
            const tParticipants = participants.filter(p => p.tournament_id === t.id)
            const isJoined = tParticipants.some(p => p.user_id === currentUser?.id)

            return (
              <div key={t.id} className="flex flex-col p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800/50 gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-neutral-900 dark:text-white">{t.name}</h4>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{t.description}</p>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs font-medium bg-neutral-200 dark:bg-neutral-700 px-2 py-1 rounded-md text-neutral-700 dark:text-neutral-300">
                        {t.status === 'open' ? 'Inscrições Abertas' : t.status === 'ongoing' ? 'Em andamento' : 'Finalizado'}
                      </span>
                      {t.start_date && (
                        <span className="text-xs font-medium text-neutral-500">
                          {format(new Date(t.start_date), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {isSuperAdmin ? (
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-neutral-400 hover:text-indigo-500 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 transition-colors" title="Editar">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-neutral-400 hover:text-rose-500 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 transition-colors" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    t.status === 'open' && (
                      isJoined ? (
                        <button 
                          onClick={() => handleLeave(t.id)}
                          className="px-4 py-2 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                          <UserMinus className="w-4 h-4" />
                          Sair
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleJoin(t.id)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          Inscrever-se
                        </button>
                      )
                    )
                  )}
                </div>

                <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                      Inscritos ({tParticipants.length})
                    </span>
                  </div>
                  
                  {tParticipants.length > 0 ? (
                    <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-2 no-scrollbar">
                      {tParticipants.map(p => (
                        <div key={p.id} className="flex items-center justify-between py-1.5 px-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-100 dark:border-neutral-800">
                          <span className="text-sm text-neutral-600 dark:text-neutral-400 truncate">
                            {p.profiles?.full_name || 'Desconhecido'}
                          </span>
                          {isSuperAdmin && (
                            <button 
                              onClick={() => handleRemoveParticipant(t.id, p.user_id)}
                              className="text-neutral-400 hover:text-rose-500 transition-colors p-1"
                              title="Remover participante"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 italic">Seja o primeiro a se inscrever!</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
