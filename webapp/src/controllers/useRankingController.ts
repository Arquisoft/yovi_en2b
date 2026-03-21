// webapp/src/controllers/useRankingController.ts

import { useState, useEffect } from 'react'
import type { RankingEntry, RankingMode } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

const MOCK_DATA: Record<RankingMode, RankingEntry[]> = {
  'pve-easy': [
    { rank: 1, username: 'PlayerOne',   wins: 42 },
    { rank: 2, username: 'PlayerTwo',   wins: 38 },
    { rank: 3, username: 'PlayerThree', wins: 31 },
    { rank: 4, username: 'PlayerFour',  wins: 27 },
    { rank: 5, username: 'PlayerFive',  wins: 19 },
  ],
  'pve-medium': [
    { rank: 1, username: 'PlayerTwo',   wins: 29 },
    { rank: 2, username: 'PlayerOne',   wins: 24 },
    { rank: 3, username: 'PlayerFive',  wins: 18 },
    { rank: 4, username: 'PlayerThree', wins: 12 },
    { rank: 5, username: 'PlayerFour',  wins: 9  },
  ],
  'pve-hard': [
    { rank: 1, username: 'PlayerFive',  wins: 11 },
    { rank: 2, username: 'PlayerTwo',   wins: 8  },
    { rank: 3, username: 'PlayerOne',   wins: 5  },
    { rank: 4, username: 'PlayerFour',  wins: 3  },
    { rank: 5, username: 'PlayerThree', wins: 1  },
  ],
}

export function useRankingController() {
  const { token, user } = useAuth()
  const [selectedMode, setSelectedMode] = useState<RankingMode>('pve-easy')
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!token) return

    // TODO: reemplazar con llamada real cuando el backend esté desplegado
    // const data = await rankingService.getRankingByMode(token, selectedMode)
    setIsLoading(true)
    setEntries(MOCK_DATA[selectedMode])
    setIsLoading(false)
  }, [token, selectedMode])

  return {
    selectedMode,
    setSelectedMode,
    entries,
    isLoading,
    currentUsername: user?.username ?? null,
  }
}