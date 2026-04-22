import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, ChatMessage, Move, PieDecision, PlayerColor, TimerState } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'
import { wsService } from '@/services/websocketService'

const SWAP_ANIM_MS = 600

export function useGameYController() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user, token, isGuest } = useAuth()
  
  const effectiveToken = isGuest ? undefined : (token ?? undefined)

  // --- Estado del Juego ---
  const [game, setGame] = useState<GameState | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  // --- Estado de la IA y Reglas Especiales ---
  const [isBotThinking, setIsBotThinking] = useState(false)
  const [isPieDecisionLoading, setIsPieDecisionLoading] = useState(false)
  const [isSwapAnimating, setIsSwapAnimating] = useState(false)
  const [swapCommitted, setSwapCommitted] = useState(false)
  const [isBotResolvingPie, setIsBotResolvingPie] = useState(false)
  const [swapAnimationStone, setSwapAnimationStone] = useState<{ row: number; col: number } | null>(null)

  // --- Estado de Conexión ---
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)

  // --- Gestión de Tiempo (Timer) ---
  const [liveTimer, setLiveTimer] = useState<TimerState | null>(null)
  const clockStartedAtRef = useRef(Date.now())
  const timerBaseRef = useRef({ player1Ms: 0, player2Ms: 0 })

  // ── Carga inicial del juego ──────────────────────────────────────────────
  useEffect(() => {
    if (!gameId) return
    const load = async () => {
      try {
        const state = await gameService.getGameState(gameId)
        if (!state) {
          setError('Game not found')
          return
        }
        setGame(state)
        setChatMessages(await gameService.getChatMessages(gameId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [gameId])

  // ── Listeners de WebSocket (pvp-online) ──────────────────────────────────
  useEffect(() => {
    if (!game || game.config.mode !== 'pvp-online') return

    const unsubUpdate = wsService.on('game_update', (data: any) => {
      setGame(data.game as GameState)
    })
    const unsubDisconnected = wsService.on('opponent_disconnected', () => {
      setOpponentDisconnected(true)
    })
    const unsubReconnected = wsService.on('opponent_reconnected', () => {
      setOpponentDisconnected(false)
    })

    return () => {
      unsubUpdate()
      unsubDisconnected()
      unsubReconnected()
    }
  }, [game?.id, game?.config?.mode])

  // ── Sincronización del Cronómetro ─────────────────────────────────────────
  useEffect(() => {
    if (!game?.timer) {
      setLiveTimer(null)
      return
    }

    let player1Ms = game.timer.player1RemainingMs
    let player2Ms = game.timer.player2RemainingMs

    // Si el juego terminó por tiempo, forzar el 0 del perdedor
    if (game.status === 'finished' && game.winner && game.timer.activePlayer === null) {
      const loser = game.winner === 'player1' ? 'player2' : 'player1'
      if (loser === 'player1') player1Ms = 0
      if (loser === 'player2') player2Ms = 0
    }

    timerBaseRef.current = { player1Ms, player2Ms }
    clockStartedAtRef.current = Date.now()
    setLiveTimer({ ...game.timer, player1RemainingMs: player1Ms, player2RemainingMs: player2Ms })
  }, [game?.moves.length, game?.timer?.activePlayer, game?.status])

  useEffect(() => {
    if (!game?.timer || game.status !== 'playing' || !game.timer.activePlayer) return

    const botColor: PlayerColor | null =
      game.config.mode === 'pve'
        ? (game.players.player1.isBot ? 'player1' : 'player2')
        : null

    const activePlayer = isBotThinking && botColor ? botColor : game.timer.activePlayer

    const interval = setInterval(() => {
      const elapsed = Date.now() - clockStartedAtRef.current
      setLiveTimer((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          activePlayer,
          player1RemainingMs: activePlayer === 'player1'
            ? Math.max(0, timerBaseRef.current.player1Ms - elapsed)
            : timerBaseRef.current.player1Ms,
          player2RemainingMs: activePlayer === 'player2'
            ? Math.max(0, timerBaseRef.current.player2Ms - elapsed)
            : timerBaseRef.current.player2Ms,
        }
      })
    }, 250)

    return () => clearInterval(interval)
  }, [game?.timer?.activePlayer, game?.status, isBotThinking])

  // ── Estado derivado ───────────────────────────────────────────────────────
  const lastMove: Move | null = game?.moves.length ? game.moves[game.moves.length - 1] : null
  const isPieDecisionPending = game?.phase === 'pie-decision'
  const isBotDecidingPie =
    isPieDecisionPending === true &&
    game?.config.mode === 'pve' &&
    game?.players.player2.isBot === true

  const canPlay = useCallback((): boolean => {
    if (!game || game.status !== 'playing' || isBotThinking) return false
    if (game.phase === 'pie-decision') return false
    if (game.config.mode === 'pvp-local') return true
    
    const currentPlayer = game.currentTurn === 'player1' ? game.players.player1 : game.players.player2
    return String(currentPlayer.id) === String(user?.id)
  }, [game, user, isBotThinking])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCellClick = useCallback(async (row: number, col: number) => {
    if (!game || !gameId || !canPlay()) return

    const snapshot = game
    // Actualización optimista del tablero
    const optimisticBoard = game.board.map((boardRow, r) =>
      boardRow.map((cell, c) =>
        r === row && c === col ? { ...cell, owner: game.currentTurn as PlayerColor } : cell
      )
    )
    
    setGame({ ...game, board: optimisticBoard })
    setMoveError(null)

    // Ajuste de cronómetro local para PVE
    if (game.config.mode === 'pve' && game.timer) {
      timerBaseRef.current = {
        player1Ms: liveTimer?.player1RemainingMs ?? game.timer.player1RemainingMs,
        player2Ms: liveTimer?.player2RemainingMs ?? game.timer.player2RemainingMs,
      }
      clockStartedAtRef.current = Date.now()
    }

    const willBotResolvePie =
      game.config.pieRule === true &&
      game.moves.length === 0 &&
      game.config.mode === 'pve' &&
      game.players.player2.isBot === true

    setIsBotThinking(game.config.mode === 'pve')
    if (willBotResolvePie) setIsBotResolvingPie(true)

    try {
      const updated = await gameService.playMove(gameId, row, col, game.currentTurn as PlayerColor, effectiveToken)
      setGame(updated)
      
      // Manejo de la animación si el Bot decide usar la Pie Rule (Swap)
      if (willBotResolvePie) {
        const contestedCell = updated.board[row]?.[col]
        if (contestedCell?.owner === 'player2') {
          setSwapAnimationStone({ row, col })
          setIsSwapAnimating(true)
          setTimeout(() => {
            setIsSwapAnimating(false)
            setSwapAnimationStone(null)
          }, SWAP_ANIM_MS)
        }
      }
    } catch (err) {
      setGame(snapshot)
      setMoveError(err instanceof Error ? err.message : 'Failed to play move')
    } finally {
      setIsBotThinking(false)
      setIsBotResolvingPie(false)
    }
  }, [game, gameId, canPlay, effectiveToken, liveTimer])

  const handleSurrender = useCallback(async () => {
    if (!game || !gameId) return
    
    if (game.config.mode === 'pvp-online') {
      wsService.send({ type: 'surrender', gameId })
      return
    }

    let surrenderingPlayer: PlayerColor = 
      game.config.mode === 'pvp-local' 
        ? game.currentTurn 
        : (String(game.players.player1.id) === String(user?.id) ? 'player1' : 'player2')

    try {
      const updated = await gameService.surrender(gameId, surrenderingPlayer, effectiveToken)
      setGame(updated)
    } catch (err) {
      console.error('Failed to surrender:', err)
    }
  }, [game, gameId, user, effectiveToken])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!gameId || !user) return
    try {
      await gameService.sendChatMessage(gameId, user.id, user.username, content)
      setChatMessages(await gameService.getChatMessages(gameId))
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }, [gameId, user])

  const handlePieDecision = useCallback(async (decision: PieDecision) => {
    if (!game || !gameId) return
    setIsPieDecisionLoading(true)

    if (decision === 'swap') {
      setIsSwapAnimating(true)
      setTimeout(() => setIsSwapAnimating(false), SWAP_ANIM_MS)
      setSwapCommitted(true)
    }

    try {
      const updated = await gameService.decidePie(gameId, decision, effectiveToken)
      setGame(updated)
    } catch (err) {
      setIsSwapAnimating(false)
      setSwapCommitted(false)
      console.error('Failed pie decision:', err)
    } finally {
      setIsPieDecisionLoading(false)
      setSwapCommitted(false)
    }
  }, [game, gameId, effectiveToken])

  const handlePlayAgain = useCallback(() => {
    if (!game) return
    if (game.config.mode === 'pvp-online') {
      wsService.disconnect()
      navigate('/games/y/online')
    } else {
      navigate(`/games/y/config/${game.config.mode}`)
    }
  }, [game, navigate])

  return {
    game,
    liveTimer,
    chatMessages,
    isLoading,
    error,
    moveError,
    lastMove,
    isBotThinking,
    isPieDecisionPending,
    isBotDecidingPie,
    isPieDecisionLoading,
    isSwapAnimating,
    isBotResolvingPie,
    swapAnimationStone,
    swapCommitted,
    opponentDisconnected,
    canPlay: canPlay(),
    handleCellClick,
    handlePieDecision,
    handleSurrender,
    handleSendMessage,
    handlePlayAgain,
    currentUserId: user?.id ?? '',
  }
}