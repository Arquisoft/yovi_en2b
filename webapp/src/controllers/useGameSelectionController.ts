import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameInfo } from '@/types'
import { gameService } from '@/services/gameService'

export function useGameSelectionController() {
  const navigate = useNavigate()
  const [games, setGames] = useState<GameInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadGames = async () => {
      try {
        const availableGames = await gameService.getAvailableGames()
        setGames(availableGames)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load games')
      } finally {
        setIsLoading(false)
      }
    }

    loadGames()
  }, [])

  const handlePlayGame = useCallback(
    (gameId: string) => {
      if (gameId === 'game-y') {
        navigate('/games/y')
      }
    },
    [navigate]
  )

  return {
    games,
    isLoading,
    error,
    handlePlayGame,
  }
}
