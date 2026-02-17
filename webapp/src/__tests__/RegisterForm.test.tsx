import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterForm from '../RegisterForm'
import { afterEach, describe, expect, test, vi } from 'vitest' 
import '@testing-library/jest-dom'

describe('RegisterForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows validation error when username is empty', async () => {
    render(<RegisterForm />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /lets go!/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a username/i)).toBeInTheDocument()
    })
  })

  test('submits username and displays response', async () => {
    const user = userEvent.setup()

    // Mock fetch - el componente ahora ignora data.message y genera su propio mensaje
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    } as Response)

    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/whats your name\?/i), 'Pablo')
    await user.click(screen.getByRole('button', { name: /lets go!/i }))

    // El componente muestra "Hello Pablo" (sin el texto adicional)
    await waitFor(() => {
      expect(screen.getByText(/hello pablo/i)).toBeInTheDocument()
    })
    
    // Espera a que loading termine completamente
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /lets go!/i })).toBeInTheDocument()
    })
    
    // Verifica que fetch fue llamado correctamente
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

    // Mock fetch con error
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Username already exists' }),
    } as Response)

    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/whats your name\?/i), 'Pablo')
    await user.click(screen.getByRole('button', { name: /lets go!/i }))

    await waitFor(() => {
      expect(screen.getByText(/username already exists/i)).toBeInTheDocument()
    })
    
    // Espera a que loading termine completamente
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /lets go!/i })).toBeInTheDocument()
    })
  })
})
