import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, ChatMessage, Move, PlayerColor, TimerState } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/contexts/RealtimeContext'
import { gameService } from '@/services/gameyService'

export function useGameYController() {
    const { gameId } = useParams<{ gameId: string }>()
    const navigate = useNavigate()
    const { user, token } = useAuth()
    const transport = useRealtime()

    const [game, setGame] = useState<GameState | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isBotThinking, setIsBotThinking] = useState(false)

    const [liveTimer, setLiveTimer] = useState<TimerState | null>(null)
    const clockStartedAtRef = useRef(Date.now())
    const timerBaseRef = useRef({ player1Ms: 0, player2Ms: 0 })

    // --- Game loading ---

    useEffect(() => {
        if (!gameId) return

        const load = async () => {
            try {
                const state = await gameService.getGameState(gameId)
                if (!state) { setError('Game not found'); return }

                setGame(state)
                setChatMessages(await gameService.getChatMessages(gameId))
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load game')
            } finally {
                setIsLoading(false)
            }
        }

        const checkBotOpens = async () => {
            const state = await gameService.getGameState(gameId)
            if (!state) return

            const botStartsFirst =
                state.config.mode === 'pve' &&
                state.status === 'playing' &&
                state.moves.length === 0 &&
                (state.currentTurn === 'player1'
                    ? state.players.player1.isBot
                    : state.players.player2.isBot)

            if (botStartsFirst) {
                await waitForBot(gameId, 0)
            }
        }

        load().then(() => checkBotOpens())
    }, [gameId])

    // --- Realtime subscription (PvP online) ---

    useEffect(() => {
        if (!gameId) return

        transport.startPolling({ type: 'game', gameId })
        transport.startPolling({ type: 'chat', gameId })

        const unsubGame = transport.subscribe('gameUpdated', (event) => {
            const updated = event.payload as GameState
            if (updated.id === gameId) setGame(updated)
        })

        const unsubChat = transport.subscribe('chatMessageReceived', (event) => {
            setChatMessages(event.payload as ChatMessage[])
        })

        return () => {
            transport.stopPolling({ type: 'game', gameId })
            transport.stopPolling({ type: 'chat', gameId })
            unsubGame()
            unsubChat()
        }
    }, [gameId, transport])

    // --- Timer sync ---

    useEffect(() => {
        if (!game?.timer) { setLiveTimer(null); return }

        timerBaseRef.current = {
            player1Ms: game.timer.player1RemainingMs,
            player2Ms: game.timer.player2RemainingMs,
        }
        clockStartedAtRef.current = Date.now()
        setLiveTimer(game.timer)
    }, [game?.moves.length, game?.timer?.activePlayer, game?.status])

    useEffect(() => {
        if (!game?.timer || game.status !== 'playing' || !game.timer.activePlayer) return

        const activePlayer = game.timer.activePlayer
        const interval = setInterval(() => {
            const elapsed = Date.now() - clockStartedAtRef.current
            setLiveTimer((prev) => {
                if (!prev) return prev
                return {
                    ...prev,
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
        }, 250)

        return () => clearInterval(interval)
    }, [game?.timer?.activePlayer, game?.status])

    // --- Resync on tab focus ---

    useEffect(() => {
        const onVisibilityChange = () => {
            if (!document.hidden && gameId) {
                gameService.getGameState(gameId).then((state) => { if (state) setGame(state) })
            }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => document.removeEventListener('visibilitychange', onVisibilityChange)
    }, [gameId])

    // --- Helpers ---

    const waitForBot = async (gid: string, afterMovesCount: number) => {
        setIsBotThinking(true)
        try {
            const state = await gameService.waitForBotMove(gid, afterMovesCount)
            if (state) setGame(state)
        } finally {
            setIsBotThinking(false)
        }
    }

    const lastMove: Move | null = game?.moves.length ? game.moves[game.moves.length - 1] : null

    const canPlay = useCallback((): boolean => {
        if (!game || game.status !== 'playing' || isBotThinking) return false
        if (game.config.mode === 'pvp-local') return true
        const currentPlayer = game.currentTurn === 'player1' ? game.players.player1 : game.players.player2
        return currentPlayer.id === user?.id
    }, [game, user, isBotThinking])

    // --- Handlers ---

    const handleCellClick = useCallback(async (row: number, col: number) => {
        if (!game || !gameId || !canPlay()) return

        try {
            const updated = await gameService.playMove(gameId, row, col, game.currentTurn, token ?? undefined)
            setGame(updated)

            if (updated.config.mode === 'pve' && updated.status === 'playing') {
                await waitForBot(gameId, updated.moves.length)
            }
        } catch (err) {
            console.error('Failed to play move:', err)
        }
    }, [game, gameId, canPlay, token])

    const handleSurrender = useCallback(async () => {
        if (!game || !gameId) return

        const surrenderingPlayer: PlayerColor =
            game.config.mode === 'pvp-local'
                ? game.currentTurn
                : game.players.player1.id === user?.id ? 'player1' : 'player2'

        try {
            const updated = await gameService.surrender(gameId, surrenderingPlayer, token ?? undefined)
            setGame(updated)
        } catch (err) {
            console.error('Failed to surrender:', err)
        }
    }, [game, gameId, user, token])

    const handleSendMessage = useCallback(async (content: string) => {
        if (!gameId || !user) return

        try {
            await gameService.sendChatMessage(gameId, user.id, user.username, content)
            setChatMessages(await gameService.getChatMessages(gameId))
        } catch (err) {
            console.error('Failed to send message:', err)
        }
    }, [gameId, user])

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
        isBotThinking,
        canPlay: canPlay(),
        handleCellClick,
        handleSurrender,
        handleSendMessage,
        handlePlayAgain,
        currentUserId: user?.id ?? '',
    }
}
