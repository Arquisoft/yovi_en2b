import { useState, useEffect } from 'react'
import type { GameSummary } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

export function useGameHistoryController() {
  const { token, isGuest } = useAuth()
  
  // 1. Keep the array of games
  const [games, setGames] = useState<GameSummary[]>([])
  
  // 2. Add states for the missing pagination properties
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
        const response = await gameService.getUserGames(token)
        
        // 3. Extract properties from the PaginatedGames object
        setGames(response.games)
        setTotalFinished(response.totalFinished)
        setPage(response.page)
        setTotalPages(response.totalPages)
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load game history')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [token, isGuest, page]) // Added page to dependencies if you want it to refresh on change

  // 4. Create the goToPage function expected by GameHistoryPage.tsx
  const goToPage = (newPage: number) => {
    setPage(newPage)
  }

  // 5. Return all the properties the UI is currently complaining are missing
  return { 
    games, 
    isLoading, 
    error, 
    isGuest, 
    totalFinished, 
    page, 
    totalPages, 
    goToPage 
  }
}