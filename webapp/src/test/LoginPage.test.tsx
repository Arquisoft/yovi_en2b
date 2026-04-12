import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from '@/pages/LoginPage'
import { useLoginController } from '@/controllers/useLoginController'

vi.mock('@/controllers/useLoginController', () => ({ useLoginController: vi.fn() }))

function makeController(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    error: null,
    handleLogin: vi.fn().mockResolvedValue(undefined),
    handleGuestLogin: vi.fn(),
    ...overrides,
  }
}

function renderPage(overrides: Record<string, unknown> = {}) {
  vi.mocked(useLoginController).mockReturnValue(makeController(overrides) as any)
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('LoginPage', () => {
  it('renders the YOVI welcome title', () => {
    renderPage()
    expect(screen.getByText('Welcome to YOVI')).toBeInTheDocument()
  })

  it('renders Sign In and Play as Guest buttons', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /play as guest/i })).toBeInTheDocument()
  })

  it('shows error message from the controller', () => {
    renderPage({ error: 'Invalid credentials' })
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
  })

  it('disables inputs while loading', () => {
    renderPage({ isLoading: true })
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Password')).toBeDisabled()
  })

  it('calls handleGuestLogin when Play as Guest is clicked', () => {
    const handleGuestLogin = vi.fn()
    renderPage({ handleGuestLogin })
    fireEvent.click(screen.getByRole('button', { name: /play as guest/i }))
    expect(handleGuestLogin).toHaveBeenCalledOnce()
  })

  it('calls handleLogin with email and password on valid submission', async () => {
    const handleLogin = vi.fn().mockResolvedValue(undefined)
    renderPage({ handleLogin })

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'mypassword' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(handleLogin).toHaveBeenCalledWith('user@example.com', 'mypassword')
    })
  })

  it('shows validation errors and does not call handleLogin when fields are empty', async () => {
    const handleLogin = vi.fn()
    renderPage({ handleLogin })

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
    expect(handleLogin).not.toHaveBeenCalled()
  })

  it('has a link to the register page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /create one/i })).toBeInTheDocument()
  })

  it('toggles password visibility when eye icon is clicked', () => {
    renderPage()
    const passwordInput = screen.getByLabelText('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: /show password/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: /hide password/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
