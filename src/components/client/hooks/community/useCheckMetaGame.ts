import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'

export function useCheckMetaGame(matchId?: string | null) {
  const supabase = createClient()
  const [game, setGame] = useState(new Chess())
  const gameRef = useRef(game)
  const [fen, setFen] = useState(game.fen())
  const { toast } = useToast()

  // Update ref when game changes
  useEffect(() => {
    gameRef.current = game
  }, [game])

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [optionSquares, setOptionSquares] = useState<Record<string, any>>({})

  // Clocks
  const [whiteTimeLeft, setWhiteTimeLeft] = useState<number>(0)
  const [blackTimeLeft, setBlackTimeLeft] = useState<number>(0)
  const [lastMoveAt, setLastMoveAt] = useState<number | null>(null)
  const [timeControl, setTimeControl] = useState<{ min: number, inc: number } | null>(null)
  const [matchStatus, setMatchStatus] = useState<string>('playing')
  const [whitePlayerId, setWhitePlayerId] = useState<string | null>(null)
  const [blackPlayerId, setBlackPlayerId] = useState<string | null>(null)

  const matchIdRef = useRef(matchId)
  useEffect(() => {
    matchIdRef.current = matchId
  }, [matchId])

  const resetGame = useCallback(() => {
    const newGame = new Chess()
    setGame(newGame)
    setFen(newGame.fen())
    setSelectedSquare(null)
    setOptionSquares({})
  }, [])

  useEffect(() => {
    if (!matchId) return

    let channel: any = null

    const fetchInitial = async () => {
      const { data } = await supabase.from('checkmeta_matches').select('*').eq('id', matchId).single()
      if (data) {
        setMatchStatus(data.status)
        setWhitePlayerId(data.player_white_id)
        setBlackPlayerId(data.player_black_id)
        if (data.time_control_minutes) {
          setTimeControl({ min: data.time_control_minutes, inc: data.time_control_increment || 0 })
          const initialMs = data.time_control_minutes * 60 * 1000
          setWhiteTimeLeft(data.white_time_left_ms ?? initialMs)
          setBlackTimeLeft(data.black_time_left_ms ?? initialMs)
          setLastMoveAt(data.last_move_at ? new Date(data.last_move_at).getTime() : null)
        }
        
        if (data.fen) {
          try {
            const newGame = new Chess(data.fen)
            setGame(newGame)
            setFen(newGame.fen())
          } catch (e) {
            console.error("Invalid FEN from DB", e)
          }
        }
      }
    }

    fetchInitial()

    channel = supabase.channel(`match_${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkmeta_matches', filter: `id=eq.${matchId}` }, (payload) => {
        const row = payload.new
        setMatchStatus(row.status)
        setWhiteTimeLeft(row.white_time_left_ms)
        setBlackTimeLeft(row.black_time_left_ms)
        setLastMoveAt(row.last_move_at ? new Date(row.last_move_at).getTime() : null)

        const newFen = row.fen
        if (newFen && newFen !== gameRef.current.fen()) {
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

  const handleTimeOut = useCallback((loserTurn: string) => {
    if (matchStatus === 'finished') return
    
    setMatchStatus('finished')
    toast(`Fim por tempo! As ${loserTurn === 'w' ? 'Pretas' : 'Brancas'} vencem.`, 'info')
    if (matchIdRef.current) {
      supabase.from('checkmeta_matches').update({
        status: 'finished',
        result: loserTurn === 'w' ? '0-1' : '1-0',
        white_time_left_ms: loserTurn === 'w' ? 0 : whiteTimeLeft,
        black_time_left_ms: loserTurn === 'b' ? 0 : blackTimeLeft
      }).eq('id', matchIdRef.current)
      .then(({ error }) => {
        if (error) console.error("Error setting timeout status:", error)
      })
    }
  }, [supabase, toast, whiteTimeLeft, blackTimeLeft, matchStatus])

  // Interval timer for local visual clocks
  useEffect(() => {
    if (matchStatus !== 'playing' || !lastMoveAt || !matchIdRef.current) return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastMoveAt

      if (game.turn() === 'w') {
        setWhiteTimeLeft(prev => {
          const next = prev - elapsed
          if (next <= 0) {
            clearInterval(interval)
            handleTimeOut('w')
            return 0
          }
          return next
        })
      } else {
        setBlackTimeLeft(prev => {
          const next = prev - elapsed
          if (next <= 0) {
            clearInterval(interval)
            handleTimeOut('b')
            return 0
          }
          return next
        })
      }
    }, 100)

    return () => clearInterval(interval)
  }, [matchStatus, lastMoveAt, game, handleTimeOut])


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
      
      if (result) {
        setGame(new Chess(game.fen())) // force instance change to trigger re-renders if necessary
        setFen(game.fen())
        setSelectedSquare(null)
        setOptionSquares({})

        // Evaluate times
        let wTime = whiteTimeLeft
        let bTime = blackTimeLeft
        const now = Date.now()
        
        if (lastMoveAt) {
          const elapsed = now - lastMoveAt
          const incMs = (timeControl?.inc || 0) * 1000
          
          if (result.color === 'w') {
            wTime = Math.max(0, wTime - elapsed + incMs)
          } else {
            bTime = Math.max(0, bTime - elapsed + incMs)
          }
          
          setWhiteTimeLeft(wTime)
          setBlackTimeLeft(bTime)
        }
        
        setLastMoveAt(now)
        
        if (game.isCheckmate()) {
          toast('Xeque-mate! O jogo acabou.', 'success')
        } else if (game.isDraw()) {
          toast('Empate!', 'info')
        } else if (game.isCheck()) {
          toast('Xeque!', 'error')
        }

        // Sync to Supabase
        if (matchIdRef.current) {
          const updatePayload: any = { 
            fen: game.fen(),
            last_move_at: new Date(now).toISOString(),
            white_time_left_ms: wTime,
            black_time_left_ms: bTime
          }
          if (game.isCheckmate() || game.isDraw()) {
            updatePayload.status = 'finished'
            updatePayload.result = game.isCheckmate() ? (game.turn() === 'w' ? '0-1' : '1-0') : '1/2-1/2'
          }
          supabase.from('checkmeta_matches').update(updatePayload).eq('id', matchIdRef.current)
          .then(({ error }) => {
            if (error) console.error("Error updating move:", error)
          })
        }
      }
      
      return result !== null
    } catch (e) {
      // Invalid move
      return false
    }
  }, [game, toast, lastMoveAt, timeControl, whiteTimeLeft, blackTimeLeft, supabase])

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
        return
      }
    }

    // Try to select the clicked piece to show options
    const piece = game.get(square as any)
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square)
      getMoveOptions(square)
    } else {
      setSelectedSquare(null)
      setOptionSquares({})
    }
  }, [game, selectedSquare, makeMove, getMoveOptions])

  const onDrop = useCallback((sourceSquare: string, targetSquare: string, piece: string) => {
    return makeMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1].toLowerCase() ?? 'q',
    })
  }, [makeMove])

  return {
    game,
    fen,
    onDrop,
    resetGame,
    onSquareClick,
    optionSquares,
    selectedSquare,
    whiteTimeLeft,
    blackTimeLeft,
    matchStatus,
    whitePlayerId,
    blackPlayerId
  }
}
