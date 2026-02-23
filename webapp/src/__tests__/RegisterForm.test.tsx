import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterForm from '../components/RegisterForm'
import { afterEach, describe, expect, test, vi } from 'vitest'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'

// Limpiar mocks después de cada test
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('RegisterForm', () => {
  test('shows validation error when fields are empty', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /register/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/all fields are required/i)).toBeInTheDocument()
    })
  })

  test('submits form successfully and shows success message', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'User created' }),
    } as Response)

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    await act(async () => {
      await user.type(screen.getByLabelText(/username/i), 'Pablo')
      await user.type(screen.getByLabelText(/email/i), 'pablo@test.com')
      await user.type(screen.getByPlaceholderText(/password/i), 'Password123!')
      await user.click(screen.getByRole('button', { name: /register/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/hello pablo/i)).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Pablo',
          email: 'pablo@test.com',
          password: 'Password123!'
        })
      })
    )
  })

  test('displays server error when username/email already exists', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Username already exists' }),
    } as Response)

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    await act(async () => {
      await user.type(screen.getByLabelText(/username/i), 'Pablo')
      await user.type(screen.getByLabelText(/email/i), 'pablo@test.com')
      await user.type(screen.getByPlaceholderText(/password/i), 'Password123!')
      await user.click(screen.getByRole('button', { name: /register/i }))
    })

    await waitFor(() => {
      // Match con el mensaje que realmente renderiza tu componente
      expect(
        screen.getByText(/username or email already registered/i)
      ).toBeInTheDocument()
    })
  })

  test('shows network error when fetch fails', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    await act(async () => {
      await user.type(screen.getByLabelText(/username/i), 'Pablo')
      await user.type(screen.getByLabelText(/email/i), 'pablo@test.com')
      await user.type(screen.getByPlaceholderText(/password/i), 'Password123!')
      await user.click(screen.getByRole('button', { name: /register/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })
    test('toggles password visibility', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    )

    const passwordInput = screen.getByPlaceholderText(/password/i)
    const toggleButton = screen.getByRole('button', { name: /show password/i })

    // Inicialmente tipo password
    expect(passwordInput).toHaveAttribute('type', 'password')

    await act(async () => {
      await user.click(toggleButton)
    })

    // Ahora tipo text
    expect(passwordInput).toHaveAttribute('type', 'text')

    await act(async () => {
      await user.click(toggleButton)
    })

    // Vuelve a password
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})

