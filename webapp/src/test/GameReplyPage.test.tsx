import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameReplayPage } from '@/pages/GameReplayPage'
import { useGameReplayController } from '@/controllers/useGameReplayController'
import type { BoardCell, GameState, Move } from '@/types'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/controllers/useGameReplayController', () => ({
  useGameReplayController: vi.fn(),
}))

vi.mock('@/components/game-y/GameYBoard', () => ({
  GameYBoard: (props: any) => (
    <div data-testid="replay-board" data-is-interactive={String(props.isInteractive)}>
      Board
    </div>
  ),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ gameId: 'test-game' }),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBoardAtStep(size = 5): BoardCell[][] {
  return Array.from({ length: size }, (_, r) =>
    Array.from({ length: r + 1 }, (_, c) => ({ row: r, col: c, owner: null }))
  )
}

function makeMove(row: number, col: number, player: 'player1' | 'player2'): Move {
  return { row, col, player, timestamp: Date.now() }
}

function makeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'test-game',
    config: { mode: 'pve', boardSize: 5 as any, timerEnabled: false },
    status: 'finished',
    phase: 'playing',
    board: makeBoardAtStep(),
    players: {
      player1: { id: 'u1', name: 'Alice', color: 'player1' },
      player2: { id: 'bot', name: 'Bot (medium)', color: 'player2', isBot: true },
    },
    currentTurn: 'player1',
    moves: [
      makeMove(0, 0, 'player1'),
      makeMove(1, 0, 'player2'),
      makeMove(2, 0, 'player1'),
    ],
    winner: 'player1',
    timer: null,
    createdAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-01-15T10:05:00Z').toISOString(),
    ...overrides,
  }
}

function makeController(overrides = {}) {
  const game = makeGame()
  return {
    game,
    boardAtStep: makeBoardAtStep(),
    step: 3,
    totalMoves: 3,
    currentMove: makeMove(2, 0, 'player1'),
    isLoading: false,
    error: null,
    canGoBack: true,
    canGoForward: false,
    goBack: vi.fn(),
    goForward: vi.fn(),
    goToStart: vi.fn(),
    goToEnd: vi.fn(),
    setStep: vi.fn(),
    goToHistory: vi.fn(),
    ...overrides,
  }
}

function renderPage(controllerOverrides = {}) {
  vi.mocked(useGameReplayController).mockReturnValue(
    makeController(controllerOverrides) as any
  )
  return render(<GameReplayPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockReset()
})

// ─── Loading & error ──────────────────────────────────────────────────────────

describe('GameReplayPage — loading', () => {
  it('shows loading spinner when isLoading is true', () => {
    renderPage({ isLoading: true, game: null, boardAtStep: null })
    expect(document.querySelector('.animate-spin')).not.toBeNull()
  })

  it('does not render the board while loading', () => {
    renderPage({ isLoading: true, game: null, boardAtStep: null })
    expect(screen.queryByTestId('replay-board')).toBeNull()
  })
})

describe('GameReplayPage — error', () => {
  it('shows error message', () => {
    renderPage({ error: 'Game not found', game: null, boardAtStep: null })
    expect(screen.getByText('Game not found')).toBeDefined()
  })

  it('shows a back-to-history button on error', () => {
    renderPage({ error: 'Game not found', game: null, boardAtStep: null })
    expect(screen.getByText('Game History')).toBeDefined()
  })

  it('calls goToHistory on error back button click', () => {
    const goToHistory = vi.fn()
    renderPage({ error: 'Game not found', game: null, boardAtStep: null, goToHistory })
    fireEvent.click(screen.getByText('Game History'))
    expect(goToHistory).toHaveBeenCalled()
  })
})

// ─── Board rendering ──────────────────────────────────────────────────────────

describe('GameReplayPage — board', () => {
  it('renders the game board', () => {
    renderPage()
    expect(screen.getByTestId('replay-board')).toBeDefined()
  })

  it('board is always non-interactive (read-only replay)', () => {
    renderPage()
    const board = screen.getByTestId('replay-board')
    expect(board.dataset.isInteractive).toBe('false')
  })
})

// ─── Top bar information ──────────────────────────────────────────────────────

describe('GameReplayPage — top bar', () => {
  it('shows the Game History back link in the top bar', () => {
    renderPage()
    expect(screen.getByText('Game History')).toBeDefined()
  })

  it('calls goToHistory when back link is clicked', () => {
    const goToHistory = vi.fn()
    renderPage({ goToHistory })
    fireEvent.click(screen.getByText('Game History'))
    expect(goToHistory).toHaveBeenCalledOnce()
  })

  it('shows board size', () => {
    renderPage()
    expect(screen.getByText('5×5')).toBeDefined()
  })

  it('shows the game date', () => {
    renderPage()
    // Date formatting is locale-dependent, but year should always appear
    expect(screen.getByText(/2026/)).toBeDefined()
  })

  it('displays player1 name in legend', () => {
    renderPage()
    expect(screen.getAllByText('Alice')[0]).toBeDefined()
  })

  it('displays player2 name in legend', () => {
    renderPage()
    expect(screen.getByText('Bot (medium)')).toBeDefined()
  })

  it('shows "Win" result chip when human won', () => {
    renderPage()
    expect(screen.getByText('Win')).toBeDefined()
  })

  it('shows "Loss" result chip when human lost', () => {
    renderPage({ game: makeGame({ winner: 'player2' }) })
    expect(screen.getByText('Loss')).toBeDefined()
  })

  it('shows "vs Bot" mode chip for pve games', () => {
    renderPage()
    expect(screen.getByText('vs Bot')).toBeDefined()
  })

  it('shows "Local" mode chip for pvp-local games', () => {
    renderPage({
      game: makeGame({
        config: { mode: 'pvp-local', boardSize: 5 as any, timerEnabled: false },
        winner: 'player1',
        players: {
          player1: { id: 'u1', name: 'Alice', color: 'player1', isLocal: true },
          player2: { id: 'u2', name: 'Bob', color: 'player2', isLocal: true },
        },
      }),
    })
    expect(screen.getByText('Local')).toBeDefined()
  })
})

// ─── Controls ─────────────────────────────────────────────────────────────────

describe('GameReplayPage — controls', () => {
  it('renders all four navigation buttons', () => {
    renderPage({ canGoBack: true, canGoForward: true })
    const buttons = screen.getAllByRole('button')
    // Should have: go-to-start, previous, next, go-to-end (+ the topbar back link is a button too)
    expect(buttons.length).toBeGreaterThanOrEqual(4)
  })

  it('go-to-start button calls goToStart', () => {
    const goToStart = vi.fn()
    renderPage({ goToStart, canGoBack: true })
    const btn = screen.getByTitle('Go to start')
    fireEvent.click(btn)
    expect(goToStart).toHaveBeenCalledOnce()
  })

  it('previous button calls goBack', () => {
    const goBack = vi.fn()
    renderPage({ goBack, canGoBack: true })
    fireEvent.click(screen.getByTitle('Previous move'))
    expect(goBack).toHaveBeenCalledOnce()
  })

  it('next button calls goForward', () => {
    const goForward = vi.fn()
    renderPage({ goForward, canGoForward: true })
    fireEvent.click(screen.getByTitle('Next move'))
    expect(goForward).toHaveBeenCalledOnce()
  })

  it('go-to-end button calls goToEnd', () => {
    const goToEnd = vi.fn()
    renderPage({ goToEnd, canGoForward: true })
    fireEvent.click(screen.getByTitle('Go to end'))
    expect(goToEnd).toHaveBeenCalledOnce()
  })

  it('previous and go-to-start buttons are disabled when canGoBack is false', () => {
    renderPage({ canGoBack: false })
    const startBtn = screen.getByTitle('Go to start').closest('button') as HTMLButtonElement
    const prevBtn = screen.getByTitle('Previous move').closest('button') as HTMLButtonElement
    expect(startBtn.disabled).toBe(true)
    expect(prevBtn.disabled).toBe(true)
  })

  it('next and go-to-end buttons are disabled when canGoForward is false', () => {
    renderPage({ canGoForward: false })
    const nextBtn = screen.getByTitle('Next move').closest('button') as HTMLButtonElement
    const endBtn = screen.getByTitle('Go to end').closest('button') as HTMLButtonElement
    expect(nextBtn.disabled).toBe(true)
    expect(endBtn.disabled).toBe(true)
  })
})

// ─── Step counter & scrubber ──────────────────────────────────────────────────

describe('GameReplayPage — step display', () => {
  it('shows "End" when at the last step', () => {
    renderPage({ step: 3, totalMoves: 3, canGoForward: false })
    expect(screen.getByText('End')).toBeDefined()
  })

  it('shows "Start" when at step 0', () => {
    renderPage({ step: 0, totalMoves: 3, currentMove: null, canGoBack: false })
    expect(screen.getByText('Start')).toBeDefined()
  })

  it('shows "N / total" when at an intermediate step', () => {
    renderPage({ step: 2, totalMoves: 3, canGoBack: true, canGoForward: true })
    expect(screen.getByText('2 / 3')).toBeDefined()
  })

  it('renders the scrubber range input', () => {
    renderPage()
    const scrubber = screen.getByRole('slider')
    expect(scrubber).toBeDefined()
  })

  it('scrubber max equals totalMoves', () => {
    renderPage({ totalMoves: 3 })
    const scrubber = screen.getByRole('slider') as HTMLInputElement
    expect(scrubber.max).toBe('3')
  })

  it('scrubber value equals current step', () => {
    renderPage({ step: 2, totalMoves: 3 })
    const scrubber = screen.getByRole('slider') as HTMLInputElement
    expect(scrubber.value).toBe('2')
  })

  it('scrubber onChange calls setStep', () => {
    const setStep = vi.fn()
    renderPage({ setStep })
    const scrubber = screen.getByRole('slider')
    fireEvent.change(scrubber, { target: { value: '1' } })
    expect(setStep).toHaveBeenCalledWith(1)
  })
})

// ─── Move info ────────────────────────────────────────────────────────────────

describe('GameReplayPage — move info', () => {
  it('shows "Start position" at step 0', () => {
    renderPage({ step: 0, currentMove: null })
    expect(screen.getByText('Start position')).toBeDefined()
  })

  it('shows the player name who made the current move', () => {
    renderPage({ step: 2, currentMove: makeMove(2, 0, 'player1') })
    expect(screen.getAllByText('Alice')[0]).toBeDefined()
  })

  it('shows coordinates of the current move', () => {
    renderPage({ step: 2, currentMove: makeMove(2, 0, 'player1') })
    // The "played at (row, col)" string should appear
    expect(screen.getByText(/played at \(2, 0\)/)).toBeDefined()
  })
})

// ─── Keyboard hint ────────────────────────────────────────────────────────────

describe('GameReplayPage — keyboard hint', () => {
  it('renders the keyboard hint text', () => {
    renderPage()
    expect(screen.getByText(/← →/)).toBeDefined()
  })
})