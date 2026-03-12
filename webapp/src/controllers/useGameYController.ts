import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, ChatMessage, Move, PlayerColor, TimerState } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/contexts/RealtimeContext'
import { gameService } from '@/services/gameyService'

export function useGameYController() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const transport = useRealtime()

  const [game, setGame] = useState<GameState | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // liveTimer: solo para display, se actualiza cada 250ms
  // No muta game, evita conflictos con setGame del servicio
  const [liveTimer, setLiveTimer] = useState<TimerState | null>(null)

  // Punto de referencia para el reloj activo:
  // guarda Date.now() en el momento en que el jugador activo empezó a consumir tiempo
  const clockStartedAtRef = useRef<number>(Date.now())

  // Valores base del timer en el momento del último sync (tras cada jugada o llegada de estado)
  const timerBaseRef = useRef<{ player1Ms: number; player2Ms: number }>({
    player1Ms: 0,
    player2Ms: 0,
  })

  // Load game state
  useEffect(() => {
    if (!gameId) return

    const loadGame = async () => {
      try {
        const gameState = await gameService.getGameState(gameId)
        if (gameState) {
          setGame(gameState)
          const messages = await gameService.getChatMessages(gameId)
          setChatMessages(messages)
        } else {
          setError('Game not found')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game')
      } finally {
        setIsLoading(false)
      }
    }

    loadGame()
  }, [gameId])

  // Subscribe to game updates
  useEffect(() => {
    if (!gameId) return

    transport.startPolling({ type: 'game', gameId })
    transport.startPolling({ type: 'chat', gameId })

    const unsubGame = transport.subscribe('gameUpdated', (event) => {
      const updatedGame = event.payload as GameState
      if (updatedGame.id === gameId) {
        setGame(updatedGame)
      }
    })

    const unsubChat = transport.subscribe('chatMessageReceived', (event) => {
      const messages = event.payload as ChatMessage[]
      setChatMessages(messages)
    })

    return () => {
      transport.stopPolling({ type: 'game', gameId })
      transport.stopPolling({ type: 'chat', gameId })
      unsubGame()
      unsubChat()
    }
  }, [gameId, transport])

  // --- Sync del reloj cada vez que llega nuevo estado del juego ---
  // Se dispara en cada jugada (game.moves.length cambia) o cambio de activePlayer
  // Aquí es donde el reloj "cambia de mano": se guarda el tiempo restante actual
  // como nueva base y se resetea el punto de referencia
  useEffect(() => {
    if (!game?.timer) {
      setLiveTimer(null)
      return
    }

    // Guardar los valores autoritativos como nueva base
    timerBaseRef.current = {
      player1Ms: game.timer.player1RemainingMs,
      player2Ms: game.timer.player2RemainingMs,
    }

    // Resetear el punto de inicio del reloj activo
    clockStartedAtRef.current = Date.now()

    // Inicializar display con los valores autoritativos
    setLiveTimer(game.timer)
  }, [
    // Solo sincronizamos cuando cambia el turno activo o llega una jugada nueva
    game?.moves.length,
    game?.timer?.activePlayer,
    game?.status,
  ])

  // --- Tick del reloj: solo actualiza liveTimer, nunca toca game ---
  useEffect(() => {
    if (!game?.timer || game.status !== 'playing' || !game.timer.activePlayer) {
      return
    }

    const activePlayer = game.timer.activePlayer

    const interval = setInterval(() => {
      const elapsed = Date.now() - clockStartedAtRef.current

      setLiveTimer((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          // Solo descuenta el jugador activo; el otro permanece congelado
          player1RemainingMs:
            activePlayer === 'player1'
              ? Math.max(0, timerBaseRef.current.player1Ms - elapsed)
              : timerBaseRef.current.player1Ms,
          player2RemainingMs:
            activePlayer === 'player2'
              ? Math.max(0, timerBaseRef.current.player2Ms - elapsed)
              : timerBaseRef.current.player2Ms,
        }
      })
    }, 250) // 4 ticks/s para display fluido sin ser costoso

    return () => clearInterval(interval)
  }, [game?.timer?.activePlayer, game?.status])

  // Resync timer on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && gameId) {
        gameService.getGameState(gameId).then((state) => {
          if (state) setGame(state)
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [gameId])

  // Get the last move
  const lastMove: Move | null = game?.moves.length
    ? game.moves[game.moves.length - 1]
    : null

  // Determine if the current user can play
  const canPlay = useCallback((): boolean => {
    if (!game || game.status !== 'playing') return false

    // Local game - anyone can play
    if (game.config.mode === 'pvp-local') return true

    // Online or PvE - check if it's the user's turn
    const currentPlayer = game.currentTurn === 'player1'
      ? game.players.player1
      : game.players.player2

    return currentPlayer.id === user?.id
  }, [game, user])

  // Handle cell click
  const handleCellClick = useCallback(
    async (row: number, col: number) => {
      if (!game || !gameId || !canPlay()) return

      try {
        const updatedGame = await gameService.playMove(
          gameId,
          row,
          col,
          game.currentTurn
        )
        setGame(updatedGame)
      } catch (err) {
        console.error('Failed to play move:', err)
      }
    },
    [game, gameId, canPlay]
  )

  // Handle surrender
  const handleSurrender = useCallback(async () => {
    if (!game || !gameId) return

    let surrenderingPlayer: PlayerColor
    if (game.config.mode === 'pvp-local') {
      surrenderingPlayer = game.currentTurn
    } else {
      surrenderingPlayer = game.players.player1.id === user?.id ? 'player1' : 'player2'
    }

    try {
      const updatedGame = await gameService.surrender(gameId, surrenderingPlayer)
      setGame(updatedGame)
    } catch (err) {
      console.error('Failed to surrender:', err)
    }
  }, [game, gameId, user])

  // Handle send chat message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!gameId || !user) return

      try {
        // Don't add locally - the polling subscription will add it
        await gameService.sendChatMessage(
          gameId,
          user.id,
          user.username,
          content
        )
        // Immediately fetch latest messages to avoid delay
        const messages = await gameService.getChatMessages(gameId)
        setChatMessages(messages)
      } catch (err) {
        console.error('Failed to send message:', err)
      }
    },
    [gameId, user]
  )

  // Handle play again
  const handlePlayAgain = useCallback(() => {
    if (!game) return
    navigate(`/games/y/config/${game.config.mode}`)
  }, [game, navigate])

  return {
    game,
    liveTimer,
    chatMessages,
    isLoading,
    error,
    lastMove,
    canPlay: canPlay(),
    handleCellClick,
    handleSurrender,
    handleSendMessage,
    handlePlayAgain,
    currentUserId: user?.id || '',
  }
}
