import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RegisterPage } from '@/pages/RegisterPage'
import { useRegisterController } from '@/controllers/useRegisterController'

vi.mock('@/controllers/useRegisterController', () => ({ useRegisterController: vi.fn() }))

function makeController(overrides: Record<string, unknown> = {}) {
  return {
    isLoading: false,
    error: null,
    success: false,
    handleRegister: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function renderPage(overrides: Record<string, unknown> = {}) {
  vi.mocked(useRegisterController).mockReturnValue(makeController(overrides) as any)
  return render(<MemoryRouter><RegisterPage /></MemoryRouter>)
}

beforeEach(() => vi.clearAllMocks())

describe('RegisterPage', () => {
  it('renders the Create Account title', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument()
  })

  it('renders the Create Account submit button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows success state with Account Created message', () => {
    renderPage({ success: true })
    expect(screen.getByText('Account Created!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start playing/i })).toBeInTheDocument()
  })

  it('does not render the form on success state', () => {
    renderPage({ success: true })
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument()
  })

  it('shows error message from the controller', () => {
    renderPage({ error: 'Email already in use' })
    expect(screen.getByText('Email already in use')).toBeInTheDocument()
  })

  it('disables the submit button while loading', () => {
    renderPage({ isLoading: true })
    // When isLoading the button shows "Loading..." spinner text
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled()
  })

  it('calls handleRegister with all fields on valid submission', async () => {
    const handleRegister = vi.fn().mockResolvedValue(undefined)
    renderPage({ handleRegister })

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(handleRegister).toHaveBeenCalledWith(
        'alice', 'alice@example.com', 'secret123', 'secret123'
      )
    })
  })

  it('shows validation errors and does not submit when fields are empty', async () => {
    const handleRegister = vi.fn()
    renderPage({ handleRegister })

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument()
      expect(screen.getByText('Email is required')).toBeInTheDocument()
    })
    expect(handleRegister).not.toHaveBeenCalled()
  })

  it('shows passwords do not match error', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })

  it('has a link to the login page', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })
})
