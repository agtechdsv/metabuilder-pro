import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/utils/supabase/client'

export function useCheckMetaGame(matchId?: string | null, currentUserId?: string | null) {
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
  const baseWhiteTimeRef = useRef<number>(0)
  const baseBlackTimeRef = useRef<number>(0)
  const lastMoveAtRef = useRef<number | null>(null)

  const [whiteTimeLeft, setWhiteTimeLeft] = useState<number>(0)
  const [blackTimeLeft, setBlackTimeLeft] = useState<number>(0)
  const [lastMoveAt, setLastMoveAt] = useState<number | null>(null)
  const [timeControl, setTimeControl] = useState<{ min: number, inc: number } | null>(null)
  const [matchStatus, setMatchStatus] = useState<string>('playing')
  const [whitePlayerId, setWhitePlayerId] = useState<string | null>(null)
  const [blackPlayerId, setBlackPlayerId] = useState<string | null>(null)

  const channelRef = useRef<any>(null)
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

  const handleIncomingData = useCallback((data: any) => {
    if (!data) return
    if (data.status) setMatchStatus(data.status)
    if (data.white_time_left_ms !== undefined && data.white_time_left_ms !== null) {
      const ms = Number(data.white_time_left_ms)
      baseWhiteTimeRef.current = ms
      setWhiteTimeLeft(ms)
    }
    if (data.black_time_left_ms !== undefined && data.black_time_left_ms !== null) {
      const ms = Number(data.black_time_left_ms)
      baseBlackTimeRef.current = ms
      setBlackTimeLeft(ms)
    }
    if (data.last_move_at) {
      const t = typeof data.last_move_at === 'number' ? data.last_move_at : new Date(data.last_move_at).getTime()
      lastMoveAtRef.current = t
      setLastMoveAt(t)
    }

    const newFen = data.fen
    if (newFen && newFen !== gameRef.current.fen()) {
      try {
        const newGame = new Chess(newFen)
        setGame(newGame)
        setFen(newGame.fen())
        setSelectedSquare(null)
        setOptionSquares({})
      } catch (e) {
        console.error("Invalid incoming FEN:", e)
      }
    }
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
          const wMs = data.white_time_left_ms ?? initialMs
          const bMs = data.black_time_left_ms ?? initialMs
          baseWhiteTimeRef.current = wMs
          baseBlackTimeRef.current = bMs
          setWhiteTimeLeft(wMs)
          setBlackTimeLeft(bMs)
          const lma = data.last_move_at ? new Date(data.last_move_at).getTime() : null
          lastMoveAtRef.current = lma
          setLastMoveAt(lma)
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

    // Subscribes both to Realtime Broadcast (sub-50ms peer-to-peer moves) AND postgres_changes
    channel = supabase.channel(`match_${matchId}`)
      .on('broadcast', { event: 'game_move' }, ({ payload }) => {
        handleIncomingData(payload)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'checkmeta_matches', filter: `id=eq.${matchId}` }, (payload) => {
        handleIncomingData(payload.new)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channel) supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [matchId, supabase, handleIncomingData])

  const handleTimeOut = useCallback((loserTurn: string) => {
    if (matchStatus === 'finished') return
    
    setMatchStatus('finished')
    const winner = loserTurn === 'w' ? 'Pretas' : 'Brancas'
    const result = loserTurn === 'w' ? '0-1' : '1-0'
    toast(`Fim por tempo! As ${winner} vencem.`, 'info')

    const timeoutPayload = {
      status: 'finished',
      result,
      white_time_left_ms: loserTurn === 'w' ? 0 : baseWhiteTimeRef.current,
      black_time_left_ms: loserTurn === 'b' ? 0 : baseBlackTimeRef.current
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'game_move',
        payload: timeoutPayload
      }).catch(() => {})
    }

    if (matchIdRef.current) {
      supabase.from('checkmeta_matches').update(timeoutPayload).eq('id', matchIdRef.current)
      .then(({ error }) => {
        if (error) console.error("Error setting timeout status:", error)
      })
    }
  }, [supabase, toast, matchStatus])

  // Interval timer for local visual clocks
  useEffect(() => {
    if (matchStatus !== 'playing' || !lastMoveAt || !matchIdRef.current) return

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = Math.max(0, now - lastMoveAt)

      if (gameRef.current.turn() === 'w') {
        const remaining = Math.max(0, baseWhiteTimeRef.current - elapsed)
        setWhiteTimeLeft(remaining)
        if (remaining <= 0) {
          clearInterval(interval)
          handleTimeOut('w')
        }
      } else {
        const remaining = Math.max(0, baseBlackTimeRef.current - elapsed)
        setBlackTimeLeft(remaining)
        if (remaining <= 0) {
          clearInterval(interval)
          handleTimeOut('b')
        }
      }
    }, 100)

    return () => clearInterval(interval)
  }, [matchStatus, lastMoveAt, handleTimeOut])

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
      // Validate turn: player can only move their own color
      if (currentUserId) {
        const isWhite = currentUserId === whitePlayerId
        const isBlack = currentUserId === blackPlayerId
        if (isWhite && game.turn() !== 'w') return false
        if (isBlack && game.turn() !== 'b') return false
        if (!isWhite && !isBlack) return false // Spectators cannot move pieces
      }

      const result = game.move(move)
      
      if (result) {
        const newFen = game.fen()
        setGame(new Chess(newFen))
        setFen(newFen)
        setSelectedSquare(null)
        setOptionSquares({})

        // Evaluate times
        let wTime = baseWhiteTimeRef.current
        let bTime = baseBlackTimeRef.current
        const now = Date.now()
        
        if (lastMoveAt) {
          const elapsed = Math.max(0, now - lastMoveAt)
          const incMs = (timeControl?.inc || 0) * 1000
          
          if (result.color === 'w') {
            wTime = Math.max(0, baseWhiteTimeRef.current - elapsed + incMs)
          } else {
            bTime = Math.max(0, baseBlackTimeRef.current - elapsed + incMs)
          }
        }
        
        baseWhiteTimeRef.current = wTime
        baseBlackTimeRef.current = bTime
        lastMoveAtRef.current = now
        setWhiteTimeLeft(wTime)
        setBlackTimeLeft(bTime)
        setLastMoveAt(now)
        
        let newStatus = 'playing'
        let matchResult: string | undefined = undefined

        if (game.isCheckmate()) {
          newStatus = 'finished'
          matchResult = game.turn() === 'w' ? '0-1' : '1-0'
          setMatchStatus('finished')
          toast('Xeque-mate! O jogo acabou.', 'success')
        } else if (game.isDraw()) {
          newStatus = 'finished'
          matchResult = '1/2-1/2'
          setMatchStatus('finished')
          toast('Empate!', 'info')
        } else if (game.isCheck()) {
          toast('Xeque!', 'error')
        }

        const movePayload = {
          fen: newFen,
          last_move_at: new Date(now).toISOString(),
          white_time_left_ms: wTime,
          black_time_left_ms: bTime,
          status: newStatus,
          result: matchResult
        }

        // 1. Broadcast instantaneously to opponent
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'game_move',
            payload: movePayload
          }).catch((err: any) => console.error("Broadcast move error:", err))
        }

        // 2. Persist to Supabase DB
        if (matchIdRef.current) {
          supabase.from('checkmeta_matches').update(movePayload).eq('id', matchIdRef.current)
          .then(({ error }) => {
            if (error) console.error("Error updating move in DB:", error)
          })
        }
      }
      
      return result !== null
    } catch (e) {
      return false
    }
  }, [game, toast, lastMoveAt, timeControl, supabase, currentUserId, whitePlayerId, blackPlayerId])

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
      if (currentUserId) {
        const isWhite = currentUserId === whitePlayerId
        const isBlack = currentUserId === blackPlayerId
        if (piece.color === 'w' && !isWhite) return
        if (piece.color === 'b' && !isBlack) return
      }
      setSelectedSquare(square)
      getMoveOptions(square)
    } else {
      setSelectedSquare(null)
      setOptionSquares({})
    }
  }, [game, selectedSquare, makeMove, getMoveOptions, currentUserId, whitePlayerId, blackPlayerId])

  const onDrop = useCallback((sourceSquare: string, targetSquare: string, piece: string) => {
    return makeMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1]?.toLowerCase() ?? 'q',
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
