import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterForm from '../components/RegisterForm'
import { afterEach, describe, expect, test, vi } from 'vitest'
import '@testing-library/jest-dom'

// Limpiar mocks después de cada test
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('RegisterForm', () => {
  test('shows validation error when username is empty', async () => {
    render(<RegisterForm />)
    const user = userEvent.setup()

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /lets go!/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/please enter a username/i)).toBeInTheDocument()
    })
  })

  test('submits username and displays success message', async () => {
    const user = userEvent.setup()

    // Mock fetch con éxito
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'User created' }),
    } as Response)

    render(<RegisterForm />)

    await act(async () => {
      await user.type(screen.getByLabelText(/whats your name\?/i), 'Pablo')
      await user.click(screen.getByRole('button', { name: /lets go!/i }))
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

    render(<RegisterForm />)

    await act(async () => {
      await user.type(screen.getByLabelText(/whats your name\?/i), 'Pablo')
      await user.click(screen.getByRole('button', { name: /lets go!/i }))
    })

    await waitFor(() => {
      expect(screen.getByText(/username already exists/i)).toBeInTheDocument()
    })
  })

  test('shows network error when fetch fails', async () => {
  const user = userEvent.setup()

  global.fetch = vi.fn().mockRejectedValueOnce(
    new Error('Network error')
  )

  render(<RegisterForm />)

  await act(async () => {
    await user.type(screen.getByLabelText(/whats your name\?/i), 'Pablo')
    await user.click(screen.getByRole('button', { name: /lets go!/i }))
  })

  await waitFor(() => {
    expect(screen.getByText(/network error/i)).toBeInTheDocument()
  })
})
})
