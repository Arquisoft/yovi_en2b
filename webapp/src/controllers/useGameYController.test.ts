import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGameYController } from './useGameYController'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/contexts/RealtimeContext'
import { gameService } from '@/services/gameyService'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/contexts/RealtimeContext', () => ({ useRealtime: vi.fn() }))
vi.mock('@/services/gameyService', () => ({
  gameService: {
    getGameState: vi.fn(),
    getChatMessages: vi.fn(),
    playMove: vi.fn(),
    surrender: vi.fn(),
    sendChatMessage: vi.fn(),
    waitForBotMove: vi.fn(),
  },
}))
vi.mock('react-router-dom', () => ({
  useParams: () => ({ gameId: 'game-123' }),
  useNavigate: () => vi.fn(),
}))

const mockTransport = {
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
}

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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'user1', username: 'TestUser' } as any,
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
  })
  vi.mocked(useRealtime).mockReturnValue(mockTransport as any)
  vi.mocked(gameService.getGameState).mockResolvedValue(mockGame as any)
  vi.mocked(gameService.getChatMessages).mockResolvedValue([])
  vi.mocked(gameService.waitForBotMove).mockResolvedValue(null)
  vi.mocked(gameService.playMove).mockResolvedValue({
    ...mockGame,
    moves: [{ row: 0, col: 0 }],
  } as any)
  vi.mocked(gameService.surrender).mockResolvedValue({
    ...mockGame,
    status: 'finished',
    winner: 'player2',
  } as any)
  vi.mocked(gameService.sendChatMessage).mockResolvedValue({ id: '1', content: 'hi' } as any)
})

describe('useGameYController', () => {
  it('loads game state on mount', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(gameService.getGameState).toHaveBeenCalledWith('game-123')
    expect(result.current.game?.id).toBe('game-123')
  })

  it('sets error if game not found', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue(null)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Game not found')
  })

  it('loads chat messages on mount', async () => {
    vi.mocked(gameService.getChatMessages).mockResolvedValue([
      { id: '1', content: 'hello', gameId: 'game-123', senderId: 'u1', senderName: 'A', timestamp: '' },
    ])
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.chatMessages).toHaveLength(1)
  })

  it('starts polling on mount', async () => {
    renderHook(() => useGameYController())
    await waitFor(() => expect(mockTransport.startPolling).toHaveBeenCalled())
    expect(mockTransport.subscribe).toHaveBeenCalled()
  })

  it('canPlay is true when it is user turn', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(true)
  })

  it('canPlay is false when game is finished', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame, status: 'finished', winner: 'player1',
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(false)
  })

  it('canPlay is false when it is not user turn', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame, currentTurn: 'player2',
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(false)
  })

  it('handleCellClick calls playMove with token', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.handleCellClick(0, 0)
    })
    expect(gameService.playMove).toHaveBeenCalledWith('game-123', 0, 0, 'player1', 'mock-token')
  })

  it('handleCellClick does nothing when canPlay is false', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame, currentTurn: 'player2',
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.handleCellClick(0, 0)
    })
    expect(gameService.playMove).not.toHaveBeenCalled()
  })

  it('handleSurrender calls surrender with token', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.handleSurrender()
    })
    expect(gameService.surrender).toHaveBeenCalledWith('game-123', 'player1', 'mock-token')
  })

  it('handleSendMessage calls sendChatMessage', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.handleSendMessage('hello')
    })
    expect(gameService.sendChatMessage).toHaveBeenCalledWith('game-123', 'user1', 'TestUser', 'hello')
  })

  it('lastMove is null when no moves', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.lastMove).toBeNull()
  })

  it('currentUserId matches authenticated user', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUserId).toBe('user1')
  })

  it('sets error on getGameState failure', async () => {
    vi.mocked(gameService.getGameState).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Network error')
  })
})
