import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGameYController } from './useGameYController'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'
import { wsService } from '@/services/websocketService'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/websocketService', () => ({
  wsService: {
    connect: vi.fn(), disconnect: vi.fn(), send: vi.fn(),
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
    getGameState: vi.fn(), getChatMessages: vi.fn(),
    playMove: vi.fn(), surrender: vi.fn(),
    sendChatMessage: vi.fn(), decidePie: vi.fn(),
  },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockGame = {
  id: 'game-123', status: 'playing', currentTurn: 'player1', winner: null,
  moves: [], board: [], config: { mode: 'pve', boardSize: 3, timerEnabled: false },
  players: {
    player1: { id: 'user1', name: 'TestUser', color: 'player1' },
    player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
  },
  timer: null, phase: 'playing',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
}

const mockOnlineGame = {
  ...mockGame,
  config: { mode: 'pvp-online', boardSize: 11, timerEnabled: true, timerSeconds: 600 },
  players: {
    player1: { id: 'user1', name: 'Alice', color: 'player1' },
    player2: { id: 'user2', name: 'Bob', color: 'player2' },
  },
}

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user1', username: 'TestUser' } as any,
    token: 'mock-token', isAuthenticated: true, isLoading: false,
    isGuest: false, login: vi.fn(), register: vi.fn(),
    loginAsGuest: vi.fn(), logout: vi.fn(), updateProfile: vi.fn(),
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
  vi.mocked(gameService.sendChatMessage).mockResolvedValue({ id: '1', content: 'hi' } as any)
  vi.mocked(wsService.on).mockReturnValue(() => {})
})

// ── Core behaviour ────────────────────────────────────────────────────────────

describe('useGameYController — core', () => {
  it('loads game state on mount', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(gameService.getGameState).toHaveBeenCalledWith('game-123')
    expect(result.current.game?.id).toBe('game-123')
  })

  it('sets error when game not found', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue(null)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Game not found')
  })

  it('sets error on getGameState failure', async () => {
    vi.mocked(gameService.getGameState).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Network error')
  })

  it('loads chat messages on mount', async () => {
    vi.mocked(gameService.getChatMessages).mockResolvedValue([
      { id: '1', content: 'hello', gameId: 'game-123', senderId: 'u1', senderName: 'A', timestamp: '' },
    ])
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.chatMessages).toHaveLength(1)
  })

  it('canPlay is true when it is user turn', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(true)
  })

  it('canPlay is false when game is finished', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({ ...mockGame, status: 'finished', winner: 'player1' } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(false)
  })

  it('canPlay is false when it is not user turn', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({ ...mockGame, currentTurn: 'player2' } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(false)
  })

  it('canPlay is true for pvp-local regardless of user id', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame, config: { ...mockGame.config, mode: 'pvp-local' }, currentTurn: 'player2',
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(true)
  })

  it('handleCellClick calls playMove with token for authenticated user', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    expect(gameService.playMove).toHaveBeenCalledWith('game-123', 0, 0, 'player1', 'mock-token')
  })

  it('handleCellClick does nothing when canPlay is false', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({ ...mockGame, currentTurn: 'player2' } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    expect(gameService.playMove).not.toHaveBeenCalled()
  })

  it('handleSurrender calls REST surrender for pve', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleSurrender() })
    expect(gameService.surrender).toHaveBeenCalledWith('game-123', 'player1', 'mock-token')
  })

  it('handleSurrender uses currentTurn for pvp-local', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame, config: { ...mockGame.config, mode: 'pvp-local' },
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleSurrender() })
    expect(gameService.surrender).toHaveBeenCalledWith('game-123', 'player1', 'mock-token')
  })

  it('handleSendMessage calls sendChatMessage', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleSendMessage('hello') })
    expect(gameService.sendChatMessage).toHaveBeenCalledWith('game-123', 'user1', 'TestUser', 'hello')
  })

  it('handleSendMessage does nothing when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ user: null }) as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleSendMessage('hello') })
    expect(gameService.sendChatMessage).not.toHaveBeenCalled()
  })

  it('handlePlayAgain navigates to config route for pve', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.handlePlayAgain())
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/config/pve')
  })

  it('handlePlayAgain does nothing when game is null', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue(null)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.handlePlayAgain())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('lastMove is null when no moves', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.lastMove).toBeNull()
  })

  it('liveTimer is null when game has no timer', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.liveTimer).toBeNull()
  })

  it('liveTimer is set when game has timer', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame,
      timer: {
        player1RemainingMs: 60000, player2RemainingMs: 60000,
        activePlayer: 'player1', lastSyncTimestamp: Date.now(),
      },
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.liveTimer).not.toBeNull()
  })

  it('liveTimer sets loser to 0 on timeout finish', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame, status: 'finished', winner: 'player1',
      timer: {
        player1RemainingMs: 60000, player2RemainingMs: 5000,
        activePlayer: null, lastSyncTimestamp: Date.now(),
      },
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.liveTimer?.player2RemainingMs).toBe(0)
    expect(result.current.liveTimer?.player1RemainingMs).toBe(60000)
  })

  it('currentUserId matches authenticated user', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUserId).toBe('user1')
  })

  it('currentUserId is empty string when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ user: null }) as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUserId).toBe('')
  })
})

// ── pvp-online specific behaviour ─────────────────────────────────────────────

describe('useGameYController — pvp-online', () => {
  beforeEach(() => {
    vi.mocked(gameService.getGameState).mockResolvedValue(mockOnlineGame as any)
  })

  it('registers WS listeners for pvp-online game', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(wsService.on).toHaveBeenCalledWith('game_update', expect.any(Function))
    expect(wsService.on).toHaveBeenCalledWith('opponent_disconnected', expect.any(Function))
    expect(wsService.on).toHaveBeenCalledWith('opponent_reconnected', expect.any(Function))
  })

  it('does NOT register WS listeners for pve game', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue(mockGame as any)
    renderHook(() => useGameYController())
    await waitFor(() => expect(gameService.getGameState).toHaveBeenCalled())
    const gameUpdateCalls = vi.mocked(wsService.on).mock.calls.filter(([t]) => t === 'game_update')
    expect(gameUpdateCalls).toHaveLength(0)
  })

  it('sets game state when game_update WS event fires', async () => {
    let gameUpdateHandler: ((data: any) => void) | null = null
    vi.mocked(wsService.on).mockImplementation((type, handler) => {
      if (type === 'game_update') gameUpdateHandler = handler as any
      return () => {}
    })
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const updatedGame = { ...mockOnlineGame, moves: [{ row: 1, col: 0, player: 'player2', timestamp: 1 }] }
    act(() => gameUpdateHandler?.({ type: 'game_update', game: updatedGame }))
    expect(result.current.game?.moves).toHaveLength(1)
  })

  it('sets opponentDisconnected true on opponent_disconnected event', async () => {
    let disconnectedHandler: ((data: any) => void) | null = null
    vi.mocked(wsService.on).mockImplementation((type, handler) => {
      if (type === 'opponent_disconnected') disconnectedHandler = handler as any
      return () => {}
    })
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.opponentDisconnected).toBe(false)
    act(() => disconnectedHandler?.({ type: 'opponent_disconnected', gracePeriodMs: 30000 }))
    expect(result.current.opponentDisconnected).toBe(true)
  })

  it('clears opponentDisconnected on opponent_reconnected event', async () => {
    let disconnectedHandler: ((data: any) => void) | null = null
    let reconnectedHandler: ((data: any) => void) | null = null
    vi.mocked(wsService.on).mockImplementation((type, handler) => {
      if (type === 'opponent_disconnected') disconnectedHandler = handler as any
      if (type === 'opponent_reconnected') reconnectedHandler = handler as any
      return () => {}
    })
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => disconnectedHandler?.({ type: 'opponent_disconnected', gracePeriodMs: 30000 }))
    expect(result.current.opponentDisconnected).toBe(true)
    act(() => reconnectedHandler?.({ type: 'opponent_reconnected' }))
    expect(result.current.opponentDisconnected).toBe(false)
  })

  it('handleSurrender sends WS message for pvp-online', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleSurrender() })
    expect(wsService.send).toHaveBeenCalledWith({ type: 'surrender', gameId: 'game-123' })
    expect(gameService.surrender).not.toHaveBeenCalled()
  })

  it('handlePlayAgain disconnects WS and navigates to online lobby', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.handlePlayAgain())
    expect(wsService.disconnect).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/online')
  })

  it('unsubscribes WS listeners on unmount', async () => {
    const unsub = vi.fn()
    vi.mocked(wsService.on).mockReturnValue(unsub)
    const { unmount } = renderHook(() => useGameYController())
    await waitFor(() => expect(gameService.getGameState).toHaveBeenCalled())
    unmount()
    expect(unsub).toHaveBeenCalled()
  })

  it('canPlay is true for pvp-online when it is the user turn', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(true)
  })

  it('canPlay is false for pvp-online when it is the opponent turn', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({ ...mockOnlineGame, currentTurn: 'player2' } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.canPlay).toBe(false)
  })
})

// ── Guest mode / effectiveToken ───────────────────────────────────────────────

describe('useGameYController — guest mode', () => {
  const guestAuth = {
    token: 'guest', isGuest: true,
    user: { id: 'guest-abc', username: 'Guest', email: '', createdAt: '', updatedAt: '' },
  }
  const guestGame = {
    ...mockGame,
    players: {
      player1: { id: 'guest-abc', name: 'Guest', color: 'player1' },
      player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
    },
  }

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock(guestAuth) as any)
    vi.mocked(gameService.getGameState).mockResolvedValue(guestGame as any)
  })

  it('handleCellClick passes undefined token for guests', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    expect(gameService.playMove).toHaveBeenCalledWith('game-123', 0, 0, 'player1', undefined)
  })

  it('handleSurrender passes undefined token for guests', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleSurrender() })
    expect(gameService.surrender).toHaveBeenCalledWith('game-123', 'player1', undefined)
  })

  it('handleCellClick still passes the JWT for an authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
    vi.mocked(gameService.getGameState).mockResolvedValue(mockGame as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    expect(gameService.playMove).toHaveBeenCalledWith('game-123', 0, 0, 'player1', 'mock-token')
  })

  it('handleSurrender still passes the JWT for an authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
    vi.mocked(gameService.getGameState).mockResolvedValue(mockGame as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleSurrender() })
    expect(gameService.surrender).toHaveBeenCalledWith('game-123', 'player1', 'mock-token')
  })
})

// ── Error handling ────────────────────────────────────────────────────────────

describe('useGameYController — error handling', () => {
  it('sets moveError on playMove failure and reverts board', async () => {
    vi.mocked(gameService.playMove).mockRejectedValue(new Error('Invalid move'))
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame, board: [[{ row: 0, col: 0, owner: null }]],
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    expect(result.current.moveError).toBe('Invalid move')
    expect(result.current.game?.board[0][0].owner).toBeNull()
  })

  it('sets generic moveError for non-Error rejections', async () => {
    vi.mocked(gameService.playMove).mockRejectedValue('unknown')
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame, board: [[{ row: 0, col: 0, owner: null }]],
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleCellClick(0, 0) })
    expect(result.current.moveError).toBe('Failed to play move')
  })
})