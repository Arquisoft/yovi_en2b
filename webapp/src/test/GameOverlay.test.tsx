// webapp/src/components/game-y/GameOverlay.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { GameOverlay } from '@/components/game-y/GameOverlay'
import type { GameState } from '@/types'

// ─── Canvas mock ─────────────────────────────────────────────────────────────
// jsdom doesn't implement canvas, so we stub getContext
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    set globalAlpha(_v: number) {},
    set fillStyle(_v: string) {},
  })
})

// ─── Fake timers ──────────────────────────────────────────────────────────────
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'game-1',
    status: 'finished',
    currentTurn: 'player1',
    winner: 'player1',
    moves: [
      { row: 0, col: 0, player: 'player1', timestamp: 1 },
      { row: 1, col: 0, player: 'player2', timestamp: 2 },
    ],
    board: [],
    config: {
      mode: 'pve',
      boardSize: 9,
      timerEnabled: false,
    },
    players: {
      player1: { id: 'user-1', name: 'Alice', color: 'player1' },
      player2: { id: 'bot',    name: 'Bot (medium)', color: 'player2', isBot: true },
    },
    timer: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

const defaultProps = {
  currentUserId: 'user-1',
  onPlayAgain: vi.fn(),
  onGoHome: vi.fn(),
}

function renderOverlay(game: GameState, props = defaultProps) {
  return render(<GameOverlay game={game} {...props} />)
}

function advance() {
  act(() => { vi.advanceTimersByTime(400) })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GameOverlay — visibility', () => {
  it('renders nothing when game is still playing', () => {
    const { container } = renderOverlay(makeGame({ status: 'playing', winner: null }))
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing immediately after game finishes (before delay)', () => {
    const { container } = renderOverlay(makeGame())
    expect(container.firstChild).toBeNull()
  })

  it('renders after 400ms delay', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('VICTORY')).toBeDefined()
  })

  it('does not render when game is waiting', () => {
    const { container } = renderOverlay(makeGame({ status: 'waiting', winner: null }))
    expect(container.firstChild).toBeNull()
  })
})

describe('GameOverlay — result labels', () => {
  it('shows VICTORY when user (player1) wins in pve', () => {
    renderOverlay(makeGame({ winner: 'player1' }))
    advance()
    expect(screen.getByText('VICTORY')).toBeDefined()
  })

  it('shows DEFEAT when user (player1) loses in pve', () => {
    renderOverlay(makeGame({ winner: 'player2' }))
    advance()
    expect(screen.getByText('DEFEAT')).toBeDefined()
  })

  it('shows VICTORY when user is player2 and player2 wins', () => {
    const game = makeGame({
      winner: 'player2',
      players: {
        player1: { id: 'opponent', name: 'Opponent', color: 'player1' },
        player2: { id: 'user-1',   name: 'Alice',    color: 'player2' },
      },
    })
    renderOverlay(game)
    advance()
    expect(screen.getByText('VICTORY')).toBeDefined()
  })

  it('shows DEFEAT when user is player2 and player1 wins', () => {
    const game = makeGame({
      winner: 'player1',
      players: {
        player1: { id: 'opponent', name: 'Opponent', color: 'player1' },
        player2: { id: 'user-1',   name: 'Alice',    color: 'player2' },
      },
    })
    renderOverlay(game)
    advance()
    expect(screen.getByText('DEFEAT')).toBeDefined()
  })

  it('shows DRAW when there is no winner', () => {
    renderOverlay(makeGame({ winner: null }))
    advance()
    expect(screen.getByText('DRAW')).toBeDefined()
  })

  it('shows VICTORY for pvp-local regardless of who won', () => {
    const game = makeGame({
      winner: 'player2',
      config: { mode: 'pvp-local', boardSize: 9, timerEnabled: false },
      players: {
        player1: { id: 'local-p1', name: 'Player 1', color: 'player1', isLocal: true },
        player2: { id: 'local-p2', name: 'Player 2', color: 'player2', isLocal: true },
      },
    })
    renderOverlay(game, { ...defaultProps, currentUserId: 'local-p1' })
    advance()
    expect(screen.getByText('VICTORY')).toBeDefined()
  })
})

describe('GameOverlay — winner subtitle', () => {
  it('shows winner name in local mode', () => {
    const game = makeGame({
      winner: 'player2',
      config: { mode: 'pvp-local', boardSize: 9, timerEnabled: false },
      players: {
        player1: { id: 'local-p1', name: 'Player 1', color: 'player1', isLocal: true },
        player2: { id: 'local-p2', name: 'Player 2', color: 'player2', isLocal: true },
      },
    })
    renderOverlay(game, { ...defaultProps, currentUserId: 'local-p1' })
    advance()
    expect(screen.getByText('Player 2 wins!')).toBeDefined()
  })

  it('shows "You beat [opponent]" in pve when user wins', () => {
    renderOverlay(makeGame({ winner: 'player1' }))
    advance()
    expect(screen.getByText('You beat')).toBeDefined()
    expect(screen.getByText('Bot (medium)')).toBeDefined()
  })

  it('shows "Beaten by [opponent]" when user loses', () => {
    renderOverlay(makeGame({ winner: 'player2' }))
    advance()
    expect(screen.getByText('Beaten by')).toBeDefined()
    expect(screen.getByText('Bot (medium)')).toBeDefined()
  })

  it('shows correct opponent when user is player2', () => {
    const game = makeGame({
      winner: 'player2',
      players: {
        player1: { id: 'alice', name: 'Alice', color: 'player1' },
        player2: { id: 'user-1', name: 'Bob',  color: 'player2' },
      },
    })
    renderOverlay(game)
    advance()
    expect(screen.getByText('Alice')).toBeDefined()
  })

  it('does not show subtitle when game is a draw', () => {
    renderOverlay(makeGame({ winner: null }))
    advance()
    expect(screen.queryByText('You beat')).toBeNull()
    expect(screen.queryByText('Beaten by')).toBeNull()
  })
})

describe('GameOverlay — stats', () => {
  it('shows move count', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows board size', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('9×9')).toBeDefined()
  })

  it('shows VS BOT mode label for pve', () => {
    renderOverlay(makeGame({ config: { mode: 'pve', boardSize: 9, timerEnabled: false } }))
    advance()
    expect(screen.getByText('VS BOT')).toBeDefined()
  })

  it('shows LOCAL mode label for pvp-local', () => {
    const game = makeGame({
      config: { mode: 'pvp-local', boardSize: 7, timerEnabled: false },
      players: {
        player1: { id: 'local-p1', name: 'P1', color: 'player1', isLocal: true },
        player2: { id: 'local-p2', name: 'P2', color: 'player2', isLocal: true },
      },
    })
    renderOverlay(game, { ...defaultProps, currentUserId: 'local-p1' })
    advance()
    expect(screen.getByText('LOCAL')).toBeDefined()
  })

  it('shows ONLINE mode label for pvp-online', () => {
    const game = makeGame({ config: { mode: 'pvp-online', boardSize: 9, timerEnabled: false } })
    renderOverlay(game)
    advance()
    expect(screen.getByText('ONLINE')).toBeDefined()
  })

  it('shows correct board size for non-default size', () => {
    renderOverlay(makeGame({ config: { mode: 'pve', boardSize: 13, timerEnabled: false } }))
    advance()
    expect(screen.getByText('13×13')).toBeDefined()
  })
})

describe('GameOverlay — icons', () => {
  it('shows trophy emoji on victory', () => {
    renderOverlay(makeGame({ winner: 'player1' }))
    advance()
    expect(screen.getByText('🏆')).toBeDefined()
  })

  it('shows handshake emoji on draw', () => {
    renderOverlay(makeGame({ winner: null }))
    advance()
    expect(screen.getByText('🤝')).toBeDefined()
  })

  it('does not show trophy on defeat', () => {
    renderOverlay(makeGame({ winner: 'player2' }))
    advance()
    expect(screen.queryByText('🏆')).toBeNull()
  })
})

describe('GameOverlay — buttons', () => {
  it('calls onPlayAgain when clicking Play Again', () => {
    const onPlayAgain = vi.fn()
    renderOverlay(makeGame(), { ...defaultProps, onPlayAgain })
    advance()
    fireEvent.click(screen.getByText('Play Again'))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
  })

  it('calls onGoHome when clicking Back to Games', () => {
    const onGoHome = vi.fn()
    renderOverlay(makeGame(), { ...defaultProps, onGoHome })
    advance()
    fireEvent.click(screen.getByText('Back to Games'))
    expect(onGoHome).toHaveBeenCalledTimes(1)
  })
})

describe('GameOverlay — close button', () => {
  it('renders a close button', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByTitle('Close and view board')).toBeDefined()
  })

  it('hides the overlay when close button is clicked', () => {
    renderOverlay(makeGame())
    advance()
    fireEvent.click(screen.getByTitle('Close and view board'))
    expect(screen.queryByText('VICTORY')).toBeNull()
  })

  it('hides Play Again button after closing', () => {
    renderOverlay(makeGame())
    advance()
    fireEvent.click(screen.getByTitle('Close and view board'))
    expect(screen.queryByText('Play Again')).toBeNull()
  })
})
