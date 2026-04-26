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

// Objeto de respuesta paginado estándar para los tests
const mockPaginatedResponse = {
  games: [mockSummary],
  total: 1,
  totalFinished: 1,
  page: 1,
  totalPages: 1,
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
  
  // Seteamos el mock por defecto para un usuario autenticado
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
  
  // Seteamos la respuesta exitosa por defecto
  vi.mocked(gameService.getUserGames).mockResolvedValue(mockPaginatedResponse as any)
})

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

  it('calls getUserGames with the auth token and current page', async () => {
    renderHook(() => useGameHistoryController())
    // Ahora el controlador pasa el token Y la página (por defecto 1)
    await waitFor(() => {
      expect(gameService.getUserGames).toHaveBeenCalledWith('mock-token', 1)
    })
  })

  it('populates games and pagination metadata from the service response', async () => {
    const { result } = renderHook(() => useGameHistoryController())
    
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    
    expect(result.current.games).toHaveLength(1)
    expect(result.current.games[0].id).toBe('g1')
    expect(result.current.totalFinished).toBe(1)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.page).toBe(1)
  })

  it('updates page and fetches new data when goToPage is called', async () => {
    const { result } = renderHook(() => useGameHistoryController())
    
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    
    // Llamamos a cambiar de página
    result.current.goToPage(2)
    
    await waitFor(() => {
      expect(gameService.getUserGames).toHaveBeenCalledWith('mock-token', 2)
    })
  })

  it('error is null on successful load', async () => {
    const { result } = renderHook(() => useGameHistoryController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeNull()
  })

  it('sets error message when service throws an Error', async () => {
    vi.mocked(gameService.getUserGames).mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useGameHistoryController())
    
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Network error')
    expect(result.current.games).toHaveLength(0)
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

  it('isLoading is immediately false for guests', () => {
    const { result } = renderHook(() => useGameHistoryController())
    expect(result.current.isLoading).toBe(false)
  })
})