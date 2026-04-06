import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLoginController } from './useLoginController'
import { useAuth } from '@/contexts/AuthContext'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

const mockNavigate = vi.fn()
let mockLocationState: unknown = null

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState }),
}))

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isGuest: false,
    isLoading: false,
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
  mockLocationState = null
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
})

describe('useLoginController', () => {
  describe('handleLogin', () => {
    it('calls login service with credentials and navigates to /games on success', async () => {
      const mockLogin = vi.fn().mockResolvedValue(undefined)
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ login: mockLogin }) as any)

      const { result } = renderHook(() => useLoginController())

      await act(async () => {
        await result.current.handleLogin('user@example.com', 'password')
      })

      expect(mockLogin).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password' })
      expect(mockNavigate).toHaveBeenCalledWith('/games', { replace: true })
    })

    it('navigates to location.state.from.pathname when present', async () => {
      mockLocationState = { from: { pathname: '/games/y/play/123' } }
      const mockLogin = vi.fn().mockResolvedValue(undefined)
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ login: mockLogin }) as any)

      const { result } = renderHook(() => useLoginController())

      await act(async () => {
        await result.current.handleLogin('user@example.com', 'password')
      })

      expect(mockNavigate).toHaveBeenCalledWith('/games/y/play/123', { replace: true })
    })

    it('sets error message when login throws an Error', async () => {
      const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ login: mockLogin }) as any)

      const { result } = renderHook(() => useLoginController())

      await act(async () => {
        await result.current.handleLogin('bad@example.com', 'wrong')
      })

      expect(result.current.error).toBe('Invalid credentials')
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('sets generic error message when login throws a non-Error value', async () => {
      const mockLogin = vi.fn().mockRejectedValue('something bad')
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ login: mockLogin }) as any)

      const { result } = renderHook(() => useLoginController())

      await act(async () => {
        await result.current.handleLogin('user@example.com', 'password')
      })

      expect(result.current.error).toBe('Login failed')
    })

    it('sets isLoading to true during login and false when done', async () => {
      let resolveLogin!: () => void
      const mockLogin = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => { resolveLogin = resolve })
      )
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ login: mockLogin }) as any)

      const { result } = renderHook(() => useLoginController())

      act(() => { result.current.handleLogin('u@e.com', 'p') })
      expect(result.current.isLoading).toBe(true)

      await act(async () => { resolveLogin() })
      expect(result.current.isLoading).toBe(false)
    })

    it('clears previous error before each login attempt', async () => {
      const mockLogin = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined)
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ login: mockLogin }) as any)

      const { result } = renderHook(() => useLoginController())

      await act(async () => {
        await result.current.handleLogin('u@e.com', 'p')
      })
      expect(result.current.error).toBe('First error')

      await act(async () => {
        await result.current.handleLogin('u@e.com', 'correct')
      })
      expect(result.current.error).toBeNull()
    })
  })

  describe('handleGuestLogin', () => {
    it('calls loginAsGuest and navigates to /games', () => {
      const mockLoginAsGuest = vi.fn()
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ loginAsGuest: mockLoginAsGuest }) as any)

      const { result } = renderHook(() => useLoginController())

      act(() => { result.current.handleGuestLogin() })

      expect(mockLoginAsGuest).toHaveBeenCalledOnce()
      expect(mockNavigate).toHaveBeenCalledWith('/games', { replace: true })
    })

    it('navigates to location.state.from when present', () => {
      mockLocationState = { from: { pathname: '/games/y' } }
      const mockLoginAsGuest = vi.fn()
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ loginAsGuest: mockLoginAsGuest }) as any)

      const { result } = renderHook(() => useLoginController())

      act(() => { result.current.handleGuestLogin() })

      expect(mockNavigate).toHaveBeenCalledWith('/games/y', { replace: true })
    })
  })

  describe('initial state', () => {
    it('starts with isLoading false and error null', () => {
      const { result } = renderHook(() => useLoginController())
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })
})
