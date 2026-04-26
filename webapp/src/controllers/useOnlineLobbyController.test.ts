// webapp/src/controllers/useOnlineLobbyController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOnlineLobbyController } from './useOnlineLobbyController'
import { useAuth } from '@/contexts/AuthContext'
import { wsService } from '@/services/websocketService'

// --- Mocks ---

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

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
  useNavigate: () => mockNavigate,
}))

// --- Helpers ---

function makeAuth(overrides: Record<string, any> = {}) {
  return {
    token: 'jwt-token',
    isGuest: false,
    user: { id: 'u1', username: 'Alice', email: '', createdAt: '', updatedAt: '' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    loginAsGuest: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
    ...overrides,
  }
}

/**
 * Simulates a WS event by calling the handler registered via wsService.on().
 */
function emitWsEvent(type: string, payload: Record<string, any> = {}) {
  const calls = vi.mocked(wsService.on).mock.calls
  const call = calls.find(([t]) => t === type)
  if (!call) throw new Error(`No handler registered for "${type}"`)
  const handler = call[1] as (data: Record<string, any>) => void
  handler({ type, ...payload })
}

beforeEach(() => {
  // Reset call history without wiping mock implementations
  vi.mocked(wsService.connect).mockReset()
  vi.mocked(wsService.disconnect).mockReset()
  vi.mocked(wsService.send).mockReset()
  vi.mocked(wsService.on).mockReset()
  vi.mocked(wsService.isConnected).mockReset()
  mockNavigate.mockReset()

  // Re-establish return values after reset
  vi.mocked(useAuth).mockReturnValue(makeAuth() as any)
  vi.mocked(wsService.connect).mockResolvedValue(undefined)
  vi.mocked(wsService.on).mockReturnValue(() => {})
  vi.mocked(wsService.isConnected).mockReturnValue(false)
})

// --- Tests ---

describe('useOnlineLobbyController — initial state', () => {
  it('starts with status "connecting" and null states', () => {
    const { result } = renderHook(() => useOnlineLobbyController())
    expect(result.current.status).toBe('connecting')
    expect(result.current.opponentName).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

describe('useOnlineLobbyController — connection', () => {
  it('calls wsService.connect with the token and sends join_queue', async () => {
    renderHook(() => useOnlineLobbyController())

    await waitFor(() => {
      expect(wsService.connect).toHaveBeenCalledWith('jwt-token')
      expect(wsService.send).toHaveBeenCalledWith({ type: 'join_queue' })
    })
  })

  it('transitions to "queuing" when queue_joined is received', async () => {
    const { result } = renderHook(() => useOnlineLobbyController())

    // Wait for connect to finish so handlers are registered
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => {
      emitWsEvent('queue_joined', { queueSize: 5 })
    })

    expect(result.current.status).toBe('queuing')
    expect(result.current.queueSize).toBe(5)
  })

  it('redirects to /login when guest or no token', () => {
    vi.mocked(useAuth).mockReturnValue(makeAuth({ token: null, isGuest: true }) as any)
    renderHook(() => useOnlineLobbyController())

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    expect(wsService.connect).not.toHaveBeenCalled()
  })

  it('sets error status when connect fails', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('Timeout'))
    const { result } = renderHook(() => useOnlineLobbyController())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('Timeout')
    })
  })
})

// --- matched event ---

describe('useOnlineLobbyController — matched event', () => {
  it('sets status to "matched" and stores opponentName', async () => {
    const { result } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => {
      emitWsEvent('matched', { opponentName: 'Bob', gameId: 'game-42', playerColor: 'player1' })
    })

    expect(result.current.status).toBe('matched')
    expect(result.current.opponentName).toBe('Bob')
  })

  it('navigates to the game page after 1200 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderHook(() => useOnlineLobbyController())
      await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

      act(() => {
        emitWsEvent('matched', { opponentName: 'Bob', gameId: 'game-42' })
      })

      // Before the timeout fires, navigate should NOT have been called
      expect(mockNavigate).not.toHaveBeenCalledWith('/games/y/play/game-42')

      act(() => {
        vi.advanceTimersByTime(1200)
      })

      expect(mockNavigate).toHaveBeenCalledWith('/games/y/play/game-42')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT navigate if component unmounts before the 1200 ms timeout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { unmount } = renderHook(() => useOnlineLobbyController())
      await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

      act(() => {
        emitWsEvent('matched', { opponentName: 'Bob', gameId: 'game-42' })
      })

      // Unmount before the timeout fires (matched → cleanup should NOT send leave_queue)
      act(() => {
        unmount()
      })

      act(() => {
        vi.advanceTimersByTime(1200)
      })

      // navigate to game page must NOT have been called
      expect(mockNavigate).not.toHaveBeenCalledWith('/games/y/play/game-42')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does NOT send leave_queue on unmount when already matched', async () => {
    const { unmount } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => {
      emitWsEvent('matched', { opponentName: 'Bob', gameId: 'game-42' })
    })

    act(() => { unmount() })

    const leaveCalls = vi.mocked(wsService.send).mock.calls.filter(
      ([msg]: any) => msg.type === 'leave_queue',
    )
    expect(leaveCalls).toHaveLength(0)
  })
})

// --- error event ---

describe('useOnlineLobbyController — WS error event', () => {
  it('sets status to "error" and stores the message', async () => {
    const { result } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => {
      emitWsEvent('error', { message: 'MATCH_FAILED' })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('MATCH_FAILED')
  })

  it('falls back to "An error occurred" when message is absent', async () => {
    const { result } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => {
      emitWsEvent('error', {})
    })

    expect(result.current.error).toBe('An error occurred')
  })

  it('ignores the error event after unmount (mounted guard)', async () => {
    const { result, unmount } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    // Capture the error handler before unmount unregisters it
    const calls = vi.mocked(wsService.on).mock.calls
    const errorCall = calls.find(([t]) => t === 'error')!
    const handler = errorCall[1] as (data: Record<string, any>) => void

    act(() => { unmount() })

    // Fire the event directly after unmount — state must NOT change
    act(() => {
      handler({ type: 'error', message: 'late error' })
    })

    expect(result.current.status).toBe('connecting')
    expect(result.current.error).toBeNull()
  })
})

// --- leaveQueue ---

describe('useOnlineLobbyController — leaveQueue', () => {
  it('sends leave_queue, disconnects and navigates to /games/y', async () => {
    const { result } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => {
      result.current.leaveQueue()
    })

    expect(wsService.send).toHaveBeenCalledWith({ type: 'leave_queue' })
    expect(wsService.disconnect).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/games/y')
  })

  it('resets matchedRef so cleanup also sends leave_queue if needed', async () => {
    const { result, unmount } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    // Simulate match first, then user manually leaves before timeout
    act(() => {
      emitWsEvent('matched', { opponentName: 'Bob', gameId: 'game-1' })
    })

    act(() => {
      result.current.leaveQueue()
    })

    // leaveQueue resets matchedRef → cleanup on unmount sends leave_queue again
    vi.mocked(wsService.send).mockClear()
    act(() => { unmount() })

    // The cleanup in the effect fires leave_queue because matchedRef was reset to false
    const leaveCalls = vi.mocked(wsService.send).mock.calls.filter(
      ([msg]: any) => msg.type === 'leave_queue',
    )
    expect(leaveCalls.length).toBeGreaterThanOrEqual(1)
  })
})

// --- retry ---

describe('useOnlineLobbyController — retry', () => {
  it('resets status to "connecting" and clears error', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('Timeout'))
    const { result } = renderHook(() => useOnlineLobbyController())

    await waitFor(() => expect(result.current.status).toBe('error'))

    // Mock connect to succeed on the retry
    vi.mocked(wsService.connect).mockResolvedValue(undefined)

    act(() => {
      result.current.retry()
    })

    expect(result.current.status).toBe('connecting')
    expect(result.current.error).toBeNull()
  })

  it('re-calls wsService.connect on retry', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('Timeout'))
    const { result } = renderHook(() => useOnlineLobbyController())

    await waitFor(() => expect(result.current.status).toBe('error'))

    vi.mocked(wsService.connect).mockResolvedValue(undefined)

    act(() => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(wsService.connect).toHaveBeenCalledTimes(2)
    })
  })

  it('sends join_queue again after a successful retry', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('Timeout'))
    const { result } = renderHook(() => useOnlineLobbyController())

    await waitFor(() => expect(result.current.status).toBe('error'))

    vi.mocked(wsService.send).mockClear()
    vi.mocked(wsService.connect).mockResolvedValue(undefined)

    act(() => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(wsService.send).toHaveBeenCalledWith({ type: 'join_queue' })
    })
  })
})

// --- cleanup / unmount ---

describe('useOnlineLobbyController — cleanup', () => {
  it('unsubscribes all WS handlers on unmount', async () => {
    const unsub = vi.fn()
    vi.mocked(wsService.on).mockReturnValue(unsub)

    const { unmount } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => { unmount() })

    // Three handlers registered (queue_joined, matched, error) → each unsubbed
    expect(unsub).toHaveBeenCalledTimes(3)
  })

  it('sends leave_queue on unmount when still in queue (not matched)', async () => {
    const { unmount } = renderHook(() => useOnlineLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => {
      emitWsEvent('queue_joined', { queueSize: 1 })
    })

    vi.mocked(wsService.send).mockClear()
    act(() => { unmount() })

    expect(wsService.send).toHaveBeenCalledWith({ type: 'leave_queue' })
  })
})