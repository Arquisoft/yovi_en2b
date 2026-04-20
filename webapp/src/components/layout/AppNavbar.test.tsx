import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppNavbar } from './AppNavbar'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/i18n/LanguageContext'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: vi.fn() }))
vi.mock('@/i18n/LanguageContext', () => ({ useLanguage: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

function renderNavbar(
  authOverrides: Record<string, unknown> = {},
  themeOverrides: Record<string, unknown> = {}
) {
  vi.mocked(useAuth).mockReturnValue({
    user: mockUser,
    logout: vi.fn(),
    isGuest: false,
    ...authOverrides,
  } as any)
  vi.mocked(useTheme).mockReturnValue({
    theme: 'dark',
    toggleTheme: vi.fn(),
    setTheme: vi.fn(),
    ...themeOverrides,
  } as any)
  vi.mocked(useLanguage).mockReturnValue({
     locale: 'en',
     toggleLanguage: vi.fn(),
     setLanguage: vi.fn(),
   } as any)
  return render(
    <MemoryRouter>
      <AppNavbar />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AppNavbar — branding', () => {
  it('renders the YOVI brand name', () => {
    renderNavbar()
    expect(screen.getByText('YOVI')).toBeDefined()
  })
})

describe('AppNavbar — language toggle button', () => {
  it('renders the language toggle button', () => {
    renderNavbar()
    expect(screen.getByLabelText('Switch language')).toBeDefined()
  })
 
  it('language button is always visible (not gated behind user auth)', () => {
    renderNavbar({ user: null })
    expect(screen.getByLabelText('Switch language')).toBeDefined()
  })
})


describe('AppNavbar — user section', () => {
  it('shows username when a user is logged in', () => {
    renderNavbar()
    expect(screen.getByText('testuser')).toBeDefined()
  })

  it('shows "Guest" badge when user is a guest', () => {
    renderNavbar({ isGuest: true })
    expect(screen.getByText('Guest')).toBeDefined()
  })

  it('does not show "Guest" badge for a regular authenticated user', () => {
    renderNavbar({ isGuest: false })
    expect(screen.queryByText('Guest')).toBeNull()
  })

  it('hides user controls when no user is logged in', () => {
    renderNavbar({ user: null })
    expect(screen.queryByText('testuser')).toBeNull()
    expect(screen.queryByLabelText('Logout')).toBeNull()
    expect(screen.queryByLabelText('Statistics')).toBeNull()
  })
})

describe('AppNavbar — theme toggle', () => {
  it('calls toggleTheme when the theme button is clicked', () => {
    const toggleTheme = vi.fn()
    renderNavbar({}, { toggleTheme })
    fireEvent.click(screen.getByLabelText('Toggle theme'))
    expect(toggleTheme).toHaveBeenCalledOnce()
  })

  it('renders the toggle button for dark theme', () => {
    renderNavbar({}, { theme: 'dark' })
    expect(screen.getByLabelText('Toggle theme')).toBeDefined()
  })

  it('renders the toggle button for light theme', () => {
    renderNavbar({}, { theme: 'light' })
    expect(screen.getByLabelText('Toggle theme')).toBeDefined()
  })
})

describe('AppNavbar — navigation buttons', () => {
  it('navigates to /stats when Statistics button is clicked', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Statistics'))
    expect(mockNavigate).toHaveBeenCalledWith('/stats')
  })
 it('navigates to /history when Game History button is clicked', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Game History'))
    expect(mockNavigate).toHaveBeenCalledWith('/history')
  })
  it('navigates to /ranking when Ranking button is clicked', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Ranking'))
    expect(mockNavigate).toHaveBeenCalledWith('/ranking')
  })
})

describe('AppNavbar — logout flow', () => {
  it('opens the logout confirmation dialog when Logout is clicked', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Logout'))
    expect(screen.getByText('Are you sure you want to sign out of your account?')).toBeDefined()
  })

  it('calls logout and navigates to /login when confirmed', () => {
    const logout = vi.fn()
    renderNavbar({ logout })
    fireEvent.click(screen.getByLabelText('Logout'))
    // The footer "Sign out" button — use role to target the button only
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(logout).toHaveBeenCalledOnce()
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('does not call logout when Cancel is clicked', () => {
    const logout = vi.fn()
    renderNavbar({ logout })
    fireEvent.click(screen.getByLabelText('Logout'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(logout).not.toHaveBeenCalled()
  })
})

describe('AppNavbar — i18n string rendering', () => {
  it('renders the brand name from t("app.name")', () => {
    renderNavbar()
    expect(screen.getByText('YOVI')).toBeDefined()
  })
 
  it('theme toggle button uses t("nav.toggleTheme") as aria-label', () => {
    renderNavbar()
    expect(screen.getByLabelText('Toggle theme')).toBeDefined()
  })
 
  it('statistics button uses t("nav.statistics") as aria-label', () => {
    renderNavbar()
    expect(screen.getByLabelText('Statistics')).toBeDefined()
  })
 
  it('ranking button uses t("nav.ranking") as aria-label', () => {
    renderNavbar()
    expect(screen.getByLabelText('Ranking')).toBeDefined()
  })
 
  it('logout button uses t("nav.logout") as aria-label', () => {
    renderNavbar()
    expect(screen.getByLabelText('Logout')).toBeDefined()
  })
 
  it('shows t("nav.guestBadge") for guest users', () => {
    renderNavbar({ isGuest: true })
    expect(screen.getByText('Guest')).toBeDefined()
  })
 
  it('logout dialog uses t("nav.signOutConfirmDescription")', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Logout'))
    expect(screen.getByText('Are you sure you want to sign out of your account?')).toBeDefined()
  })
 
  it('logout dialog cancel button uses t("common.cancel")', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Logout'))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDefined()
  })
 
  it('logout dialog confirm button uses t("nav.signOut")', () => {
    renderNavbar()
    fireEvent.click(screen.getByLabelText('Logout'))
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeDefined()
  })
})