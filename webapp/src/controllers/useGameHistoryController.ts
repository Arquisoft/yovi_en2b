import { useState, useEffect } from 'react'
import type { GameSummary } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

export function useGameHistoryController() {
  const { token, isGuest } = useAuth()
  const [games, setGames] = useState<GameSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || isGuest) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      try {
        const list = await gameService.getUserGames(token)
        setGames(list)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game history')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [token, isGuest])

  return { games, isLoading, error, isGuest }
}