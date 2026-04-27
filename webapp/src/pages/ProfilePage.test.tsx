import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProfilePage } from '@/pages/ProfilePage'
import { useProfileController } from '@/controllers/useProfileController'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/controllers/useProfileController', () => ({
  useProfileController: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
  createdAt: '',
  updatedAt: '',
}

function makeController(overrides: Record<string, unknown> = {}) {
  return {
    user: mockUser,
    username: 'alice',
    setUsername: vi.fn(),
    email: 'alice@example.com',
    setEmail: vi.fn(),
    infoError: null,
    infoSuccess: false,
    infoLoading: false,
    handleUpdateInfo: vi.fn(),
    currentPassword: '',
    setCurrentPassword: vi.fn(),
    newPassword: '',
    setNewPassword: vi.fn(),
    confirmPassword: '',
    setConfirmPassword: vi.fn(),
    passError: null,
    passSuccess: false,
    passLoading: false,
    handleChangePassword: vi.fn(),
    ...overrides,
  }
}

function renderPage(overrides: Record<string, unknown> = {}) {
  vi.mocked(useProfileController).mockReturnValue(makeController(overrides) as any)
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockReset()
})

// ── Static chrome ─────────────────────────────────────────────────────────────

describe('ProfilePage — static chrome', () => {
  it('renders the page title', () => {
    renderPage()
    expect(screen.getByText('My Profile')).toBeDefined()
  })

  it('renders the back button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /back/i })).toBeDefined()
  })

  it('calls navigate(-1) when back button is clicked', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('renders the info section title', () => {
    renderPage()
    expect(screen.getByText('Account information')).toBeDefined()
  })

  it('renders the password section title', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Change password' })).toBeDefined()
  })

  it('displays the username from the user object', () => {
    renderPage()
    // The avatar section shows user.username
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0)
  })

  it('displays the email from the user object', () => {
    renderPage()
    expect(screen.getByText('alice@example.com')).toBeDefined()
  })
})

// ── Info section — field rendering ────────────────────────────────────────────

describe('ProfilePage — info section fields', () => {
  it('renders username input with current value', () => {
    renderPage({ username: 'alice' })
    const input = screen.getByLabelText('Username') as HTMLInputElement
    expect(input.value).toBe('alice')
  })

  it('renders email input with current value', () => {
    renderPage({ email: 'alice@example.com' })
    const input = screen.getByLabelText('Email') as HTMLInputElement
    expect(input.value).toBe('alice@example.com')
  })

  it('renders Save changes button for info section', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDefined()
  })

  it('calls setUsername when username input changes', () => {
    const setUsername = vi.fn()
    renderPage({ setUsername })
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'newname' },
    })
    expect(setUsername).toHaveBeenCalledWith('newname')
  })

  it('calls setEmail when email input changes', () => {
    const setEmail = vi.fn()
    renderPage({ setEmail })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' },
    })
    expect(setEmail).toHaveBeenCalledWith('new@example.com')
  })

  it('calls handleUpdateInfo when Save changes is clicked', () => {
    const handleUpdateInfo = vi.fn()
    renderPage({ handleUpdateInfo })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    expect(handleUpdateInfo).toHaveBeenCalledOnce()
  })

  it('disables username and email inputs while infoLoading', () => {
    renderPage({ infoLoading: true })
    expect((screen.getByLabelText('Username') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(true)
  })
})

// ── Info section — error state ────────────────────────────────────────────────

describe('ProfilePage — info section error', () => {
  it('shows infoError message when set', () => {
    renderPage({ infoError: 'Username taken' })
    expect(screen.getByText('Username taken')).toBeDefined()
  })

  it('does not render infoError banner when infoError is null', () => {
    renderPage({ infoError: null })
    expect(screen.queryByText('Username taken')).toBeNull()
  })
})

// ── Info section — success state ──────────────────────────────────────────────

describe('ProfilePage — info section success', () => {
  it('shows success banner when infoSuccess is true', () => {
    renderPage({ infoSuccess: true })
    expect(screen.getByText(/profile updated successfully/i)).toBeDefined()
  })

  it('does not show success banner when infoSuccess is false', () => {
    renderPage({ infoSuccess: false })
    expect(screen.queryByText(/profile updated successfully/i)).toBeNull()
  })
})

// ── Password section — field rendering ───────────────────────────────────────

describe('ProfilePage — password section fields', () => {
  it('renders current password input', () => {
    renderPage()
    expect(screen.getByLabelText('Current password')).toBeDefined()
  })

  it('renders new password input', () => {
    renderPage()
    expect(screen.getByLabelText('New password')).toBeDefined()
  })

  it('renders confirm password input', () => {
    renderPage()
    expect(screen.getByLabelText('Confirm Password')).toBeDefined()
  })

  it('renders Change password button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /change password/i })).toBeDefined()
  })

  it('password inputs have type="password"', () => {
    renderPage()
    const inputs = screen
      .getAllByDisplayValue('')
      .filter(
        el => (el as HTMLInputElement).type === 'password',
      )
    expect(inputs.length).toBeGreaterThanOrEqual(3)
  })

  it('calls setCurrentPassword when current password input changes', () => {
    const setCurrentPassword = vi.fn()
    renderPage({ setCurrentPassword })
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'oldpass' },
    })
    expect(setCurrentPassword).toHaveBeenCalledWith('oldpass')
  })

  it('calls setNewPassword when new password input changes', () => {
    const setNewPassword = vi.fn()
    renderPage({ setNewPassword })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'newpass123' },
    })
    expect(setNewPassword).toHaveBeenCalledWith('newpass123')
  })

  it('calls setConfirmPassword when confirm password input changes', () => {
    const setConfirmPassword = vi.fn()
    renderPage({ setConfirmPassword })
    fireEvent.change(screen.getByLabelText('Confirm Password'), {
      target: { value: 'newpass123' },
    })
    expect(setConfirmPassword).toHaveBeenCalledWith('newpass123')
  })

  it('calls handleChangePassword when Change password is clicked', () => {
    const handleChangePassword = vi.fn()
    renderPage({ handleChangePassword })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))
    expect(handleChangePassword).toHaveBeenCalledOnce()
  })

  it('disables all password inputs while passLoading', () => {
    renderPage({ passLoading: true })
    expect(
      (screen.getByLabelText('Current password') as HTMLInputElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByLabelText('New password') as HTMLInputElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByLabelText('Confirm Password') as HTMLInputElement).disabled,
    ).toBe(true)
  })
})

// ── Password section — error state ────────────────────────────────────────────

describe('ProfilePage — password section error', () => {
  it('shows passError message when set', () => {
    renderPage({ passError: 'Current password is incorrect' })
    expect(screen.getByText('Current password is incorrect')).toBeDefined()
  })

  it('does not render passError banner when passError is null', () => {
    renderPage({ passError: null })
    expect(screen.queryByText('Current password is incorrect')).toBeNull()
  })
})

// ── Password section — success state ─────────────────────────────────────────

describe('ProfilePage — password section success', () => {
  it('shows success banner when passSuccess is true', () => {
    renderPage({ passSuccess: true })
    expect(screen.getByText(/password changed successfully/i)).toBeDefined()
  })

  it('does not show success banner when passSuccess is false', () => {
    renderPage({ passSuccess: false })
    expect(screen.queryByText(/password changed successfully/i)).toBeNull()
  })
})

// ── Simultaneous states ───────────────────────────────────────────────────────

describe('ProfilePage — simultaneous section states', () => {
  it('can show both infoError and passError at the same time', () => {
    renderPage({
      infoError: 'Info error',
      passError: 'Pass error',
    })
    expect(screen.getByText('Info error')).toBeDefined()
    expect(screen.getByText('Pass error')).toBeDefined()
  })

  it('can show both infoSuccess and passSuccess at the same time', () => {
    renderPage({ infoSuccess: true, passSuccess: true })
    expect(screen.getByText(/profile updated successfully/i)).toBeDefined()
    expect(screen.getByText(/password changed successfully/i)).toBeDefined()
  })

  it('infoError and passError banners are visually distinct (both rendered)', () => {
    renderPage({
      infoError: 'Unique info error text',
      passError: 'Unique pass error text',
    })
    expect(screen.getByText('Unique info error text')).toBeDefined()
    expect(screen.getByText('Unique pass error text')).toBeDefined()
  })
})

// ── Null user edge case ───────────────────────────────────────────────────────

describe('ProfilePage — null user', () => {
  it('renders without crashing when user is null', () => {
    expect(() =>
      renderPage({ user: null }),
    ).not.toThrow()
  })

  it('does not show username/email in avatar section when user is null', () => {
    renderPage({ user: null })
    // Should not find "alice" text since user is null
    expect(screen.queryByText('alice')).toBeNull()
  })
})
