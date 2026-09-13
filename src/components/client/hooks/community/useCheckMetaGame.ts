import { useState, useCallback } from 'react'
import { Chess } from 'chess.js'
import { useToast } from '@/components/ui/Toast'

export function useCheckMetaGame() {
  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const { toast } = useToast()

  const resetGame = useCallback(() => {
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
  }, [])

  const makeMove = useCallback((move: string | { from: string, to: string, promotion?: string }) => {
    try {
      const result = game.move(move)
      setGame(new Chess(game.fen())) // force instance change to trigger re-renders if necessary
      setFen(game.fen())
      
      if (game.isCheckmate()) {
        toast('Xeque-mate! O jogo acabou.', 'success')
      } else if (game.isDraw()) {
        toast('Empate!', 'info')
      } else if (game.isCheck()) {
        toast('Xeque!', 'error')
      }
      
      return result !== null
    } catch (e) {
      // Invalid move
      return false
    }
  }, [game, toast])

  const onDrop = useCallback((sourceSquare: string, targetSquare: string, piece: any) => {
    const pieceStr = typeof piece === 'string' ? piece : 'q'
    const moveInfo = {
      from: sourceSquare,
      to: targetSquare,
      promotion: pieceStr[1]?.toLowerCase() ?? 'q',
    }
    return makeMove(moveInfo)
  }, [makeMove])

  return {
    game,
    fen,
    resetGame,
    makeMove,
    onDrop
  }
}
