import React, { useEffect, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { useCheckMetaGame } from './hooks/community/useCheckMetaGame'
import { RotateCcw, Swords, Search } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'
import { CheckMetaLists } from './checkmeta/CheckMetaLists'
import { CheckMetaTournaments } from './checkmeta/CheckMetaTournaments'
import { CheckMetaLobby } from './checkmeta/CheckMetaLobby'
import { createClient } from '@/utils/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export function CheckMetaView() {
  const searchParams = useSearchParams()
  const matchId = searchParams.get('matchId')
  const { 
    fen, 
    onDrop, 
    resetGame, 
    game, 
    onSquareClick, 
    optionSquares,
    whiteTimeLeft,
    blackTimeLeft,
    matchStatus,
    whitePlayerId,
    blackPlayerId
  } = useCheckMetaGame(matchId)
  const { t } = useI18n()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
        if (data?.is_super_admin) {
          setIsSuperAdmin(true)
        }
      }
    }
    checkAdmin()
  }, [])

  // Format MS into mm:ss
  const formatTime = (ms: number) => {
    if (ms <= 0) return '00:00'
    const totalSeconds = Math.ceil(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const isGameOver = game.isGameOver() || matchStatus === 'finished'
  const gameStatus = matchStatus === 'finished' 
    ? t('checkmeta.status.finished', 'Partida Encerrada')
    : game.isCheckmate() 
    ? t('checkmeta.status.checkmate', 'Xeque-Mate')
    : game.isCheck()
    ? t('checkmeta.status.check', 'Xeque!')
    : t('checkmeta.status.playing', 'Em andamento')

  return (
    <>
      {!matchId ? (
        <div className="flex flex-col gap-8 w-full max-w-[1200px] mx-auto p-6">
          <div className="text-center mb-4 mt-6">
            <h2 className="text-3xl font-black text-neutral-400 dark:text-neutral-500 mb-2">CheckMeta</h2>
            <p className="text-neutral-500 max-w-sm mx-auto text-center">Entre em um torneio ou procure uma partida rápida no Lobby para jogar.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
            <div className="flex flex-col gap-6">
              <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl">
                <CheckMetaLobby />
              </div>
              <CheckMetaTournaments isSuperAdmin={isSuperAdmin} />
            </div>
            <div className="flex flex-col gap-6">
              <CheckMetaLists />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col xl:flex-row gap-6 lg:gap-10 h-full p-6 w-full max-w-[1400px] mx-auto items-start xl:items-stretch">
          {/* 1. Área do Tabuleiro */}
          <div className="flex-1 w-full max-w-[600px] mx-auto xl:mx-0">
            
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden relative">
            
            {/* Black Clock (Top) */}
            <div className="flex justify-between items-center mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">B</span>
                </div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Pretas</span>
              </div>
              <div className={`px-4 py-2 rounded-xl font-black text-xl tracking-wider ${blackTimeLeft < 10000 ? 'bg-red-100 text-red-600' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-white'}`}>
                {formatTime(blackTimeLeft)}
              </div>
            </div>

            {/* Classic Board Styling */}
            <Chessboard 
              options={{
                boardOrientation: currentUserId === blackPlayerId ? "black" : "white",
                position: fen,
                onPieceDrop: ({ piece, sourceSquare, targetSquare }: any) => {
                  if (sourceSquare && targetSquare) return onDrop(sourceSquare, targetSquare, piece as unknown as string)
                  return false
                },
                onSquareClick: ({ square }: any) => onSquareClick(square as string),
                squareStyles: optionSquares,
                darkSquareStyle: { backgroundColor: '#5c7bb1' },
                lightSquareStyle: { backgroundColor: '#a9bede' },
                animationDurationInMs: 300,
                boardStyle: {
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
                }
              }}
            />

            {/* White Clock (Bottom) */}
            <div className="flex justify-between items-center mt-4 px-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-neutral-200 border border-neutral-300 rounded-lg flex items-center justify-center">
                  <span className="text-neutral-900 font-bold text-xs">W</span>
                </div>
                <span className="font-semibold text-neutral-700 dark:text-neutral-300">Brancas</span>
              </div>
              <div className={`px-4 py-2 rounded-xl font-black text-xl tracking-wider ${whiteTimeLeft < 10000 ? 'bg-red-100 text-red-600' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-white'}`}>
                {formatTime(whiteTimeLeft)}
              </div>
            </div>

            {isGameOver && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
                <h2 className="text-4xl font-black mb-2">{gameStatus}</h2>
                <p className="text-lg opacity-80 mb-6">Fim de jogo.</p>
                
                <div className="flex gap-4">
                  <button 
                    onClick={() => router.replace(window.location.pathname)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all"
                  >
                    Voltar para o Lobby
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls Column */}
        <div className="w-full xl:w-[400px] flex flex-col gap-6">
          {/* Game Info Card (only show if playing) */}
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

          <CheckMetaTournaments isSuperAdmin={isSuperAdmin} />
          <CheckMetaLists />
        </div>
      </div>
      )}
    </>
  )
}
