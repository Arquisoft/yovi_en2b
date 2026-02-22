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
  test('shows validation error when username is empty', async () => {
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

  test('submits username and displays success message', async () => {
    const user = userEvent.setup()

    // Mock fetch con éxito
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
      await user.type(screen.getByLabelText(/password/i), 'Password123!')
      await user.click(screen.getByRole('button', { name: /register/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/hello pablo/i)).toBeInTheDocument()
    })

    // Verifica que fetch fue llamado con los datos correctos
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

  test('displays error message on failed request', async () => {
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
      await user.type(screen.getByLabelText(/password/i), 'Password123!')
      await user.click(screen.getByRole('button', { name: /register/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/username already exists/i)).toBeInTheDocument()
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
      await user.type(screen.getByLabelText(/password/i), 'Password123!')
      await user.click(screen.getByRole('button', { name: /register/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })
})