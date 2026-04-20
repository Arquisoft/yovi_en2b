import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { GameState, BoardCell, Move } from '@/types'
import { gameService } from '@/services/gameyService'
import { getBoardAtStep } from '@/utils/replayUtils'

export function useGameReplayController() {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()

  const [game, setGame] = useState<GameState | null>(null)
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        // Start at the final position
        setStep(state.moves.length)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [gameId])

  // Reconstruct board at the current step
  const boardAtStep: BoardCell[][] | null = useMemo(
    () => (game ? getBoardAtStep(game, step) : null),
    [game, step]
  )

  const totalMoves = game?.moves.length ?? 0

  // The move that was just played to arrive at the current step
  const currentMove: Move | null = game && step > 0 ? game.moves[step - 1] : null

  const canGoBack = step > 0
  const canGoForward = step < totalMoves

  const goBack = useCallback(() => setStep(s => Math.max(0, s - 1)), [])
  const goForward = useCallback(() => setStep(s => Math.min(totalMoves, s + 1)), [totalMoves])
  const goToStart = useCallback(() => setStep(0), [])
  const goToEnd = useCallback(() => setStep(totalMoves), [totalMoves])

  const goToHistory = useCallback(() => navigate('/history'), [navigate])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') {
        setStep(s => Math.max(0, s - 1))
      } else if (e.key === 'ArrowRight') {
        setStep(s => Math.min(totalMoves, s + 1))
      } else if (e.key === 'Home') {
        setStep(0)
      } else if (e.key === 'End') {
        setStep(totalMoves)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [totalMoves])

  return {
    game,
    boardAtStep,
    step,
    totalMoves,
    currentMove,
    isLoading,
    error,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    goToStart,
    goToEnd,
    setStep,
    goToHistory,
  }
}