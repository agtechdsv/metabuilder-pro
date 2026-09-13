import React, { useEffect, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useCheckMetaGame } from './hooks/community/useCheckMetaGame'
import { RotateCcw, Swords, Search } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { CheckMetaLists } from './checkmeta/CheckMetaLists'
import { CheckMetaTournaments } from './checkmeta/CheckMetaTournaments'
import { CheckMetaLobby } from './checkmeta/CheckMetaLobby'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams } from 'next/navigation'

export function CheckMetaView() {
  const searchParams = useSearchParams()
  const matchId = searchParams.get('matchId')
  const { fen, onDrop, resetGame, game, onSquareClick, optionSquares } = useCheckMetaGame(matchId)
  const { t } = useI18n()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
        if (data?.is_super_admin) {
          setIsSuperAdmin(true)
        }
      }
    }
    checkAdmin()
  }, [])

  const isGameOver = game.isGameOver()
  const gameStatus = game.isCheckmate() 
    ? t('checkmeta.status.checkmate', 'Xeque-Mate!')
    : game.isDraw() 
    ? t('checkmeta.status.draw', 'Empate!')
    : game.isCheck()
    ? t('checkmeta.status.check', 'Xeque!')
    : t('checkmeta.status.playing', 'Em andamento')

  return (
    <div className="flex flex-col xl:flex-row gap-8 w-full max-w-7xl mx-auto items-start">
      
      {/* Board Column */}
      <div className="flex-1 w-full max-w-[600px] mx-auto xl:mx-0">
        
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden relative">
          {/* Classic Board Styling */}
          <Chessboard 
            options={{
              position: fen,
              onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
                if (sourceSquare && targetSquare) return onDrop(sourceSquare, targetSquare, piece)
                return false
              },
              onSquareClick: ({ square }) => onSquareClick(square as string),
              squareStyles: optionSquares,
              boardOrientation: "white",
              darkSquareStyle: { backgroundColor: '#6366f1' },
              lightSquareStyle: { backgroundColor: '#e0e7ff' },
              animationDurationInMs: 300,
              boardStyle: {
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
              }
            }}
          />

          {isGameOver && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
              <h2 className="text-4xl font-black mb-2">{gameStatus}</h2>
              <button 
                onClick={resetGame}
                className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                {t('checkmeta.actions.play_again', 'Jogar Novamente')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar Controls Column */}
      <div className="w-full xl:w-[400px] flex flex-col gap-6">
        
        {/* Matchmaking Lobby */}
        {!matchId && (
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl">
            <CheckMetaLobby />
          </div>
        )}

        {/* Game Info Card (only show if playing) */}
        {matchId && (
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row xl:flex-col gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center">
                  <Swords className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-neutral-900 dark:text-white">CheckMeta</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Arena de Xadrez</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Status</span>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{gameStatus}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Turno</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    {game.turn() === 'w' ? 'Brancas' : 'Pretas'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Tournaments and Lists */}
        <CheckMetaTournaments isSuperAdmin={isSuperAdmin} />
        <CheckMetaLists />
      </div>

    </div>
  )
}
