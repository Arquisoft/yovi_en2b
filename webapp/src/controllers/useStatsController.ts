// webapp/src/controllers/useStatsController.ts
import { useState, useEffect } from 'react'
import type { MatchRecord, StatsData } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { statsService } from '@/services/statsService'

export function useStatsController() {
  const { token } = useAuth()

  const [history, setHistory] = useState<MatchRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const [h, s] = await Promise.all([
          statsService.getMatchHistory(token),
          statsService.getWinrate(token),
        ])
        setHistory(h)
        setStats(s)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [token])

  return { history, stats, isLoading, error }
}