import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameInfo, GameVariant } from '@/types'
import { gameService } from '@/services/gameyService'

/**
 * Maps a `GameInfo.id` (the catalogue key used in mockData and tests) to the
 * `:variant` URL segment consumed by the router. To wire in a new variant it
 * is enough to add it here, register the rules in the game service registry,
 * and add the i18n strings — no other webapp code needs to change.
 */
const GAME_ID_TO_VARIANT: Record<string, GameVariant> = {
  'game-y': 'y',
  'game-why-not': 'why-not',
}

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
      const variant = GAME_ID_TO_VARIANT[gameId]
      if (variant) navigate(`/games/${variant}`)
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
