import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useStatsController } from './useStatsController'
import { useAuth } from '@/contexts/AuthContext'
import { statsService } from '@/services/statsService'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/services/statsService', () => ({
  statsService: {
    getMatchHistory: vi.fn(),
    getWinrate: vi.fn(),
  },
}))

const mockHistory = [
  { id: '1', opponentName: 'Bot (medium)', result: 'win', durationSeconds: 142, playedAt: new Date().toISOString() },
  { id: '2', opponentName: 'PlayerTwo', result: 'loss', durationSeconds: 87, playedAt: new Date().toISOString() },
]

const mockStats = {
  overall: { wins: 8, losses: 4, total: 12 },
  recent: { wins: 3, losses: 2, total: 5 },
}

describe('useStatsController', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'mock-token',
      user: null,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
    })
    vi.mocked(statsService.getMatchHistory).mockResolvedValue(mockHistory as any)
    vi.mocked(statsService.getWinrate).mockResolvedValue(mockStats)
  })

  it('starts with isLoading false after mock load', async () => {
    const { result } = renderHook(() => useStatsController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('loads history data', async () => {
    const { result } = renderHook(() => useStatsController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.history.length).toBeGreaterThan(0)
  })

  it('loads stats data', async () => {
    const { result } = renderHook(() => useStatsController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.stats?.overall).toBeDefined()
    expect(result.current.stats?.recent).toBeDefined()
  })

  it('history entries have required fields', async () => {
    const { result } = renderHook(() => useStatsController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    for (const match of result.current.history) {
      expect(match.id).toBeDefined()
      expect(match.opponentName).toBeDefined()
      expect(['win', 'loss']).toContain(match.result)
      expect(typeof match.durationSeconds).toBe('number')
      expect(match.playedAt).toBeDefined()
    }
  })

  it('does not load when token is null', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: null, user: null, isAuthenticated: false, isLoading: false,
      login: vi.fn(), register: vi.fn(), logout: vi.fn(), updateProfile: vi.fn(),
    })
    const { result } = renderHook(() => useStatsController())
    expect(result.current.history).toHaveLength(0)
    expect(result.current.stats).toBeNull()
  })

  it('overall winrate has wins and losses', async () => {
    const { result } = renderHook(() => useStatsController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(typeof result.current.stats?.overall.wins).toBe('number')
    expect(typeof result.current.stats?.overall.losses).toBe('number')
  })

  it('recent winrate has wins and losses', async () => {
    const { result } = renderHook(() => useStatsController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(typeof result.current.stats?.recent.wins).toBe('number')
    expect(typeof result.current.stats?.recent.losses).toBe('number')
  })
})