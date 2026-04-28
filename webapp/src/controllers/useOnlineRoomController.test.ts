import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOnlineRoomController } from './useOnlineRoomController'
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
})

describe('useOnlineRoomController — initial state', () => {
  it('starts idle with empty codeInput and no error', () => {
    const { result } = renderHook(() => useOnlineRoomController())
    expect(result.current.joinStatus).toBe('idle')
    expect(result.current.codeInput).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('isGuest is false for an authenticated user', () => {
    const { result } = renderHook(() => useOnlineRoomController())
    expect(result.current.isGuest).toBe(false)
  })

  it('isGuest is true for a guest user', () => {
    vi.mocked(useAuth).mockReturnValue(makeAuth({ isGuest: true }) as any)
    const { result } = renderHook(() => useOnlineRoomController())
    expect(result.current.isGuest).toBe(true)
  })
})

describe('useOnlineRoomController — navigation', () => {
  it('handleCreateRoom navigates to /games/y/config/pvp-online', () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.handleCreateRoom() })
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/config/pvp-online')
  })

  it('handleCancel navigates to /games/y', () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.handleCancel() })
    expect(mockNavigate).toHaveBeenCalledWith('/games/y')
  })
})

describe('useOnlineRoomController — handleRetry', () => {
  it('resets status to idle and clears error', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('Timeout'))
    const { result } = renderHook(() => useOnlineRoomController())

    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })

    await waitFor(() => expect(result.current.joinStatus).toBe('error'))

    act(() => { result.current.handleRetry() })

    expect(result.current.joinStatus).toBe('idle')
    expect(result.current.error).toBeNull()
  })
})

describe('useOnlineRoomController — handleJoin', () => {
  it('does nothing when codeInput is empty', async () => {
    const { result } = renderHook(() => useOnlineRoomController())
    await act(async () => { await result.current.handleJoin() })
    expect(wsService.connect).not.toHaveBeenCalled()
  })

  it('does nothing when user is a guest', async () => {
    vi.mocked(useAuth).mockReturnValue(makeAuth({ token: null, isGuest: true }) as any)
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })
    expect(wsService.connect).not.toHaveBeenCalled()
  })

  it('connects and sends join_room with the uppercased code', async () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('abcdef') })
    await act(async () => { await result.current.handleJoin() })

    expect(wsService.connect).toHaveBeenCalledWith('jwt-token')
    expect(wsService.send).toHaveBeenCalledWith({ type: 'join_room', code: 'ABCDEF' })
  })

  it('skips connect when already connected', async () => {
    vi.mocked(wsService.isConnected).mockReturnValue(true)
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })

    expect(wsService.connect).not.toHaveBeenCalled()
    expect(wsService.send).toHaveBeenCalledWith({ type: 'join_room', code: 'ABCDEF' })
  })

  it('transitions to waiting after sending join_room', async () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })
    expect(result.current.joinStatus).toBe('waiting')
  })

  it('sets error status when connect throws', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce(new Error('Net error'))
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })

    expect(result.current.joinStatus).toBe('error')
    expect(result.current.error).toBe('Net error')
  })

  it('sets generic error message for non-Error throws', async () => {
    vi.mocked(wsService.connect).mockRejectedValueOnce('oops')
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })

    expect(result.current.error).toBe('Connection failed')
  })
})

describe('useOnlineRoomController — matched event', () => {
  it('sets status to matched', async () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })

    act(() => { emitWsEvent('matched', { gameId: 'g-1', opponentName: 'Bob' }) })
    expect(result.current.joinStatus).toBe('matched')
  })

  it('captures host name from the matched event', async () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })

    act(() => { emitWsEvent('matched', { gameId: 'g-1', opponentName: 'Alice' }) })
    expect(result.current.hostName).toBe('Alice')
  })

  it('navigates to the variant supplied by the server (cross-variant join)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { result } = renderHook(() => useOnlineRoomController())
      act(() => { result.current.setCodeInput('ABCDEF') })
      await act(async () => { await result.current.handleJoin() })

      // URL has variant=y but the joined room is a why-not room
      act(() => { emitWsEvent('matched', { gameId: 'g-1', opponentName: 'Alice', variant: 'why-not' }) })
      act(() => { vi.advanceTimersByTime(1200) })

      expect(mockNavigate).toHaveBeenCalledWith('/games/why-not/play/g-1')
      expect(result.current.matchedVariant).toBe('why-not')
    } finally {
      vi.useRealTimers()
    }
  })

  it('navigates to game page after 1200 ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { result } = renderHook(() => useOnlineRoomController())
      act(() => { result.current.setCodeInput('ABCDEF') })
      await act(async () => { await result.current.handleJoin() })

      act(() => { emitWsEvent('matched', { gameId: 'g-1' }) })
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
      const { result, unmount } = renderHook(() => useOnlineRoomController())
      act(() => { result.current.setCodeInput('ABCDEF') })
      await act(async () => { await result.current.handleJoin() })

      act(() => { emitWsEvent('matched', { gameId: 'g-1' }) })
      act(() => { unmount() })
      act(() => { vi.advanceTimersByTime(1200) })

      expect(mockNavigate).not.toHaveBeenCalledWith('/games/y/play/g-1')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useOnlineRoomController — error event', () => {
  it('sets error status and message when not idle', async () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })

    act(() => { emitWsEvent('error', { message: 'ROOM_NOT_FOUND' }) })
    expect(result.current.joinStatus).toBe('error')
    expect(result.current.error).toBe('ROOM_NOT_FOUND')
  })

  it('ignores error event when status is still idle', () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { emitWsEvent('error', { message: 'whatever' }) })
    expect(result.current.joinStatus).toBe('idle')
  })

  it('falls back to generic message when error.message is absent', async () => {
    const { result } = renderHook(() => useOnlineRoomController())
    act(() => { result.current.setCodeInput('ABCDEF') })
    await act(async () => { await result.current.handleJoin() })

    act(() => { emitWsEvent('error', {}) })
    expect(result.current.error).toBe('An error occurred')
  })
})

describe('useOnlineRoomController — cleanup', () => {
  it('unsubscribes all WS handlers on unmount', () => {
    const unsub = vi.fn()
    vi.mocked(wsService.on).mockReturnValue(unsub)

    const { unmount } = renderHook(() => useOnlineRoomController())
    act(() => { unmount() })

    expect(unsub).toHaveBeenCalledTimes(2)
  })
})
