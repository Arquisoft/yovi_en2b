import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GameScreen from '../components/GameScreen'
import { afterEach, describe,  expect, test, vi } from 'vitest'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('GameScreen', () => {
  test('renders game board, timers, surrender button and chat', () => {
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    expect(screen.getByLabelText(/game board/i)).toBeInTheDocument()
    expect(screen.getByText(/player/i)).toBeInTheDocument()
    expect(screen.getByText(/opponent/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /surrender/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/type a message/i)).toBeInTheDocument()
  })

  test('player timer counts down', async () => {
    vi.useFakeTimers()
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    const playerTimer = screen.getByText(/player/i).nextSibling!
    expect(playerTimer.textContent).toBe('0:20') // Tiempo inicial

    act(() => {
      vi.advanceTimersByTime(1000) // 1 segundo
    })
    expect(playerTimer.textContent).toBe('0:19')

    act(() => {
      vi.advanceTimersByTime(5000) // +5 segundos
    })
    expect(playerTimer.textContent).toBe('0:14')

    act(() => {
      vi.advanceTimersByTime(15000) // +15 segundos
    })
    expect(playerTimer.textContent).toBe('0:00') // Nunca negativo
  })

  test('calls onSurrender when surrender button is clicked', async () => {
    const user = userEvent.setup()
    const surrenderMock = vi.fn()

    render(
      <MemoryRouter>
        <GameScreen onSurrender={surrenderMock} />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /surrender/i }))
    expect(surrenderMock).toHaveBeenCalled()
  })

  test('updates chat input when user types', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    const chatInput = screen.getByLabelText(/type a message/i)
    await user.type(chatInput, 'Hello world!')

    expect(chatInput).toHaveValue('Hello world!')
  })

  test('HexBoard renders correct number of tiles', () => {
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    const tiles = screen.getAllByRole('button', { name: /Tile row/i })
    // Generamos 8 filas: 8+7+6+5+4+3+2+1 = 36 tiles
    expect(tiles.length).toBe(36)
  })
})