// webapp/src/controllers/useStatsController.test.ts
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockHistory = [
  {
    id: '1',
    opponentName: 'Bot (medium)',
    result: 'win',
    durationSeconds: 142,
    playedAt: new Date().toISOString(),
  },
  {
    id: '2',
    opponentName: 'PlayerTwo',
    result: 'loss',
    durationSeconds: 87,
    playedAt: new Date().toISOString(),
  },
]

const mockStats = {
  overall: { wins: 8, losses: 4, total: 12 },
  recent:  { wins: 3, losses: 2, total: 5  },
}

// ── Helper: build a full AuthContextValue mock ────────────────────────────────

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    token:          'mock-token',
    user:           null,
    isAuthenticated: true,
    isLoading:       false,
    isGuest:         false,   // ← required by AuthContextValue
    login:           vi.fn(),
    register:        vi.fn(),
    loginAsGuest:    vi.fn(), // ← required by AuthContextValue
    logout:          vi.fn(),
    updateProfile:   vi.fn(),
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset all mock state (call counts, return values) before each test so that
  // assertions like `not.toHaveBeenCalled()` only observe the current test's
  // calls and not those accumulated from previous tests in the same file.
  vi.clearAllMocks()

  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
  vi.mocked(statsService.getMatchHistory).mockResolvedValue(mockHistory as any)
  vi.mocked(statsService.getWinrate).mockResolvedValue(mockStats)
})

// ── Original tests (unchanged logic, mocks now include isGuest) ───────────────

describe('useStatsController — authenticated user', () => {
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
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ token: null, isAuthenticated: false }) as any,
    )
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

// ── NEW: guest-mode tests ─────────────────────────────────────────────────────

describe('useStatsController — isGuest flag', () => {
  /**
   * Authenticated users should see isGuest === false so the stats page renders
   * the full charts/history view.
   */
  it('returns isGuest false for an authenticated user', async () => {
    const { result } = renderHook(() => useStatsController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isGuest).toBe(false)
  })

  /**
   * When the guest token ('guest') is active, useAuth returns isGuest: true.
   * The controller must propagate that flag so StatsPage can render the upsell.
   */
  it('returns isGuest true when the guest token is active', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({
        token:  'guest',
        isGuest: true,
        user: {
          id:        'guest-abc',
          username:  'Guest',
          email:     '',
          createdAt: '',
          updatedAt: '',
        },
      }) as any,
    )
    const { result } = renderHook(() => useStatsController())
    expect(result.current.isGuest).toBe(true)
  })

  /**
   * Guests have no backend account so both history and stats must remain empty.
   */
  it('history is empty and stats is null for a guest', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ token: 'guest', isGuest: true }) as any,
    )
    const { result } = renderHook(() => useStatsController())
    expect(result.current.history).toHaveLength(0)
    expect(result.current.stats).toBeNull()
  })

  /**
   * No HTTP calls should be made when the user is a guest — the controller
   * must short-circuit before reaching the fetch logic.
   */
  it('does not call getMatchHistory or getWinrate for a guest', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ token: 'guest', isGuest: true }) as any,
    )
    renderHook(() => useStatsController())
    expect(statsService.getMatchHistory).not.toHaveBeenCalled()
    expect(statsService.getWinrate).not.toHaveBeenCalled()
  })

  /**
   * Because no request is pending, isLoading must be synchronously false for
   * guests — the spinner should never appear on the stats page for them.
   */
  it('isLoading is immediately false for a guest (no async work)', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ token: 'guest', isGuest: true }) as any,
    )
    const { result } = renderHook(() => useStatsController())
    // Check synchronously — no await needed
    expect(result.current.isLoading).toBe(false)
  })
})