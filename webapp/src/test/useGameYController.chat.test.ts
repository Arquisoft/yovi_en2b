import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGameYController } from '@/controllers/useGameYController'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'
import { wsService } from '@/services/websocketService'
import type { GameState } from '@/types'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('react-router-dom', () => ({
  useParams: () => ({ gameId: 'game-123' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

vi.mock('@/services/gameyService', () => ({
  gameService: {
    getGameState: vi.fn(),
    getChatMessages: vi.fn(),
    sendChatMessage: vi.fn(),
    playMove: vi.fn(),
    surrender: vi.fn(),
    decidePie: vi.fn(),
  },
}))

vi.mock('@/services/websocketService', () => ({
  wsService: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    send: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    on: vi.fn().mockReturnValue(vi.fn()),
  },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeGame(mode: 'pvp-online' | 'pvp-local' | 'pve' = 'pvp-online'): GameState {
  return {
    id: 'game-123',
    config: { mode, boardSize: 11, timerEnabled: false },
    status: 'playing',
    phase: 'playing',
    board: [],
    players: {
      player1: { id: 'user-1', name: 'Alice', color: 'player1' },
      player2: { id: 'user-2', name: 'Bob', color: 'player2' },
    },
    currentTurn: 'player1',
    moves: [],
    winner: null,
    timer: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeAuth(overrides: Record<string, unknown> = {}) {
  return {
    token: 'tok-alice',
    user: { id: 'user-1', username: 'Alice', email: 'alice@example.com', createdAt: '', updatedAt: '' },
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

/** Returns the most recently registered handler for the given WS message type */
function getWsHandler(type: string): ((data: any) => void) | undefined {
  const calls = vi.mocked(wsService.on).mock.calls
  const match = [...calls].reverse().find(([t]) => t === type)
  return match?.[1] as ((data: any) => void) | undefined
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue(makeAuth() as any)
  vi.mocked(gameService.getGameState).mockResolvedValue(makeGame())
  vi.mocked(gameService.getChatMessages).mockResolvedValue([])
  vi.mocked(gameService.sendChatMessage).mockResolvedValue({
    id: 'srv-msg-1',
    gameId: 'game-123',
    senderId: 'user-1',
    senderName: 'Alice',
    content: 'hi',
    timestamp: new Date().toISOString(),
  })
  vi.mocked(wsService.on).mockReturnValue(vi.fn())
})

// ─── handleSendMessage — pvp-online ──────────────────────────────────────────

describe('handleSendMessage — pvp-online', () => {
  it('adds the message optimistically to chatMessages', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSendMessage('Hello!')
    })

    expect(result.current.chatMessages).toHaveLength(1)
    expect(result.current.chatMessages[0].content).toBe('Hello!')
    expect(result.current.chatMessages[0].senderId).toBe('user-1')
    expect(result.current.chatMessages[0].senderName).toBe('Alice')
  })

  it('sends a chat_message via WebSocket', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSendMessage('Hello!')
    })

    expect(wsService.send).toHaveBeenCalledWith({
      type: 'chat_message',
      gameId: 'game-123',
      content: 'Hello!',
    })
  })

  it('trims whitespace from content before sending', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSendMessage('  hi there  ')
    })

    expect(result.current.chatMessages[0].content).toBe('hi there')
    expect(wsService.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'hi there' })
    )
  })

  it('does NOT send via WebSocket for whitespace-only content', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const sendCallsBefore = vi.mocked(wsService.send).mock.calls.length

    await act(async () => {
      await result.current.handleSendMessage('   ')
    })

    const newCalls = vi.mocked(wsService.send).mock.calls.slice(sendCallsBefore)
    expect(newCalls.some(([msg]) => msg.type === 'chat_message')).toBe(false)
    expect(result.current.chatMessages).toHaveLength(0)
  })

  it('does NOT call gameService.sendChatMessage in pvp-online mode', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSendMessage('Hello!')
    })

    expect(gameService.sendChatMessage).not.toHaveBeenCalled()
  })

  it('accumulates multiple sent messages in chatMessages', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSendMessage('First')
    })
    await act(async () => {
      await result.current.handleSendMessage('Second')
    })

    expect(result.current.chatMessages).toHaveLength(2)
    expect(result.current.chatMessages[0].content).toBe('First')
    expect(result.current.chatMessages[1].content).toBe('Second')
  })
})

// ─── Incoming chat_message WS event ──────────────────────────────────────────

describe('incoming chat_message WebSocket event — pvp-online', () => {
  it('appends an opponent message to chatMessages', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() =>
      expect(vi.mocked(wsService.on)).toHaveBeenCalledWith('chat_message', expect.any(Function))
    )

    const handler = getWsHandler('chat_message')!

    act(() => {
      handler({
        type: 'chat_message',
        gameId: 'game-123',
        senderId: 'user-2',
        senderName: 'Bob',
        content: 'Good game!',
        timestamp: new Date().toISOString(),
      })
    })

    expect(result.current.chatMessages).toHaveLength(1)
    expect(result.current.chatMessages[0].content).toBe('Good game!')
    expect(result.current.chatMessages[0].senderId).toBe('user-2')
    expect(result.current.chatMessages[0].senderName).toBe('Bob')
  })

  it('assigns a stable id derived from senderId and timestamp', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() =>
      expect(vi.mocked(wsService.on)).toHaveBeenCalledWith('chat_message', expect.any(Function))
    )

    const ts = '2025-01-01T00:00:00.000Z'
    const handler = getWsHandler('chat_message')!

    act(() => {
      handler({
        type: 'chat_message',
        gameId: 'game-123',
        senderId: 'user-2',
        senderName: 'Bob',
        content: 'Hello',
        timestamp: ts,
      })
    })

    expect(result.current.chatMessages[0].id).toBe(`user-2-${ts}`)
  })

  it('accumulates messages from multiple incoming events', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() =>
      expect(vi.mocked(wsService.on)).toHaveBeenCalledWith('chat_message', expect.any(Function))
    )

    const handler = getWsHandler('chat_message')!

    act(() => {
      handler({ type: 'chat_message', gameId: 'game-123', senderId: 'user-2', senderName: 'Bob', content: 'Hi', timestamp: 't1' })
    })
    act(() => {
      handler({ type: 'chat_message', gameId: 'game-123', senderId: 'user-2', senderName: 'Bob', content: 'Ready?', timestamp: 't2' })
    })

    expect(result.current.chatMessages).toHaveLength(2)
  })
})

// ─── handleSendMessage — non-online modes ────────────────────────────────────

describe('handleSendMessage — pvp-local', () => {
  beforeEach(() => {
    vi.mocked(gameService.getGameState).mockResolvedValue(makeGame('pvp-local'))
  })

  it('calls gameService.sendChatMessage instead of wsService.send', async () => {
    const { result } = renderHook(() => useGameYController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.handleSendMessage('Hello local!')
    })

    expect(gameService.sendChatMessage).toHaveBeenCalledWith(
      'game-123', 'user-1', 'Alice', 'Hello local!'
    )
    const chatCalls = vi.mocked(wsService.send).mock.calls.filter(([m]) => m.type === 'chat_message')
    expect(chatCalls).toHaveLength(0)
  })
})
