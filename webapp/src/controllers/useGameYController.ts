import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, ChatMessage, Move, PlayerColor, TimerState } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

export function useGameYController() {
    const { gameId } = useParams<{ gameId: string }>()
    const navigate = useNavigate()
    const { user, token, isGuest } = useAuth()
    const effectiveToken = isGuest ? undefined : (token ?? undefined)

    const [game, setGame] = useState<GameState | null>(null)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [moveError, setMoveError] = useState<string | null>(null)
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

        load()
    }, [gameId])

    // --- Timer sync ---

    useEffect(() => {
        if (!game?.timer) { setLiveTimer(null); return }

        let player1Ms = game.timer.player1RemainingMs
        let player2Ms = game.timer.player2RemainingMs

        // If game ended by timeout, force loser to 0
        if (game.status === 'finished' && game.winner && game.timer.activePlayer === null) {
            const loser = game.winner === 'player1' ? 'player2' : 'player1'
            if (loser === 'player1') player1Ms = 0
            if (loser === 'player2') player2Ms = 0
        }

        timerBaseRef.current = { player1Ms, player2Ms }
        clockStartedAtRef.current = Date.now()
        setLiveTimer({
            ...game.timer,
            player1RemainingMs: player1Ms,
            player2RemainingMs: player2Ms,
        })
    }, [game?.moves.length, game?.timer?.activePlayer, game?.status])

    useEffect(() => {
        if (!game?.timer || game.status !== 'playing' || !game.timer.activePlayer) return

        // While the bot is thinking, the server is running both the human's move
        // and the bot's response before returning. Count down the bot's clock in
        // the frontend instead of the human's so the display stays accurate.
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
    }, [game?.timer?.activePlayer, game?.status, isBotThinking])

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

    // --- Derived state ---

    const lastMove: Move | null = game?.moves.length ? game.moves[game.moves.length - 1] : null

    const canPlay = useCallback((): boolean => {
        if (!game || game.status !== 'playing' || isBotThinking) return false
        if (game.config.mode === 'pvp-local') return true
        const currentPlayer = game.currentTurn === 'player1' ? game.players.player1 : game.players.player2
        return String(currentPlayer.id) === String(user?.id)
    }, [game, user, isBotThinking])

    // --- Handlers ---

    const handleCellClick = useCallback(async (row: number, col: number) => {
        if (!game || !gameId || !canPlay()) return

        // Optimistic update: show the move immediately, revert on error
        const snapshot = game
        const optimisticBoard = game.board.map((boardRow, r) =>
            boardRow.map((cell, c) =>
                r === row && c === col ? { ...cell, owner: game.currentTurn as PlayerColor } : cell
            )
        )
        setGame({ ...game, board: optimisticBoard })

        setMoveError(null)

        // In PvE the server processes the human move + bot response in one round-
        // trip, returning only when both are done. Reset the clock reference to
        // right now so the bot's countdown interval starts from the correct base.
        if (game.config.mode === 'pve' && game.timer) {
            timerBaseRef.current = {
                player1Ms: liveTimer?.player1RemainingMs ?? game.timer.player1RemainingMs,
                player2Ms: liveTimer?.player2RemainingMs ?? game.timer.player2RemainingMs,
            }
            clockStartedAtRef.current = Date.now()
        }

        setIsBotThinking(game.config.mode === 'pve')
        try {
            const updated = await gameService.playMove(gameId, row, col, game.currentTurn as PlayerColor, effectiveToken)
            setGame(updated)
        } catch (err) {
            setGame(snapshot)
            const msg = err instanceof Error ? err.message : 'Failed to play move'
            setMoveError(msg)
            console.error('Failed to play move:', err)
        } finally {
            setIsBotThinking(false)
        }
    }, [game, gameId, canPlay, effectiveToken, liveTimer])

    const handleSurrender = useCallback(async () => {
        if (!game || !gameId) return

        const surrenderingPlayer: PlayerColor =
            game.config.mode === 'pvp-local'
                ? game.currentTurn
                : String(game.players.player1.id) === String(user?.id) ? 'player1' : 'player2'

        try {
            // feat/guest-mode: use effectiveToken (undefined for guests)
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
        moveError,
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
