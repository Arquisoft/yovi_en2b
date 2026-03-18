// webapp/src/controllers/useStatsController.ts
import { useState, useEffect } from 'react'
import type { MatchRecord, StatsData } from '@/types'
import { useAuth } from '@/contexts/AuthContext'

// para marcos
// import { statsService } from '@/services/statsService'

export function useStatsController() {
  const { token } = useAuth()

  const [history, setHistory] = useState<MatchRecord[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // para marcos tambien :D
  //const [error, setError] = useState<string | null>(null)

  // CODIGO SI HUBIESE BASE DE DATOS (PA MARCOS RODRIGUEZ)
 /** 
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
  */

    useEffect(() => {
    if (!token) return

    // TODO: reemplazar con llamada real cuando el backend esté desplegado
    // const [h, s] = await Promise.all([
    //   statsService.getMatchHistory(token),
    //   statsService.getWinrate(token),
    // ])
    setHistory([
      { id: '1', opponentName: 'Bot (medium)', result: 'win', durationSeconds: 142, playedAt: new Date().toISOString() },
      { id: '2', opponentName: 'PlayerTwo', result: 'loss', durationSeconds: 87, playedAt: new Date().toISOString() },
      { id: '3', opponentName: 'Bot (hard)', result: 'win', durationSeconds: 210, playedAt: new Date().toISOString() },
      { id: '4', opponentName: 'PlayerThree', result: 'loss', durationSeconds: 65, playedAt: new Date().toISOString() },
      { id: '5', opponentName: 'Bot (easy)', result: 'win', durationSeconds: 320, playedAt: new Date().toISOString() },
      { id: '6', opponentName: 'PlayerFour', result: 'win', durationSeconds: 190, playedAt: new Date().toISOString() },
      { id: '7', opponentName: 'Bot (medium)', result: 'loss', durationSeconds: 110, playedAt: new Date().toISOString() },
      { id: '8', opponentName: 'PlayerFive', result: 'win', durationSeconds: 245, playedAt: new Date().toISOString() },
      { id: '9', opponentName: 'Bot (hard)', result: 'loss', durationSeconds: 78, playedAt: new Date().toISOString() },
      { id: '10', opponentName: 'PlayerSix', result: 'win', durationSeconds: 300, playedAt: new Date().toISOString() },
      { id: '11', opponentName: 'Bot (easy)', result: 'win', durationSeconds: 155, playedAt: new Date().toISOString() },
      { id: '12', opponentName: 'PlayerSeven', result: 'loss', durationSeconds: 92, playedAt: new Date().toISOString() },
    ])
    setStats({
      overall: { wins: 8, losses: 4 },
      recent: { wins: 3, losses: 2 },
    })
    setIsLoading(false)
  }, [token])

  return { history, stats, isLoading}
}
