import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGameHistoryController } from '@/controllers/useGameHistoryController'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/gameyService', () => ({
  gameService: { getUserGames: vi.fn() },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockSummary = {
  id: 'g1',
  config: { mode: 'pvp-local', boardSize: 5, timerEnabled: false },
  status: 'finished',
  phase: 'playing',
  players: {
    player1: { id: 'u1', name: 'Alice', color: 'player1' },
    player2: { id: 'u2', name: 'Bob', color: 'player2' },
  },
  winner: 'player1',
  moveCount: 12,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    token: 'mock-token',
    user: { id: 'u1', username: 'Alice', email: 'a@b.com', createdAt: '', updatedAt: '' },
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
  vi.mocked(gameService.getUserGames).mockResolvedValue({ 
    games: [mockSummary],
    total: 1,
    totalFinished: 1,
    page: 1,
    totalPages: 1
  } as any)})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useGameHistoryController — authenticated user', () => {
  it('starts with isLoading true while fetching', () => {
    const { result } = renderHook(() => useGameHistoryController())
    expect(result.current.isLoading).toBe(true)
  })

  it('sets isLoading false after data loads', async () => {
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('calls getUserGames with the auth token', async () => {
    renderHook(() => useGameHistoryController())
    await waitFor(() => expect(gameService.getUserGames).toHaveBeenCalledWith('mock-token'))
  })

  it('populates games from the service response', async () => {
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.games).toHaveLength(1)
    expect(result.current.games[0].id).toBe('g1')
  })

  it('error is null on successful load', async () => {
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeNull()
  })

  it('isGuest is false for authenticated user', async () => {
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isGuest).toBe(false)
  })

  it('handles empty game list', async () => {
  const mockEmptyResponse = { games: [], total: 0, totalFinished: 0, page: 1, totalPages: 0 };  
    vi.mocked(gameService.getUserGames).mockResolvedValueOnce(mockEmptyResponse)
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.games).toHaveLength(0)
  })

  it('sets error message when service throws an Error', async () => {
    vi.mocked(gameService.getUserGames).mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.games).toHaveLength(0)
  })

  it('sets generic error message for non-Error rejections', async () => {
    vi.mocked(gameService.getUserGames).mockRejectedValueOnce('timeout')
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Failed to load game history')
  })
})

describe('useGameHistoryController — guest user', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ token: 'guest', isGuest: true }) as any
    )
  })

  it('does not call getUserGames for guests', () => {
    renderHook(() => useGameHistoryController())
    expect(gameService.getUserGames).not.toHaveBeenCalled()
  })

  it('isLoading is immediately false for guests (no async work)', () => {
    const { result } = renderHook(() => useGameHistoryController())
    expect(result.current.isLoading).toBe(false)
  })

  it('games is empty for guests', () => {
    const { result } = renderHook(() => useGameHistoryController())
    expect(result.current.games).toHaveLength(0)
  })

  it('isGuest is true', () => {
    const { result } = renderHook(() => useGameHistoryController())
    expect(result.current.isGuest).toBe(true)
  })
})

describe('useGameHistoryController — no token', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({ token: null, isAuthenticated: false }) as any
    )
  })

  it('does not call getUserGames when token is null', () => {
    renderHook(() => useGameHistoryController())
    expect(gameService.getUserGames).not.toHaveBeenCalled()
  })

  it('isLoading becomes false without fetching', async () => {
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
})