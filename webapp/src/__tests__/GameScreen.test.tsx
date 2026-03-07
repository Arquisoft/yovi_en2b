import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GameScreen from '../components/GameScreen'
import { afterEach, describe, expect, test, vi } from 'vitest'
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

    act(() => { vi.advanceTimersByTime(1000) })
    expect(playerTimer.textContent).toBe('0:19')

    act(() => { vi.advanceTimersByTime(5000) })
    expect(playerTimer.textContent).toBe('0:14')

    act(() => { vi.advanceTimersByTime(15000) })
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
    // 8 filas: 8+7+6+5+4+3+2+1 = 36 tiles
    expect(tiles.length).toBe(36)
  })

  test('all tiles start as white (empty)', () => {
    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    const tiles = screen.getAllByRole('button', { name: /Tile row/i })
    tiles.forEach(tile => {
      expect(tile.className).toContain('hex-tile--white')
    })
  })

  test('clicking a tile places the human piece and calls the bot API', async () => {
    const user = userEvent.setup()

    // Bot responde con x:7,y:0 → índice plano 0 (la cima del tablero en YEN)
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ api_version: 'v1', bot_id: 'random', coords: { x: 7, y: 0, z: 0 } }),
    } as Response)

    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    // Tile visual row=0 col=0 corresponde a la fila YEN más grande (base)
    const firstTile = screen.getAllByRole('button', { name: /Tile row 0 column 0/i })[0]
    await user.click(firstTile)

    // El tile clickado debe cambiar a copper (B = jugador humano)
    await waitFor(() => {
      expect(firstTile.className).toContain('hex-tile--copper')
    })

    // Debe haberse llamado al bot
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/ybot/choose/random'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  test('bot response places the bot piece on the board', async () => {
    const user = userEvent.setup()

    // Bot elige x:6, y:0 → fila YEN 1 (r=1), índice plano = 1
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ api_version: 'v1', bot_id: 'random', coords: { x: 6, y: 0, z: 1 } }),
    } as Response)

    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    const firstTile = screen.getAllByRole('button', { name: /Tile row 0 column 0/i })[0]
    await user.click(firstTile)

    // Tras la respuesta del bot debe aparecer algún tile silver (R = bot)
    await waitFor(() => {
      const silverTiles = document.querySelectorAll('.hex-tile--silver')
      expect(silverTiles.length).toBeGreaterThan(0)
    })
  })

  test('tiles are disabled while bot is thinking', async () => {
    const user = userEvent.setup()

    // Fetch que nunca resuelve → bot siempre pensando
    global.fetch = vi.fn().mockReturnValueOnce(new Promise(() => {}))

    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    const firstTile = screen.getAllByRole('button', { name: /Tile row 0 column 0/i })[0]
    await user.click(firstTile)

    // Mientras el bot piensa, todos los tiles deben estar deshabilitados
    await waitFor(() => {
      expect(screen.getByText(/bot is thinking/i)).toBeInTheDocument()
    })

    const tiles = screen.getAllByRole('button', { name: /Tile row/i })
    tiles.forEach(tile => {
      expect(tile).toBeDisabled()
    })
  })

  test('shows error message when bot API fails', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Internal server error' }),
    } as Response)

    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    const firstTile = screen.getAllByRole('button', { name: /Tile row 0 column 0/i })[0]
    await user.click(firstTile)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('alert').textContent).toContain('Bot error')
    })
  })

  test('already occupied tiles cannot be clicked', async () => {
    const user = userEvent.setup()

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ api_version: 'v1', bot_id: 'random', coords: { x: 6, y: 1, z: 0 } }),
    } as Response)

    render(
      <MemoryRouter>
        <GameScreen />
      </MemoryRouter>
    )

    const firstTile = screen.getAllByRole('button', { name: /Tile row 0 column 0/i })[0]

    // Primer click: coloca la ficha
    await user.click(firstTile)
    await waitFor(() => expect(firstTile.className).toContain('hex-tile--copper'))

    // Segundo click: el tile ya está ocupado, debe estar deshabilitado
    expect(firstTile).toBeDisabled()
    expect(global.fetch).toHaveBeenCalledTimes(1) // no llama al bot de nuevo
  })
})