import { useState, useEffect } from 'react'
import type { GameSummary } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'
 
export function useGameHistoryController() {
  const { token, isGuest } = useAuth()
  const [games, setGames] = useState<GameSummary[]>([])
  const [totalFinished, setTotalFinished] = useState(0)
  const [page, setPage] = useState(1)  
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || isGuest) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      try {
        setIsLoading(true)
         const response = await gameService.getUserGames(token, page) 
        
        setGames(response.games)
        setTotalFinished(response.totalFinished)
        setTotalPages(response.totalPages)
       } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game history')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [token, isGuest, page]) 

  const goToPage = (newPage: number) => {
     setPage(newPage)
  }

  return { games, isLoading, error, isGuest, totalFinished, page, totalPages, goToPage }
}