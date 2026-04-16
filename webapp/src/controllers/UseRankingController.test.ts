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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockEntriesEasy = [
  { rank: 1, username: 'PlayerOne', wins: 42 },
  { rank: 2, username: 'PlayerTwo', wins: 38 },
  { rank: 3, username: 'PlayerThree', wins: 31 },
  { rank: 4, username: 'PlayerFour', wins: 27 },
  { rank: 5, username: 'PlayerFive', wins: 19 },
]

const mockEntriesHard = [
  { rank: 1, username: 'PlayerFive', wins: 11 },
  { rank: 2, username: 'PlayerTwo', wins: 8 },
]

// ── Helper ────────────────────────────────────────────────────────────────────

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    token: 'mock-token',
    user: {
      id: '1',
      username: 'PlayerOne',
      email: 'test@test.com',
      createdAt: '',
      updatedAt: '',
    },
    isAuthenticated: true,
    isLoading: false,
    isGuest: false,
    login: vi.fn(),
    register: vi.fn(),
    loginAsGuest: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
  vi.mocked(rankingService.getRankingByMode).mockResolvedValue(mockEntriesEasy)
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
    expect(rankingService.getRankingByMode).toHaveBeenCalledWith('mock-token', 'pve-easy')
  })

  it('changes mode and loads new entries', async () => {
    vi.mocked(rankingService.getRankingByMode).mockResolvedValueOnce(mockEntriesEasy)
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    vi.mocked(rankingService.getRankingByMode).mockResolvedValueOnce(mockEntriesHard)
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

  it('does not load for guest users', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ token: 'guest', isGuest: true }) as any,
    )
    const { result } = renderHook(() => useRankingController())
    expect(result.current.entries).toHaveLength(0)
    expect(rankingService.getRankingByMode).not.toHaveBeenCalled()
  })

  it('sets error when API call fails', async () => {
    vi.mocked(rankingService.getRankingByMode).mockRejectedValueOnce(new Error('Server error'))
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Server error')
    expect(result.current.entries).toHaveLength(0)
  })

  it('sets generic error for non-Error rejections', async () => {
    vi.mocked(rankingService.getRankingByMode).mockRejectedValueOnce('network failure')
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Failed to load ranking')
  })

  it('calls rankingService with correct token and mode', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ token: 'my-special-token' }) as any)
    renderHook(() => useRankingController())
    await waitFor(() =>
      expect(rankingService.getRankingByMode).toHaveBeenCalledWith('my-special-token', 'pve-easy')
    )
  })
})