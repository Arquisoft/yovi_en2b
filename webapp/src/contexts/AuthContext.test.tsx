import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { AuthProvider, useAuth, GUEST_TOKEN } from './AuthContext'
import { authService } from '@/services/authService'

vi.mock('@/services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}))

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const mockSession = { user: mockUser, token: 'my-jwt', expiresAt: '' }

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AuthContext — initialization', () => {
  it('resolves with no user when storage is empty', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('starts with isLoading true when a JWT token is stored (async profile fetch)', async () => {
    localStorage.setItem('yovi_token', JSON.stringify('stored-jwt'))
    // Keep getProfile pending so we can observe isLoading = true
    let resolveProfile!: (u: typeof mockUser) => void
    vi.mocked(authService.getProfile).mockReturnValueOnce(
      new Promise<typeof mockUser>((resolve) => { resolveProfile = resolve })
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isLoading).toBe(true)

    await act(async () => { resolveProfile(mockUser) })
    expect(result.current.isLoading).toBe(false)
  })

  it('restores session from storage when stored JWT is valid', async () => {
    localStorage.setItem('yovi_token', JSON.stringify('stored-jwt'))
    vi.mocked(authService.getProfile).mockResolvedValueOnce(mockUser)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(authService.getProfile).toHaveBeenCalledWith('stored-jwt')
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.token).toBe('stored-jwt')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('clears storage and leaves user null when stored token is rejected by the server', async () => {
    localStorage.setItem('yovi_token', JSON.stringify('expired-jwt'))
    localStorage.setItem('yovi_user', JSON.stringify(mockUser))
    vi.mocked(authService.getProfile).mockRejectedValueOnce(new Error('Token expired'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(localStorage.getItem('yovi_token')).toBeNull()
    expect(localStorage.getItem('yovi_user')).toBeNull()
  })

  it('restores guest session from storage without calling getProfile', async () => {
    const guestUser = { ...mockUser, id: 'guest-abc', username: 'Guest', email: '' }
    localStorage.setItem('yovi_token', JSON.stringify(GUEST_TOKEN))
    localStorage.setItem('yovi_user', JSON.stringify(guestUser))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(authService.getProfile).not.toHaveBeenCalled()
    expect(result.current.isGuest).toBe(true)
    expect(result.current.user?.username).toBe('Guest')
    expect(result.current.isAuthenticated).toBe(true)
  })
})

describe('AuthContext — login', () => {
  it('sets user and token from the service response', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockSession)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.login({ email: 'test@example.com', password: 'pass' })
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.token).toBe('my-jwt')
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isGuest).toBe(false)
  })

  it('persists token and user to localStorage', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockSession)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.login({ email: 'test@example.com', password: 'pass' })
    })

    expect(JSON.parse(localStorage.getItem('yovi_token')!)).toBe('my-jwt')
    expect(JSON.parse(localStorage.getItem('yovi_user')!)).toEqual(mockUser)
  })

  it('propagates service errors without updating state', async () => {
    vi.mocked(authService.login).mockRejectedValueOnce(new Error('Invalid credentials'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await expect(
      act(async () => {
        await result.current.login({ email: 'x@x.com', password: 'wrong' })
      })
    ).rejects.toThrow('Invalid credentials')

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })
})

describe('AuthContext — register', () => {
  it('sets user and token from the service response', async () => {
    vi.mocked(authService.register).mockResolvedValueOnce(mockSession)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'pass',
        passwordConfirm: 'pass',
      })
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.token).toBe('my-jwt')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('persists token and user to localStorage', async () => {
    vi.mocked(authService.register).mockResolvedValueOnce(mockSession)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'pass',
        passwordConfirm: 'pass',
      })
    })

    expect(JSON.parse(localStorage.getItem('yovi_token')!)).toBe('my-jwt')
  })
})

describe('AuthContext — loginAsGuest', () => {
  it('creates a guest user with GUEST_TOKEN', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.loginAsGuest() })

    expect(result.current.user?.username).toBe('Guest')
    expect(result.current.token).toBe(GUEST_TOKEN)
    expect(result.current.isGuest).toBe(true)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('gives the guest user a guest-prefixed id', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.loginAsGuest() })

    expect(result.current.user?.id).toMatch(/^guest-/)
  })

  it('persists GUEST_TOKEN to localStorage', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.loginAsGuest() })

    expect(JSON.parse(localStorage.getItem('yovi_token')!)).toBe(GUEST_TOKEN)
  })

  it('does not call authService for a guest login', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.loginAsGuest() })

    expect(authService.login).not.toHaveBeenCalled()
    expect(authService.getProfile).not.toHaveBeenCalled()
  })
})

describe('AuthContext — logout', () => {
  it('clears user, token and localStorage', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockSession)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => { await result.current.login({ email: 'test@example.com', password: 'pass' }) })
    expect(result.current.isAuthenticated).toBe(true)

    act(() => { result.current.logout() })

    expect(result.current.user).toBeNull()
    expect(result.current.token).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('yovi_token')).toBeNull()
    expect(localStorage.getItem('yovi_user')).toBeNull()
  })

  it('also works after a guest session', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.loginAsGuest() })
    expect(result.current.isGuest).toBe(true)

    act(() => { result.current.logout() })

    expect(result.current.user).toBeNull()
    expect(result.current.isGuest).toBe(false)
    expect(localStorage.getItem('yovi_token')).toBeNull()
  })
})

describe('AuthContext — updateProfile', () => {
  it('updates user state and localStorage on success', async () => {
    vi.mocked(authService.login).mockResolvedValueOnce(mockSession)
    const updated = { ...mockUser, username: 'newname' }
    vi.mocked(authService.updateProfile).mockResolvedValueOnce(updated)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.login({ email: 'test@example.com', password: 'pass' }) })

    await act(async () => { await result.current.updateProfile({ username: 'newname' }) })

    expect(result.current.user?.username).toBe('newname')
    expect(JSON.parse(localStorage.getItem('yovi_user')!)).toMatchObject({ username: 'newname' })
  })

  it('throws when called as a guest user', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => { result.current.loginAsGuest() })

    await expect(
      act(async () => { await result.current.updateProfile({ username: 'new' }) })
    ).rejects.toThrow('Not authenticated')

    expect(authService.updateProfile).not.toHaveBeenCalled()
  })

  it('throws when called while unauthenticated', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await expect(
      act(async () => { await result.current.updateProfile({ username: 'x' }) })
    ).rejects.toThrow('Not authenticated')
  })
})

describe('AuthContext — useAuth outside provider', () => {
  it('throws a descriptive error', () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    )
  })
})
