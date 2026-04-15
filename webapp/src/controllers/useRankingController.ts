// webapp/src/controllers/useRankingController.ts

import { useState, useEffect } from 'react'
import type { RankingEntry, RankingMode } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { rankingService } from '@/services/rankingService'

export function useRankingController() {
  const { token, user } = useAuth()
  const [selectedMode, setSelectedMode] = useState<RankingMode>('pve-easy')
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await rankingService.getRankingByMode(token, selectedMode)
        setEntries(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ranking')
        setEntries([])
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [token, selectedMode])

  return {
    selectedMode,
    setSelectedMode,
    entries,
    isLoading,
    error,
    currentUsername: user?.username ?? null,
  }
}