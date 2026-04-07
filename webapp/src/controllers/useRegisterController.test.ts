import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRegisterController } from './useRegisterController'
import { useAuth } from '@/contexts/AuthContext'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))

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
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
})

describe('useRegisterController', () => {
  describe('initial state', () => {
    it('starts with isLoading false, error null, success false', () => {
      const { result } = renderHook(() => useRegisterController())
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.success).toBe(false)
    })
  })

  describe('handleRegister', () => {
    it('calls register with all credentials and sets success on completion', async () => {
      const mockRegister = vi.fn().mockResolvedValue(undefined)
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ register: mockRegister }) as any)

      const { result } = renderHook(() => useRegisterController())

      await act(async () => {
        await result.current.handleRegister('alice', 'alice@example.com', 'pass123', 'pass123')
      })

      expect(mockRegister).toHaveBeenCalledWith({
        username: 'alice',
        email: 'alice@example.com',
        password: 'pass123',
        passwordConfirm: 'pass123',
      })
      expect(result.current.success).toBe(true)
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })

    it('sets error when register throws an Error and does not set success', async () => {
      const mockRegister = vi.fn().mockRejectedValue(new Error('Email already in use'))
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ register: mockRegister }) as any)

      const { result } = renderHook(() => useRegisterController())

      await act(async () => {
        await result.current.handleRegister('alice', 'taken@example.com', 'pass', 'pass')
      })

      expect(result.current.error).toBe('Email already in use')
      expect(result.current.success).toBe(false)
      expect(result.current.isLoading).toBe(false)
    })

    it('sets generic error when register throws a non-Error value', async () => {
      const mockRegister = vi.fn().mockRejectedValue('unexpected failure')
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ register: mockRegister }) as any)

      const { result } = renderHook(() => useRegisterController())

      await act(async () => {
        await result.current.handleRegister('user', 'u@e.com', 'pass', 'pass')
      })

      expect(result.current.error).toBe('Registration failed')
    })

    it('sets isLoading true during registration and false when done', async () => {
      let resolveRegister!: () => void
      const mockRegister = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => { resolveRegister = resolve })
      )
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ register: mockRegister }) as any)

      const { result } = renderHook(() => useRegisterController())

      act(() => { result.current.handleRegister('u', 'u@e.com', 'p', 'p') })
      expect(result.current.isLoading).toBe(true)

      await act(async () => { resolveRegister() })
      expect(result.current.isLoading).toBe(false)
    })

    it('clears previous error before a new registration attempt', async () => {
      const mockRegister = vi.fn()
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce(undefined)
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ register: mockRegister }) as any)

      const { result } = renderHook(() => useRegisterController())

      await act(async () => {
        await result.current.handleRegister('u', 'u@e.com', 'p', 'p')
      })
      expect(result.current.error).toBe('Server error')

      await act(async () => {
        await result.current.handleRegister('u', 'u@e.com', 'p', 'p')
      })
      expect(result.current.error).toBeNull()
      expect(result.current.success).toBe(true)
    })
  })
})
