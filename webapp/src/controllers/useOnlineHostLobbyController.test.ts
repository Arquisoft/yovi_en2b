import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOnlineHostLobbyController } from './useOnlineHostLobbyController'
import { useAuth } from '@/contexts/AuthContext'
import { wsService } from '@/services/websocketService'

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

vi.mock('@/utils/onlineConfig', () => ({
  loadOnlineConfig: vi.fn().mockReturnValue({
    boardSize: 11,
    timerEnabled: true,
    timerSeconds: 600,
  }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ variant: 'y' }),
}))

function makeAuth(overrides: Record<string, any> = {}) {
  return {
    token: 'jwt-token',
    isGuest: false,
    user: { id: 'u1', username: 'Alice', email: '', createdAt: '', updatedAt: '' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(), register: vi.fn(), loginAsGuest: vi.fn(), logout: vi.fn(), updateProfile: vi.fn(),
    ...overrides,
  }
}

function emitWsEvent(type: string, payload: Record<string, any> = {}) {
  const calls = vi.mocked(wsService.on).mock.calls
  const call = calls.find(([t]) => t === type)
  if (!call) throw new Error(`No handler registered for "${type}"`)
  const handler = call[1] as (data: Record<string, any>) => void
  handler({ type, ...payload })
}

beforeEach(() => {
  vi.mocked(wsService.connect).mockReset().mockResolvedValue(undefined)
  vi.mocked(wsService.send).mockReset()
  vi.mocked(wsService.on).mockReset().mockReturnValue(() => {})
  vi.mocked(wsService.isConnected).mockReset().mockReturnValue(false)
  vi.mocked(useAuth).mockReturnValue(makeAuth() as any)
  mockNavigate.mockReset()
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('useOnlineHostLobbyController — initial state', () => {
  it('starts with connecting status', () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    expect(result.current.status).toBe('connecting')
  })

  it('roomCode and opponentName are null initially', () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    expect(result.current.roomCode).toBeNull()
    expect(result.current.opponentName).toBeNull()
  })
})

describe('useOnlineHostLobbyController — auth guard', () => {
  it('redirects to /login when user is a guest', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuth({ token: null, isGuest: true }) as any)
    renderHook(() => useOnlineHostLobbyController())
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    expect(wsService.connect).not.toHaveBeenCalled()
  })

  it('redirects to /login when there is no token', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuth({ token: null }) as any)
    renderHook(() => useOnlineHostLobbyController())
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})

describe('useOnlineHostLobbyController — connection setup', () => {
  it('connects with the token and sends create_room on mount', async () => {
    renderHook(() => useOnlineHostLobbyController())

    await waitFor(() => {
      expect(wsService.connect).toHaveBeenCalledWith('jwt-token')
      expect(wsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'create_room' })
      )
    })
  })

  it('skips connect when already connected', async () => {
    vi.mocked(wsService.isConnected).mockReturnValue(true)
    renderHook(() => useOnlineHostLobbyController())

    await waitFor(() => {
      expect(wsService.connect).not.toHaveBeenCalled()
      expect(wsService.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'create_room' })
      )
    })
  })

  it('sets error status when connect throws', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('No server'))
    const { result } = renderHook(() => useOnlineHostLobbyController())

    await waitFor(() => {
      expect(result.current.status).toBe('error')
      expect(result.current.error).toBe('No server')
    })
  })

  it('sets generic error message for non-Error throws', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce('oops')
    const { result } = renderHook(() => useOnlineHostLobbyController())

    await waitFor(() => {
      expect(result.current.error).toBe('Connection failed')
    })
  })
})

describe('useOnlineHostLobbyController — room_created event', () => {
  it('sets roomCode and transitions to waiting', async () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => { emitWsEvent('room_created', { code: 'ABC123' }) })

    expect(result.current.roomCode).toBe('ABC123')
    expect(result.current.status).toBe('waiting')
  })
})

describe('useOnlineHostLobbyController — matched event', () => {
  it('sets opponentName and transitions to matched', async () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => { emitWsEvent('matched', { opponentName: 'Bob', gameId: 'g-1' }) })

    expect(result.current.opponentName).toBe('Bob')
    expect(result.current.status).toBe('matched')
  })

  it('navigates to game page after 1200 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderHook(() => useOnlineHostLobbyController())
      await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

      act(() => { emitWsEvent('matched', { opponentName: 'Bob', gameId: 'g-1' }) })
      expect(mockNavigate).not.toHaveBeenCalledWith('/games/y/play/g-1')

      act(() => { vi.advanceTimersByTime(1200) })
      expect(mockNavigate).toHaveBeenCalledWith('/games/y/play/g-1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not navigate after unmount', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { unmount } = renderHook(() => useOnlineHostLobbyController())
      await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

      act(() => { emitWsEvent('matched', { opponentName: 'Bob', gameId: 'g-1' }) })
      act(() => { unmount() })
      act(() => { vi.advanceTimersByTime(1200) })

      expect(mockNavigate).not.toHaveBeenCalledWith('/games/y/play/g-1')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useOnlineHostLobbyController — error event', () => {
  it('sets error status and message', async () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => { emitWsEvent('error', { message: 'ROOM_FAILED' }) })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('ROOM_FAILED')
  })

  it('falls back to generic message when absent', async () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => { emitWsEvent('error', {}) })
    expect(result.current.error).toBe('An error occurred')
  })
})

describe('useOnlineHostLobbyController — handleCancel', () => {
  it('navigates to /games/y/online', async () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    act(() => { result.current.handleCancel() })
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/online')
  })
})

describe('useOnlineHostLobbyController — handleCopy', () => {
  it('copies roomCode to clipboard and sets copied true', async () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => { emitWsEvent('room_created', { code: 'XYZ789' }) })

    await act(async () => { await result.current.handleCopy() })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('XYZ789')
    expect(result.current.copied).toBe(true)
  })

  it('does nothing when roomCode is null', async () => {
    const { result } = renderHook(() => useOnlineHostLobbyController())
    await act(async () => { await result.current.handleCopy() })
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('resets copied to false after 2000 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { result } = renderHook(() => useOnlineHostLobbyController())
      await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

      act(() => { emitWsEvent('room_created', { code: 'XYZ789' }) })
      await act(async () => { await result.current.handleCopy() })
      expect(result.current.copied).toBe(true)

      act(() => { vi.advanceTimersByTime(2000) })
      expect(result.current.copied).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useOnlineHostLobbyController — handleRetry', () => {
  it('resets state and sends create_room again', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useOnlineHostLobbyController())
    await waitFor(() => expect(result.current.status).toBe('error'))

    vi.mocked(wsService.send).mockClear()
    // handleRetry is async — must be awaited inside act so the connect + send completes
    await act(async () => { await result.current.handleRetry() })

    expect(result.current.status).toBe('connecting')
    expect(result.current.error).toBeNull()
    expect(result.current.roomCode).toBeNull()
    expect(wsService.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'create_room' })
    )
  })

  it('does not send create_room when user is a guest', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuth({ token: null, isGuest: true }) as any)
    const { result } = renderHook(() => useOnlineHostLobbyController())
    vi.mocked(wsService.send).mockClear()

    act(() => { result.current.handleRetry() })
    expect(wsService.send).not.toHaveBeenCalled()
  })
})

describe('useOnlineHostLobbyController — cleanup', () => {
  it('unsubscribes all WS handlers on unmount', async () => {
    const unsub = vi.fn()
    vi.mocked(wsService.on).mockReturnValue(unsub)

    const { unmount } = renderHook(() => useOnlineHostLobbyController())
    await waitFor(() => expect(wsService.connect).toHaveBeenCalled())

    act(() => { unmount() })
    expect(unsub).toHaveBeenCalledTimes(3)
  })
})
