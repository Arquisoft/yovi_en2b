import { useState, useEffect, useCallback, useRef } from 'react'

const SWAP_ANIM_MS = 600
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, ChatMessage, Move, PieDecision, PlayerColor, TimerState } from '@/types'
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
    const [isPieDecisionLoading, setIsPieDecisionLoading] = useState(false)
    const [isSwapAnimating, setIsSwapAnimating] = useState(false)
    // Set immediately when the human commits to swap so the highlight can show
    // the stone as red before the API responds (pre-coloring).
    const [swapCommitted, setSwapCommitted] = useState(false)
    // True while the server is auto-resolving the bot's pie decision (bot is P2).
    // Used to show the panel + spinner during the playMove round-trip.
    const [isBotResolvingPie, setIsBotResolvingPie] = useState(false)
    // When the bot auto-swaps we animate the contested stone. We track its
    // position separately because after the API response lastMove points to
    // the bot's follow-up move, not the swapped stone.
    const [swapAnimationStone, setSwapAnimationStone] = useState<{ row: number; col: number } | null>(null)

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

    // True when awaiting the second player's Pie Rule keep/swap decision.
    const isPieDecisionPending = game?.phase === 'pie-decision'

    // True when it's the pie-decision phase but the decider is a bot (unfinished path).
    const isBotDecidingPie =
        isPieDecisionPending === true &&
        game?.config.mode === 'pve' &&
        game?.players.player2.isBot === true

    const canPlay = useCallback((): boolean => {
        if (!game || game.status !== 'playing' || isBotThinking) return false
        // Block normal moves while waiting for pie decision
        if (game.phase === 'pie-decision') return false
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

        // Detect if the server will auto-resolve a bot pie decision this round-trip:
        // pie rule enabled + this is the very first move + bot is the deciding player (P2).
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

            // If the bot was resolving pie and the contested stone is now owned
            // by player2 (the bot swapped), play the swap animation on that cell.
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
            const msg = err instanceof Error ? err.message : 'Failed to play move'
            setMoveError(msg)
            console.error('Failed to play move:', err)
        } finally {
            setIsBotThinking(false)
            setIsBotResolvingPie(false)
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

    const handlePieDecision = useCallback(async (decision: PieDecision) => {
        if (!game || !gameId) return
        setIsPieDecisionLoading(true)

        // For swap: start the animation immediately and guarantee it runs for at
        // least SWAP_ANIM_MS regardless of how fast the API responds.
        let swapAnimTimer: ReturnType<typeof setTimeout> | null = null
        if (decision === 'swap') {
            setIsSwapAnimating(true)
            swapAnimTimer = setTimeout(() => setIsSwapAnimating(false), SWAP_ANIM_MS)
        }

        // Optimistic update for swap: immediately change the stone from Blue (player1)
        // to Red (player2). The 700 ms fill transition in GameYCell makes this visible.
        const snapshot = game
        if (decision === 'swap') {
            const pieStone = game.moves.length > 0 ? game.moves[game.moves.length - 1] : null
            if (pieStone) {
                const optimisticBoard = game.board.map(row =>
                    row.map(cell =>
                        cell.row === pieStone.row && cell.col === pieStone.col
                            ? { ...cell, owner: 'player2' as PlayerColor }
                            : cell
                    )
                )
                setGame({ ...game, board: optimisticBoard })
            }
        }

            if (decision === 'swap') setSwapCommitted(true)
        try {
            const updated = await gameService.decidePie(gameId, decision, effectiveToken)
            setGame(updated)
        } catch (err) {
            setGame(snapshot) // revert optimistic update on error
            if (swapAnimTimer) clearTimeout(swapAnimTimer)
            setIsSwapAnimating(false)
            setSwapCommitted(false)
            console.error('Failed to submit pie decision:', err)
        } finally {
            setIsPieDecisionLoading(false)
            setSwapCommitted(false)
        }
    }, [game, gameId, effectiveToken])

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
        isPieDecisionPending,
        isBotDecidingPie,
        isPieDecisionLoading,
        isSwapAnimating,
        isBotResolvingPie,
        swapAnimationStone,
        swapCommitted,
        canPlay: canPlay(),
        handleCellClick,
        handlePieDecision,
        handleSurrender,
        handleSendMessage,
        handlePlayAgain,
        currentUserId: user?.id ?? '',
    }
}
