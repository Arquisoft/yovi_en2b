import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRankingController } from './useRankingController'
import { useAuth } from '@/contexts/AuthContext'
import { rankingService } from '@/services/rankingService'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/services/rankingService', () => ({
  rankingService: {
    getRankingByMode: vi.fn(),
  },
}))

// ── Mock data matching backend structure ──────────────────────────────────────

const MOCK_DATA = {
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

// ── Helper ────────────────────────────────────────────────────────────────────

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    token:           'mock-token',
    user: {
      id: '1', username: 'PlayerOne',
      email: 'test@test.com', createdAt: '', updatedAt: '',
    },
    isAuthenticated:  true,
    isLoading:        false,
    isGuest:          false,
    login:            vi.fn(),
    register:         vi.fn(),
    loginAsGuest:     vi.fn(),
    logout:           vi.fn(),
    updateProfile:    vi.fn(),
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
  vi.mocked(rankingService.getRankingByMode).mockImplementation(
    async (_token, mode) => MOCK_DATA[mode as keyof typeof MOCK_DATA] ?? []
  )
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useRankingController', () => {
  it('starts with pve-easy mode selected', () => {
    const { result } = renderHook(() => useRankingController())
    expect(result.current.selectedMode).toBe('pve-easy')
  })

  it('loads entries for pve-easy by default', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.entries.length).toBeGreaterThan(0)
  })

  it('calls rankingService.getRankingByMode with token and mode', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(rankingService.getRankingByMode).toHaveBeenCalledWith('mock-token', 'pve-easy')
  })

  it('changes mode and loads new entries', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setSelectedMode('pve-hard'))
    await waitFor(() => expect(result.current.selectedMode).toBe('pve-hard'))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.entries[0].username).toBe('PlayerFive')
  })

  it('returns currentUsername from auth context', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUsername).toBe('PlayerOne')
  })

  it('returns null currentUsername when no user', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ user: null, isAuthenticated: false }) as any,
    )
    const { result } = renderHook(() => useRankingController())
    expect(result.current.currentUsername).toBeNull()
  })

  it('entries are ordered by rank', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const ranks = result.current.entries.map((e) => e.rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('does not load when token is null', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ token: null, isAuthenticated: false }) as any,
    )
    const { result } = renderHook(() => useRankingController())
    expect(result.current.entries).toHaveLength(0)
    expect(rankingService.getRankingByMode).not.toHaveBeenCalled()
  })

  it('sets error when service throws', async () => {
    vi.mocked(rankingService.getRankingByMode).mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.entries).toHaveLength(0)
  })

  it('sets isLoading true while fetching, false when done', async () => {
    let resolve!: (v: any) => void
    vi.mocked(rankingService.getRankingByMode).mockReturnValueOnce(
      new Promise((res) => { resolve = res })
    )
    const { result } = renderHook(() => useRankingController())
    expect(result.current.isLoading).toBe(true)
    act(() => resolve(MOCK_DATA['pve-easy']))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
})