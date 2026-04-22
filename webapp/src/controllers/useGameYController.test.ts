import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGameYController } from './useGameYController'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'
import { wsService } from '@/services/websocketService'

// --- Mocks Globales ---

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

vi.mock('@/services/websocketService', () => ({
  wsService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
    isConnected: vi.fn().mockReturnValue(false),
  },
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams: () => ({ gameId: 'game-123' }),
  useNavigate: () => mockNavigate,
}))

vi.mock('@/services/gameyService', () => ({
  gameService: {
    getGameState: vi.fn(),
    getChatMessages: vi.fn(),
    playMove: vi.fn(),
    surrender: vi.fn(),
    sendChatMessage: vi.fn(),
    decidePie: vi.fn(),
  },
}))

// --- Fixtures (Datos de prueba) ---

const mockGame = {
  id: 'game-123',
  status: 'playing',
  currentTurn: 'player1',
  winner: null,
  moves: [],
  board: [],
  config: { mode: 'pve', boardSize: 3, timerEnabled: false },
  players: {
    player1: { id: 'user1', name: 'TestUser', color: 'player1' },
    player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
  },
  timer: null,
  phase: 'playing',
}

const mockOnlineGame = {
  ...mockGame,
  config: { mode: 'pvp-online', boardSize: 11, timerEnabled: true, timerSeconds: 600 },
  players: {
    player1: { id: 'user1', name: 'Alice', color: 'player1' },
    player2: { id: 'user2', name: 'Bob', color: 'player2' },
  },
}

function makeAuthMock(overrides: Record<string, any> = {}) {
  return {
    user: { id: 'user1', username: 'TestUser' } as any,
    token: 'mock-token',
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
  mockNavigate.mockReset()
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
  vi.mocked(gameService.getGameState).mockResolvedValue(mockGame as any)
  vi.mocked(gameService.getChatMessages).mockResolvedValue([])
  vi.mocked(gameService.playMove).mockResolvedValue({ ...mockGame, moves: [{ row: 0, col: 0 }] } as any)
  vi.mocked(gameService.surrender).mockResolvedValue({ ...mockGame, status: 'finished', winner: 'player2' } as any)
  vi.mocked(wsService.on).mockReturnValue(() => {})
})

// --- Tests de Comportamiento Core ---

describe('useGameYController — core', () => {
  it('loads game state on mount', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.game?.id).toBe('game-123')
  })

  it('canPlay is true when it is user turn', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(true)
  })

  it('handleCellClick calls playMove service', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    expect(gameService.playMove).toHaveBeenCalledWith('game-123', 0, 0, 'player1', 'mock-token')
  })
})

// --- Tests de Comportamiento Multijugador (Online) ---

describe('useGameYController — pvp-online', () => {
  beforeEach(() => {
    vi.mocked(gameService.getGameState).mockResolvedValue(mockOnlineGame as any)
  })

  it('registers WS listeners for pvp-online game', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(wsService.on).toHaveBeenCalledWith('game_update', expect.any(Function))
    expect(wsService.on).toHaveBeenCalledWith('opponent_disconnected', expect.any(Function))
  })

  it('updates game state when game_update WS event fires', async () => {
    let gameUpdateHandler: ((data: any) => void) | null = null
    vi.mocked(wsService.on).mockImplementation((type, handler) => {
      if (type === 'game_update') gameUpdateHandler = handler as any
      return () => {}
    })

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    
    const updatedGame = { ...mockOnlineGame, moves: [{ row: 1, col: 0, player: 'player2' }] }
    act(() => {
      gameUpdateHandler?.({ type: 'game_update', game: updatedGame })
    })

    expect(result.current.game?.moves).toHaveLength(1)
  })

  it('handleSurrender sends WS message for pvp-online instead of REST', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    
    await act(async () => { await result.current.handleSurrender() })
    
    expect(wsService.send).toHaveBeenCalledWith({ type: 'surrender', gameId: 'game-123' })
    expect(gameService.surrender).not.toHaveBeenCalled()
  })

  it('handlePlayAgain cleans up connection for online matches', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    
    act(() => result.current.handlePlayAgain())
    
    expect(wsService.disconnect).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/online')
  })
})

// --- Casos de Borde y Errores ---

describe('useGameYController — edge cases', () => {
  it('passes undefined token for guest players', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ token: 'guest', isGuest: true }) as any)
    const { result } = renderHook(() => useGameYController())
    
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    
    expect(gameService.playMove).toHaveBeenCalledWith('game-123', 0, 0, 'player1', undefined)
  })

  it('sets moveError when playMove fails', async () => {
    vi.mocked(gameService.playMove).mockRejectedValue(new Error('Invalid position'))
    const { result } = renderHook(() => useGameYController())
    
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    
    expect(result.current.moveError).toBe('Invalid position')
  })
})