import React from 'react'
import { Chessboard } from 'react-chessboard'
import { useCheckMetaGame } from './hooks/community/useCheckMetaGame'
import { RotateCcw, Swords, Search } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export function CheckMetaView() {
  const { fen, onDrop, resetGame, game } = useCheckMetaGame()
  const { t } = useI18n()

  const isGameOver = game.isGameOver()
  const gameStatus = game.isCheckmate() 
    ? t('checkmeta.status.checkmate', 'Xeque-Mate!')
    : game.isDraw() 
    ? t('checkmeta.status.draw', 'Empate!')
    : game.isCheck()
    ? t('checkmeta.status.check', 'Xeque!')
    : t('checkmeta.status.playing', 'Em andamento')

  return (
    <div className="flex flex-col xl:flex-row gap-8 w-full max-w-6xl mx-auto items-start">
      
      {/* Board Column */}
      <div className="flex-1 w-full max-w-[600px] mx-auto">
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden relative">
          
          {/* Classic Board Styling */}
          <Chessboard 
            options={{
              position: fen,
              onPieceDrop: ({ piece, sourceSquare, targetSquare }) => {
                if (sourceSquare && targetSquare) return onDrop(sourceSquare, targetSquare, piece)
                return false
              },
              boardOrientation: "white",
              darkSquareStyle: { backgroundColor: '#779556' },
              lightSquareStyle: { backgroundColor: '#ebecd0' },
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
      <div className="w-full xl:w-80 flex flex-col gap-6">
        
        {/* Game Info Card */}
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
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

        {/* Matchmaking Card (Visual only for now) */}
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col gap-4">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Multijogador</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Jogue online contra outros desenvolvedores da comunidade.
          </p>
          <button className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black rounded-xl font-bold transition-all flex items-center justify-center gap-2">
            <Search className="w-5 h-5" />
            Encontrar Oponente
          </button>
        </div>

      </div>

    </div>
  )
}
