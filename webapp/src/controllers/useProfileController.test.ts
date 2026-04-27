import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProfileController } from '@/controllers/useProfileController'
import { useAuth } from '@/contexts/AuthContext'
import { authService } from '@/services/authService'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/authService', () => ({
  authService: { changePassword: vi.fn() },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  createdAt: '',
  updatedAt: '',
}

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    user: mockUser,
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    isGuest: false,
    login: vi.fn(),
    register: vi.fn(),
    loginAsGuest: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
})

// ── Initial state ─────────────────────────────────────────────────────────────

describe('useProfileController — initial state', () => {
  it('pre-fills username from auth user', () => {
    const { result } = renderHook(() => useProfileController())
    expect(result.current.username).toBe('alice')
  })

  it('pre-fills email from auth user', () => {
    const { result } = renderHook(() => useProfileController())
    expect(result.current.email).toBe('alice@example.com')
  })

  it('falls back to empty string when user is null', () => {
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ user: null }) as any)
    const { result } = renderHook(() => useProfileController())
    expect(result.current.username).toBe('')
    expect(result.current.email).toBe('')
  })

  it('starts with no errors or success states', () => {
    const { result } = renderHook(() => useProfileController())
    expect(result.current.infoError).toBeNull()
    expect(result.current.infoSuccess).toBe(false)
    expect(result.current.infoLoading).toBe(false)
    expect(result.current.passError).toBeNull()
    expect(result.current.passSuccess).toBe(false)
    expect(result.current.passLoading).toBe(false)
  })

  it('password fields start empty', () => {
    const { result } = renderHook(() => useProfileController())
    expect(result.current.currentPassword).toBe('')
    expect(result.current.newPassword).toBe('')
    expect(result.current.confirmPassword).toBe('')
  })

  it('exposes the user object from auth context', () => {
    const { result } = renderHook(() => useProfileController())
    expect(result.current.user).toEqual(mockUser)
  })
})

// ── setters ───────────────────────────────────────────────────────────────────

describe('useProfileController — setters', () => {
  it('setUsername updates username state', () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setUsername('newname'))
    expect(result.current.username).toBe('newname')
  })

  it('setEmail updates email state', () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setEmail('new@test.com'))
    expect(result.current.email).toBe('new@test.com')
  })

  it('setCurrentPassword updates state', () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setCurrentPassword('secret'))
    expect(result.current.currentPassword).toBe('secret')
  })

  it('setNewPassword updates state', () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setNewPassword('newpass123'))
    expect(result.current.newPassword).toBe('newpass123')
  })

  it('setConfirmPassword updates state', () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setConfirmPassword('newpass123'))
    expect(result.current.confirmPassword).toBe('newpass123')
  })
})

// ── handleUpdateInfo — validation ─────────────────────────────────────────────

describe('useProfileController — handleUpdateInfo validation', () => {
  it('sets infoError when username is empty', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setUsername(''))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBe('Username is required')
    expect(result.current.user?.username).toBe('alice') // not changed
  })

  it('sets infoError when username is only whitespace', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setUsername('   '))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBe('Username is required')
  })

  it('sets infoError when username is shorter than 3 characters', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setUsername('ab'))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBe('Username must be at least 3 characters')
  })

  it('accepts username with exactly 3 characters', async () => {
    const updateProfile = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setUsername('abc'))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBeNull()
    expect(updateProfile).toHaveBeenCalled()
  })

  it('sets infoError when email is empty', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setEmail(''))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBe('Email is required')
  })

  it('sets infoError when email is only whitespace', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setEmail('   '))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBe('Email is required')
  })

  it('sets infoError when email format is invalid', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setEmail('not-an-email'))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBe('Invalid email format')
  })

  it('does not call updateProfile when validation fails', async () => {
    const updateProfile = vi.fn()
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setUsername(''))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('clears infoError at the start of each call', async () => {
    const updateProfile = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())

    // First call — validation fails
    act(() => result.current.setUsername(''))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBeTruthy()

    // Second call — valid, error must clear
    act(() => result.current.setUsername('validname'))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBeNull()
  })
})

// ── handleUpdateInfo — success ────────────────────────────────────────────────

describe('useProfileController — handleUpdateInfo success', () => {
  it('calls updateProfile with trimmed username and email', async () => {
    const updateProfile = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())

    act(() => {
      result.current.setUsername('  alice  ')
      result.current.setEmail('  alice@example.com  ')
    })
    await act(async () => { await result.current.handleUpdateInfo() })

    expect(updateProfile).toHaveBeenCalledWith({
      username: 'alice',
      email: 'alice@example.com',
    })
  })

  it('sets infoSuccess to true on success', async () => {
    const { result } = renderHook(() => useProfileController())
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoSuccess).toBe(true)
  })

  it('infoLoading is true during the call and false when done', async () => {
    let resolveUpdate!: () => void
    const updateProfile = vi.fn().mockReturnValue(
      new Promise<void>(resolve => { resolveUpdate = resolve }),
    )
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())

    act(() => { result.current.handleUpdateInfo() })
    expect(result.current.infoLoading).toBe(true)

    await act(async () => { resolveUpdate() })
    expect(result.current.infoLoading).toBe(false)
  })

  it('infoError remains null on success', async () => {
    const { result } = renderHook(() => useProfileController())
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBeNull()
  })

  it('infoSuccess auto-clears after 3 seconds', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useProfileController())
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoSuccess).toBe(true)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.infoSuccess).toBe(false)
  })

  it('infoSuccess does not clear before 3 seconds', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useProfileController())
    await act(async () => { await result.current.handleUpdateInfo() })
    act(() => { vi.advanceTimersByTime(2999) })
    expect(result.current.infoSuccess).toBe(true)
  })
})

// ── handleUpdateInfo — failure ────────────────────────────────────────────────

describe('useProfileController — handleUpdateInfo failure', () => {
  it('sets infoError from Error instance message on failure', async () => {
    const updateProfile = vi.fn().mockRejectedValue(new Error('Username taken'))
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())

    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBe('Username taken')
  })

  it('sets generic infoError for non-Error rejections', async () => {
    const updateProfile = vi.fn().mockRejectedValue('network failure')
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())

    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBe('Failed to update profile')
  })

  it('infoSuccess stays false on failure', async () => {
    const updateProfile = vi.fn().mockRejectedValue(new Error('oops'))
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())

    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoSuccess).toBe(false)
  })

  it('infoLoading resets to false after failure', async () => {
    const updateProfile = vi.fn().mockRejectedValue(new Error('oops'))
    vi.mocked(useAuth).mockReturnValue(makeAuthMock({ updateProfile }) as any)
    const { result } = renderHook(() => useProfileController())

    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoLoading).toBe(false)
  })
})

// ── handleChangePassword — validation ────────────────────────────────────────

describe('useProfileController — handleChangePassword validation', () => {
  it('sets passError when currentPassword is empty', async () => {
    const { result } = renderHook(() => useProfileController())
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBe('Current password is required')
  })

  it('sets passError when newPassword is empty', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setCurrentPassword('oldpass'))
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBe('New password is required')
  })

  it('sets passError when newPassword is shorter than 6 characters', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('abc')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBe('New password must be at least 6 characters')
  })

  it('accepts newPassword with exactly 6 characters', async () => {
    vi.mocked(authService.changePassword).mockResolvedValue(undefined)
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('abcdef')
      result.current.setConfirmPassword('abcdef')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBeNull()
    expect(authService.changePassword).toHaveBeenCalled()
  })

  it('sets passError when passwords do not match', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('different')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBe('Passwords do not match')
  })

  it('does not call authService when validation fails', async () => {
    const { result } = renderHook(() => useProfileController())
    await act(async () => { await result.current.handleChangePassword() })
    expect(authService.changePassword).not.toHaveBeenCalled()
  })

  it('clears passError at the start of each call', async () => {
    vi.mocked(authService.changePassword).mockResolvedValue(undefined)
    const { result } = renderHook(() => useProfileController())

    // First call — validation fails
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBeTruthy()

    // Second call — valid inputs, error must clear
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBeNull()
  })
})

// ── handleChangePassword — success ───────────────────────────────────────────

describe('useProfileController — handleChangePassword success', () => {
  beforeEach(() => {
    vi.mocked(authService.changePassword).mockResolvedValue(undefined)
  })

  it('calls authService.changePassword with correct arguments', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(authService.changePassword).toHaveBeenCalledWith(
      'mock-token',
      'oldpass',
      'newpass123',
    )
  })

  it('sets passSuccess to true on success', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passSuccess).toBe(true)
  })

  it('clears all password fields on success', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.currentPassword).toBe('')
    expect(result.current.newPassword).toBe('')
    expect(result.current.confirmPassword).toBe('')
  })

  it('passLoading is true during the call and false when done', async () => {
    let resolveChange!: () => void
    vi.mocked(authService.changePassword).mockReturnValue(
      new Promise<void>(resolve => { resolveChange = resolve }),
    )
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })

    act(() => { result.current.handleChangePassword() })
    expect(result.current.passLoading).toBe(true)

    await act(async () => { resolveChange() })
    expect(result.current.passLoading).toBe(false)
  })

  it('passError remains null on success', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBeNull()
  })

  it('passSuccess auto-clears after 3 seconds', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passSuccess).toBe(true)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(result.current.passSuccess).toBe(false)
  })

  it('passSuccess does not clear before 3 seconds', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    act(() => { vi.advanceTimersByTime(2999) })
    expect(result.current.passSuccess).toBe(true)
  })
})

// ── handleChangePassword — failure ───────────────────────────────────────────

describe('useProfileController — handleChangePassword failure', () => {
  it('sets passError from Error instance message', async () => {
    vi.mocked(authService.changePassword).mockRejectedValue(
      new Error('Current password is incorrect'),
    )
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('wrongpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBe('Current password is incorrect')
  })

  it('sets generic passError for non-Error rejections', async () => {
    vi.mocked(authService.changePassword).mockRejectedValue('timeout')
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBe('Failed to change password')
  })

  it('passSuccess stays false on failure', async () => {
    vi.mocked(authService.changePassword).mockRejectedValue(new Error('oops'))
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passSuccess).toBe(false)
  })

  it('passLoading resets to false after failure', async () => {
    vi.mocked(authService.changePassword).mockRejectedValue(new Error('oops'))
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passLoading).toBe(false)
  })

  it('does not clear password fields on failure', async () => {
    vi.mocked(authService.changePassword).mockRejectedValue(new Error('oops'))
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.currentPassword).toBe('oldpass')
    expect(result.current.newPassword).toBe('newpass123')
    expect(result.current.confirmPassword).toBe('newpass123')
  })
})

// ── independence of info / password sections ──────────────────────────────────

describe('useProfileController — section independence', () => {
  it('info error does not bleed into pass section', async () => {
    const { result } = renderHook(() => useProfileController())
    act(() => result.current.setUsername(''))
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoError).toBeTruthy()
    expect(result.current.passError).toBeNull()
  })

  it('pass error does not bleed into info section', async () => {
    const { result } = renderHook(() => useProfileController())
    // empty currentPassword triggers pass error
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passError).toBeTruthy()
    expect(result.current.infoError).toBeNull()
  })

  it('info success does not affect pass success', async () => {
    const { result } = renderHook(() => useProfileController())
    await act(async () => { await result.current.handleUpdateInfo() })
    expect(result.current.infoSuccess).toBe(true)
    expect(result.current.passSuccess).toBe(false)
  })

  it('pass success does not affect info success', async () => {
    vi.mocked(authService.changePassword).mockResolvedValue(undefined)
    const { result } = renderHook(() => useProfileController())
    act(() => {
      result.current.setCurrentPassword('oldpass')
      result.current.setNewPassword('newpass123')
      result.current.setConfirmPassword('newpass123')
    })
    await act(async () => { await result.current.handleChangePassword() })
    expect(result.current.passSuccess).toBe(true)
    expect(result.current.infoSuccess).toBe(false)
  })
})
