import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'

export function useCheckMetaGame(matchId?: string | null) {
  const supabase = createClient()
  const [game, setGame] = useState(new Chess())
  const [fen, setFen] = useState(game.fen())
  const { toast } = useToast()

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({})

  const resetGame = useCallback(() => {
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setSelectedSquare(null)
    setOptionSquares({})
  }, [])

  const matchIdRef = useRef(matchId)
  useEffect(() => {
    matchIdRef.current = matchId
  }, [matchId])

  useEffect(() => {
    if (!matchId) return

    let channel: any = null

    const fetchInitial = async () => {
      const { data } = await supabase.from('checkmeta_matches').select('fen, status').eq('id', matchId).single()
      if (data && data.fen) {
        try {
          const newGame = new Chess(data.fen)
          setGame(newGame)
          setFen(newGame.fen())
        } catch (e) {
          console.error("Invalid FEN from DB", e)
        }
      }
    }

    fetchInitial()

    channel = supabase.channel(`match_${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkmeta_matches', filter: `id=eq.${matchId}` }, (payload) => {
        const newFen = payload.new.fen
        if (newFen && newFen !== game.fen()) {
          try {
            const newGame = new Chess(newFen)
            setGame(newGame)
            setFen(newGame.fen())
          } catch(e) {}
        }
      })
      .subscribe()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [matchId, supabase])

  const getMoveOptions = useCallback((square: string) => {
    const moves = game.moves({
      square: square as any,
      verbose: true,
    })
    if (moves.length === 0) {
      setOptionSquares({})
      return false
    }

    const newSquares: Record<string, any> = {}
    moves.map((move: any) => {
      newSquares[move.to] = {
        background:
          game.get(move.to as any) && game.get(move.to as any)?.color !== game.get(square as any)?.color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%',
      }
      return move
    })
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)',
    }
    setOptionSquares(newSquares)
    return true
  }, [game])

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

      // Sync to Supabase
      if (matchIdRef.current) {
        const updatePayload: any = { fen: game.fen() }
        if (game.isCheckmate() || game.isDraw()) {
          updatePayload.status = 'finished'
          updatePayload.result = game.isCheckmate() ? (game.turn() === 'w' ? '0-1' : '1-0') : '1/2-1/2'
        }
        supabase.from('checkmeta_matches').update(updatePayload).eq('id', matchIdRef.current).then()
      }
      
      return result !== null
    } catch (e) {
      // Invalid move
      return false
    }
  }, [game, toast])

  const onSquareClick = useCallback((square: string) => {
    // If a piece is already selected, try to move
    if (selectedSquare) {
      const moveInfo = {
        from: selectedSquare,
        to: square,
        promotion: 'q', // default to queen for simplicity
      }
      const success = makeMove(moveInfo)
      if (success) {
        setSelectedSquare(null)
        setOptionSquares({})
        return
      }
    }
    
    // If the square contains a piece of the turn's color, select it
    const piece = game.get(square as any)
    if (piece && piece.color === game.turn()) {
      if (selectedSquare === square) {
        setSelectedSquare(null)
        setOptionSquares({})
      } else {
        setSelectedSquare(square)
        getMoveOptions(square)
      }
    } else {
      setSelectedSquare(null)
      setOptionSquares({})
    }
  }, [game, selectedSquare, makeMove, getMoveOptions])

  const onDrop = useCallback((sourceSquare: string, targetSquare: string, piece: any) => {
    const pieceStr = typeof piece === 'string' ? piece : 'q'
    const moveInfo = {
      from: sourceSquare,
      to: targetSquare,
      promotion: pieceStr[1]?.toLowerCase() ?? 'q',
    }
    const success = makeMove(moveInfo)
    if (success) {
      setSelectedSquare(null)
      setOptionSquares({})
    }
    return success
  }, [makeMove])

  return {
    game,
    fen,
    resetGame,
    makeMove,
    onDrop,
    onSquareClick,
    optionSquares,
    selectedSquare
  }
}
