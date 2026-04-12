import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGameYController } from './useGameYController'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useParams:   () => ({ gameId: 'game-123' }),
  useNavigate: () => mockNavigate,
}))
vi.mock('@/services/gameyService', () => ({
  gameService: {
    getGameState:    vi.fn(),
    getChatMessages: vi.fn(),
    playMove:        vi.fn(),
    surrender:       vi.fn(),
    sendChatMessage: vi.fn(),
  },
}))

// ── Shared fixtures ───────────────────────────────────────────────────────────

const mockGame = {
  id:          'game-123',
  status:      'playing',
  currentTurn: 'player1',
  winner:      null,
  moves:       [],
  board:       [],
  config:      { mode: 'pve', boardSize: 3, timerEnabled: false },
  players: {
    player1: { id: 'user1', name: 'TestUser', color: 'player1' },
    player2: { id: 'bot',   name: 'Bot',      color: 'player2', isBot: true },
  },
  timer:     null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ── Helper: build a full AuthContextValue mock ────────────────────────────────

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    user:           { id: 'user1', username: 'TestUser' } as any,
    token:          'mock-token',
    isAuthenticated: true,
    isLoading:       false,
    isGuest:         false,
    login:           vi.fn(),
    register:        vi.fn(),
    loginAsGuest:    vi.fn(),
    logout:          vi.fn(),
    updateProfile:   vi.fn(),
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockReset()
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
  vi.mocked(gameService.getGameState).mockResolvedValue(mockGame as any)
  vi.mocked(gameService.getChatMessages).mockResolvedValue([])
  vi.mocked(gameService.playMove).mockResolvedValue({
    ...mockGame,
    moves: [{ row: 0, col: 0 }],
  } as any)
  vi.mocked(gameService.surrender).mockResolvedValue({
    ...mockGame,
    status: 'finished',
    winner: 'player2',
  } as any)
  vi.mocked(gameService.sendChatMessage).mockResolvedValue({
    id: '1', content: 'hi',
  } as any)
})

// ── Core behaviour tests ──────────────────────────────────────────────────────

describe('useGameYController — core behaviour', () => {
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
      {
        id: '1', content: 'hello', gameId: 'game-123',
        senderId: 'u1', senderName: 'A', timestamp: '',
      },
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

  it('handleCellClick calls playMove with token for authenticated user', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.handleCellClick(0, 0)
    })
    expect(gameService.playMove).toHaveBeenCalledWith(
      'game-123', 0, 0, 'player1', 'mock-token',
    )
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

  it('handleSurrender calls surrender with token for authenticated user', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.handleSurrender()
    })
    expect(gameService.surrender).toHaveBeenCalledWith(
      'game-123', 'player1', 'mock-token',
    )
  })

  it('handleSendMessage calls sendChatMessage', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.handleSendMessage('hello')
    })
    expect(gameService.sendChatMessage).toHaveBeenCalledWith(
      'game-123', 'user1', 'TestUser', 'hello',
    )
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
    vi.mocked(gameService.getGameState).mockRejectedValue(
      new Error('Network error'),
    )
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Network error')
  })

  it('handleSurrender uses currentTurn for pvp-local', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame,
      config: { ...mockGame.config, mode: 'pvp-local' },
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.handleSurrender() })
    expect(gameService.surrender).toHaveBeenCalledWith(
      'game-123', 'player1', 'mock-token',
    )
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
        player1RemainingMs: 60000,
        player2RemainingMs: 60000,
        activePlayer:       'player1',
        lastSyncTimestamp:  Date.now(),
      },
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.liveTimer).not.toBeNull()
  })

  it('liveTimer sets loser to 0 on timeout finish', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame,
      status: 'finished',
      winner: 'player1',
      timer: {
        player1RemainingMs: 60000,
        player2RemainingMs: 5000,
        activePlayer:       null,
        lastSyncTimestamp:  Date.now(),
      },
    } as any)
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.liveTimer?.player2RemainingMs).toBe(0)
    expect(result.current.liveTimer?.player1RemainingMs).toBe(60000)
  })
})

// ── Guest mode token tests ────────────────────────────────────────────────────

describe('useGameYController — guest mode (effectiveToken)', () => {
  it('handleCellClick passes undefined token when user is a guest', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({
        token:   'guest',
        isGuest: true,
        user: {
          id: 'guest-abc', username: 'Guest',
          email: '', createdAt: '', updatedAt: '',
        },
      }) as any,
    )

    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame,
      players: {
        player1: { id: 'guest-abc', name: 'Guest', color: 'player1' },
        player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
      },
    } as any)

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleCellClick(0, 0)
    })

    expect(gameService.playMove).toHaveBeenCalledWith(
      'game-123', 0, 0, 'player1', undefined,
    )
  })

  it('handleSurrender passes undefined token when user is a guest', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthMock({
        token:   'guest',
        isGuest: true,
        user: {
          id: 'guest-abc', username: 'Guest',
          email: '', createdAt: '', updatedAt: '',
        },
      }) as any,
    )

    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame,
      players: {
        player1: { id: 'guest-abc', name: 'Guest', color: 'player1' },
        player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
      },
    } as any)

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSurrender()
    })

    expect(gameService.surrender).toHaveBeenCalledWith(
      'game-123', 'player1', undefined,
    )
  })

  it('handleCellClick still passes the JWT for an authenticated user', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleCellClick(0, 0)
    })

    expect(gameService.playMove).toHaveBeenCalledWith(
      'game-123', 0, 0, 'player1', 'mock-token',
    )
  })

  it('handleSurrender still passes the JWT for an authenticated user', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSurrender()
    })

    expect(gameService.surrender).toHaveBeenCalledWith(
      'game-123', 'player1', 'mock-token',
    )
  })
})

describe('useGameYController — missing branch coverage', () => {
  it('handleCellClick sets moveError on failure and reverts board', async () => {
    vi.mocked(gameService.playMove).mockRejectedValue(new Error('Invalid move'))

    const gameWithBoard = {
      ...mockGame,
      board: [[{ row: 0, col: 0, owner: null }]],
    }
    vi.mocked(gameService.getGameState).mockResolvedValue(gameWithBoard as any)

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleCellClick(0, 0)
    })

    expect(result.current.moveError).toBe('Invalid move')
    // Board reverts to snapshot (owner is null again)
    expect(result.current.game?.board[0][0].owner).toBeNull()
  })

  it('handleCellClick sets generic moveError for non-Error rejections', async () => {
    vi.mocked(gameService.playMove).mockRejectedValue('unknown')

    const gameWithBoard = {
      ...mockGame,
      board: [[{ row: 0, col: 0, owner: null }]],
    }
    vi.mocked(gameService.getGameState).mockResolvedValue(gameWithBoard as any)

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleCellClick(0, 0)
    })

    expect(result.current.moveError).toBe('Failed to play move')
  })

  it('handleSendMessage does nothing when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ user: null }) as any)

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSendMessage('hello')
    })

    expect(gameService.sendChatMessage).not.toHaveBeenCalled()
  })

  it('handlePlayAgain does nothing when game is null', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue(null)

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // game is null (error state), handlePlayAgain should early-return without navigating
    act(() => { result.current.handlePlayAgain() })
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('handlePlayAgain navigates to config route with game mode', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.handlePlayAgain() })

    expect(mockNavigate).toHaveBeenCalledWith('/games/y/config/pve')
  })

  it('canPlay is true for pvp-local regardless of user id', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValue({
      ...mockGame,
      config: { ...mockGame.config, mode: 'pvp-local' },
      currentTurn: 'player2',
    } as any)

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.canPlay).toBe(true)
  })

  it('currentUserId is empty string when user is null', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ user: null }) as any)

    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.currentUserId).toBe('')
  })
})
