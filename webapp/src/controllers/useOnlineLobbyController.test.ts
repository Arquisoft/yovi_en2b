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
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue(makeAuth() as any)
  // connect resolves immediately by default so connectingRef is released
  vi.mocked(wsService.connect).mockResolvedValue(undefined)
  vi.mocked(wsService.on).mockReturnValue(() => {})
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



