import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, ChatMessage, Move, PlayerColor } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/contexts/RealtimeContext'
import { gameService } from '@/services/gameService'

export function useGameYController() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const transport = useRealtime()
  
  const [game, setGame] = useState<GameState | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Timer interval ref
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Timer tick effect
  useEffect(() => {
    if (!game?.timer || game.status !== 'playing' || !game.timer.activePlayer) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      return
    }

    timerIntervalRef.current = setInterval(() => {
      setGame((prev) => {
        if (!prev?.timer || !prev.timer.activePlayer) return prev

        const elapsed = Date.now() - prev.timer.lastSyncTimestamp
        const player1Remaining = prev.timer.activePlayer === 'player1'
          ? Math.max(0, prev.timer.player1RemainingMs - elapsed)
          : prev.timer.player1RemainingMs
        const player2Remaining = prev.timer.activePlayer === 'player2'
          ? Math.max(0, prev.timer.player2RemainingMs - elapsed)
          : prev.timer.player2RemainingMs

        return {
          ...prev,
          timer: {
            ...prev.timer,
            player1RemainingMs: player1Remaining,
            player2RemainingMs: player2Remaining,
            lastSyncTimestamp: Date.now(),
          },
        }
      })
    }, 1000)

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [game?.timer, game?.status])

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
        const message = await gameService.sendChatMessage(
          gameId,
          user.id,
          user.username,
          content
        )
        setChatMessages((prev) => [...prev, message])
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
