// webapp/src/components/game-y/GameOverlay.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import {
  GameOverlay,
  ResultIcon,
  ResultSubtitle,
  resolveResult,
  getModeLabel,
  getAccentColor,
  PRIMARY_COLOR,
  DESTRUCTIVE_COLOR,
} from '@/components/game-y/GameOverlay'
import type { GameState } from '@/types'

// ─── Canvas mock ──────────────────────────────────────────────────────────────
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    fillRect: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(),
    set globalAlpha(_v: number) {},
    set fillStyle(_v: string) {},
  })
  vi.useFakeTimers()
})
afterEach(() => { vi.useRealTimers() })

// ─── Factories ────────────────────────────────────────────────────────────────

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
    config: { mode: 'pve', boardSize: 9, timerEnabled: false },
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

const baseProps = {
  currentUserId: 'user-1',
  onPlayAgain: vi.fn(),
  onGoHome: vi.fn(),
}

function renderOverlay(game: GameState, props = baseProps) {
  return render(<GameOverlay game={game} {...props} />)
}

function advance() {
  act(() => { vi.advanceTimersByTime(400) })
}

// ─── resolveResult ────────────────────────────────────────────────────────────

describe('resolveResult', () => {
  it('returns DRAW when no winner', () => {
    const r = resolveResult(makeGame({ winner: null }), 'user-1')
    expect(r.resultLabel).toBe('DRAW')
    expect(r.isVictory).toBe(false)
    expect(r.winnerName).toBe('')
  })

  it('returns VICTORY for player1 winning as player1', () => {
    const r = resolveResult(makeGame({ winner: 'player1' }), 'user-1')
    expect(r.resultLabel).toBe('VICTORY')
    expect(r.isVictory).toBe(true)
    expect(r.winnerName).toBe('Alice')
  })

  it('returns DEFEAT for player1 losing as player1', () => {
    const r = resolveResult(makeGame({ winner: 'player2' }), 'user-1')
    expect(r.resultLabel).toBe('DEFEAT')
    expect(r.isVictory).toBe(false)
  })

  it('returns VICTORY for player2 winning as player2', () => {
    const game = makeGame({
      winner: 'player2',
      players: {
        player1: { id: 'opponent', name: 'Opponent', color: 'player1' },
        player2: { id: 'user-1',   name: 'Alice',    color: 'player2' },
      },
    })
    const r = resolveResult(game, 'user-1')
    expect(r.resultLabel).toBe('VICTORY')
    expect(r.isVictory).toBe(true)
  })

  it('returns DEFEAT for player2 losing as player2', () => {
    const game = makeGame({
      winner: 'player1',
      players: {
        player1: { id: 'opponent', name: 'Opponent', color: 'player1' },
        player2: { id: 'user-1',   name: 'Alice',    color: 'player2' },
      },
    })
    const r = resolveResult(game, 'user-1')
    expect(r.resultLabel).toBe('DEFEAT')
    expect(r.isVictory).toBe(false)
  })

  it('returns VICTORY in pvp-local regardless of currentUserId', () => {
    const game = makeGame({
      winner: 'player2',
      config: { mode: 'pvp-local', boardSize: 9, timerEnabled: false },
      players: {
        player1: { id: 'p1', name: 'Player 1', color: 'player1', isLocal: true },
        player2: { id: 'p2', name: 'Player 2', color: 'player2', isLocal: true },
      },
    })
    const r = resolveResult(game, 'p1')
    expect(r.isVictory).toBe(true)
    expect(r.resultLabel).toBe('VICTORY')
    expect(r.winnerName).toBe('Player 2')
  })

  it('sets opponentName correctly when user is player1', () => {
    const r = resolveResult(makeGame(), 'user-1')
    expect(r.opponentName).toBe('Bot (medium)')
  })

  it('sets opponentName correctly when user is player2', () => {
    const game = makeGame({
      players: {
        player1: { id: 'alice', name: 'Alice', color: 'player1' },
        player2: { id: 'user-1', name: 'Bob',  color: 'player2' },
      },
    })
    const r = resolveResult(game, 'user-1')
    expect(r.opponentName).toBe('Alice')
  })

  it('sets opponentName to null for spectator', () => {
    const r = resolveResult(makeGame(), 'spectator-id')
    expect(r.opponentName).toBeNull()
  })

  it('uses player2 name as winnerName when player2 wins', () => {
    const r = resolveResult(makeGame({ winner: 'player2' }), 'user-1')
    expect(r.winnerName).toBe('Bot (medium)')
  })
})

// ─── getModeLabel ─────────────────────────────────────────────────────────────

describe('getModeLabel', () => {
  it('returns VS BOT for pve', () => {
    expect(getModeLabel('pve')).toBe('VS BOT')
  })
  it('returns LOCAL for pvp-local', () => {
    expect(getModeLabel('pvp-local')).toBe('LOCAL')
  })
  it('returns ONLINE for pvp-online', () => {
    expect(getModeLabel('pvp-online')).toBe('ONLINE')
  })
})

// ─── getAccentColor ───────────────────────────────────────────────────────────

describe('getAccentColor', () => {
  it('returns primary on victory', () => {
    expect(getAccentColor(true, true)).toBe(PRIMARY_COLOR)
  })
  it('returns destructive on defeat', () => {
    expect(getAccentColor(false, true)).toBe(DESTRUCTIVE_COLOR)
  })
  it('returns grey on draw', () => {
    expect(getAccentColor(false, false)).toBe('#888')
  })
})

// ─── ResultIcon ───────────────────────────────────────────────────────────────

describe('ResultIcon', () => {
  it('renders trophy emoji on victory', () => {
    render(<ResultIcon isVictory hasWinner />)
    expect(screen.getByText('🏆')).toBeDefined()
  })

  it('renders skull on defeat', () => {
    const { container } = render(<ResultIcon isVictory={false} hasWinner />)
    // Skull is an SVG from lucide — check the wrapper circle exists
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders handshake on draw', () => {
    render(<ResultIcon isVictory={false} hasWinner={false} />)
    expect(screen.getByText('🤝')).toBeDefined()
  })

  it('does not render trophy when not victory', () => {
    render(<ResultIcon isVictory={false} hasWinner />)
    expect(screen.queryByText('🏆')).toBeNull()
  })

  it('does not render handshake when there is a winner', () => {
    render(<ResultIcon isVictory={false} hasWinner />)
    expect(screen.queryByText('🤝')).toBeNull()
  })
})

// ─── ResultSubtitle ───────────────────────────────────────────────────────────

describe('ResultSubtitle', () => {
  const base = { accentColor: PRIMARY_COLOR }

  it('shows "X wins!" in local mode', () => {
    render(<ResultSubtitle isLocalGame isVictory={false} winnerName="Player 2" opponentName={null} {...base} />)
    expect(screen.getByText('Player 2 wins!')).toBeDefined()
  })

  it('shows "You beat [opponent]" on victory in online mode', () => {
    render(<ResultSubtitle isLocalGame={false} isVictory winnerName="Alice" opponentName="Bot" {...base} />)
    expect(screen.getByText('You beat ')).toBeDefined()
    expect(screen.getByText('Bot')).toBeDefined()
  })

  it('shows "Beaten by [opponent]" on defeat in online mode', () => {
    render(<ResultSubtitle isLocalGame={false} isVictory={false} winnerName="Bot" opponentName="Bot" {...base} />)
    expect(screen.getByText('Beaten by ')).toBeDefined()
  })

  it('renders opponent name with accent color span', () => {
    const { container } = render(
      <ResultSubtitle isLocalGame={false} isVictory winnerName="Alice" opponentName="Rival" {...base} />
    )
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('Rival')
  })
})

// ─── GameOverlay visibility ───────────────────────────────────────────────────

describe('GameOverlay — visibility', () => {
  it('renders nothing when game is playing', () => {
    const { container } = renderOverlay(makeGame({ status: 'playing', winner: null }))
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing immediately after finish (before 400ms)', () => {
    const { container } = renderOverlay(makeGame())
    expect(container.firstChild).toBeNull()
  })

  it('renders after 400ms', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('VICTORY')).toBeDefined()
  })

  it('renders nothing when status is waiting', () => {
    const { container } = renderOverlay(makeGame({ status: 'waiting', winner: null }))
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when status is abandoned', () => {
    const { container } = renderOverlay(makeGame({ status: 'abandoned', winner: null }))
    expect(container.firstChild).toBeNull()
  })
})

// ─── GameOverlay result labels ────────────────────────────────────────────────

describe('GameOverlay — result labels', () => {
  it('shows VICTORY when player1 wins as player1', () => {
    renderOverlay(makeGame({ winner: 'player1' }))
    advance()
    expect(screen.getByText('VICTORY')).toBeDefined()
  })

  it('shows DEFEAT when player2 wins as player1', () => {
    renderOverlay(makeGame({ winner: 'player2' }))
    advance()
    expect(screen.getByText('DEFEAT')).toBeDefined()
  })

  it('shows VICTORY when player2 wins as player2', () => {
    const game = makeGame({
      winner: 'player2',
      players: {
        player1: { id: 'opp',    name: 'Opp',   color: 'player1' },
        player2: { id: 'user-1', name: 'Alice',  color: 'player2' },
      },
    })
    renderOverlay(game)
    advance()
    expect(screen.getByText('VICTORY')).toBeDefined()
  })

  it('shows DEFEAT when player1 wins as player2', () => {
    const game = makeGame({
      winner: 'player1',
      players: {
        player1: { id: 'opp',    name: 'Opp',  color: 'player1' },
        player2: { id: 'user-1', name: 'Alice', color: 'player2' },
      },
    })
    renderOverlay(game)
    advance()
    expect(screen.getByText('DEFEAT')).toBeDefined()
  })

  it('shows DRAW when no winner', () => {
    renderOverlay(makeGame({ winner: null }))
    advance()
    expect(screen.getByText('DRAW')).toBeDefined()
  })

  it('shows VICTORY for pvp-local', () => {
    const game = makeGame({
      winner: 'player2',
      config: { mode: 'pvp-local', boardSize: 9, timerEnabled: false },
      players: {
        player1: { id: 'p1', name: 'Player 1', color: 'player1', isLocal: true },
        player2: { id: 'p2', name: 'Player 2', color: 'player2', isLocal: true },
      },
    })
    renderOverlay(game, { ...baseProps, currentUserId: 'p1' })
    advance()
    expect(screen.getByText('VICTORY')).toBeDefined()
  })
})

// ─── GameOverlay subtitles ────────────────────────────────────────────────────

describe('GameOverlay — subtitles', () => {
  it('shows winner name in local mode', () => {
    const game = makeGame({
      winner: 'player2',
      config: { mode: 'pvp-local', boardSize: 9, timerEnabled: false },
      players: {
        player1: { id: 'p1', name: 'Player 1', color: 'player1', isLocal: true },
        player2: { id: 'p2', name: 'Player 2', color: 'player2', isLocal: true },
      },
    })
    renderOverlay(game, { ...baseProps, currentUserId: 'p1' })
    advance()
    expect(screen.getByText('Player 2 wins!')).toBeDefined()
  })

  it('shows "You beat" on victory', () => {
    renderOverlay(makeGame({ winner: 'player1' }))
    advance()
    expect(screen.getByText('You beat ')).toBeDefined()
  })

  it('shows "Beaten by" on defeat', () => {
    renderOverlay(makeGame({ winner: 'player2' }))
    advance()
    expect(screen.getByText('Beaten by ')).toBeDefined()
  })

  it('shows correct opponent name on victory', () => {
    renderOverlay(makeGame({ winner: 'player1' }))
    advance()
    expect(screen.getByText('Bot (medium)')).toBeDefined()
  })

  it('shows correct opponent name on defeat', () => {
    renderOverlay(makeGame({ winner: 'player2' }))
    advance()
    expect(screen.getByText('Bot (medium)')).toBeDefined()
  })

  it('does not show subtitle on draw', () => {
    renderOverlay(makeGame({ winner: null }))
    advance()
    expect(screen.queryByText('You beat ')).toBeNull()
    expect(screen.queryByText('Beaten by ')).toBeNull()
  })
})

// ─── GameOverlay stats ────────────────────────────────────────────────────────

describe('GameOverlay — stats', () => {
  it('shows move count', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows zero moves when none played', () => {
    renderOverlay(makeGame({ moves: [] }))
    advance()
    expect(screen.getByText('0')).toBeDefined()
  })

  it('shows board size', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('9×9')).toBeDefined()
  })

  it('shows board size for 13', () => {
    renderOverlay(makeGame({ config: { mode: 'pve', boardSize: 13, timerEnabled: false } }))
    advance()
    expect(screen.getByText('13×13')).toBeDefined()
  })

  it('shows VS BOT for pve', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('VS BOT')).toBeDefined()
  })

  it('shows LOCAL for pvp-local', () => {
    const game = makeGame({
      config: { mode: 'pvp-local', boardSize: 9, timerEnabled: false },
      players: {
        player1: { id: 'p1', name: 'P1', color: 'player1', isLocal: true },
        player2: { id: 'p2', name: 'P2', color: 'player2', isLocal: true },
      },
    })
    renderOverlay(game, { ...baseProps, currentUserId: 'p1' })
    advance()
    expect(screen.getByText('LOCAL')).toBeDefined()
  })

  it('shows ONLINE for pvp-online', () => {
    renderOverlay(makeGame({ config: { mode: 'pvp-online', boardSize: 9, timerEnabled: false } }))
    advance()
    expect(screen.getByText('ONLINE')).toBeDefined()
  })

  it('shows stat labels', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('Moves')).toBeDefined()
    expect(screen.getByText('Board')).toBeDefined()
    expect(screen.getByText('Mode')).toBeDefined()
  })
})

// ─── GameOverlay icons ────────────────────────────────────────────────────────

describe('GameOverlay — icons', () => {
  it('shows trophy on victory', () => {
    renderOverlay(makeGame({ winner: 'player1' }))
    advance()
    expect(screen.getByText('🏆')).toBeDefined()
  })

  it('shows handshake on draw', () => {
    renderOverlay(makeGame({ winner: null }))
    advance()
    expect(screen.getByText('🤝')).toBeDefined()
  })

  it('does not show trophy on defeat', () => {
    renderOverlay(makeGame({ winner: 'player2' }))
    advance()
    expect(screen.queryByText('🏆')).toBeNull()
  })

  it('does not show handshake on defeat', () => {
    renderOverlay(makeGame({ winner: 'player2' }))
    advance()
    expect(screen.queryByText('🤝')).toBeNull()
  })
})

// ─── GameOverlay buttons ──────────────────────────────────────────────────────

describe('GameOverlay — buttons', () => {
  it('calls onPlayAgain on click', () => {
    const onPlayAgain = vi.fn()
    renderOverlay(makeGame(), { ...baseProps, onPlayAgain })
    advance()
    fireEvent.click(screen.getByText('Play Again'))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
  })

  it('calls onGoHome on click', () => {
    const onGoHome = vi.fn()
    renderOverlay(makeGame(), { ...baseProps, onGoHome })
    advance()
    fireEvent.click(screen.getByText('Back to Games'))
    expect(onGoHome).toHaveBeenCalledTimes(1)
  })

  it('renders both buttons', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByText('Play Again')).toBeDefined()
    expect(screen.getByText('Back to Games')).toBeDefined()
  })
})

// ─── GameOverlay close ────────────────────────────────────────────────────────

describe('GameOverlay — close button', () => {
  it('renders close button', () => {
    renderOverlay(makeGame())
    advance()
    expect(screen.getByTitle('Close and view board')).toBeDefined()
  })

  it('hides overlay on close', () => {
    renderOverlay(makeGame())
    advance()
    fireEvent.click(screen.getByTitle('Close and view board'))
    expect(screen.queryByText('VICTORY')).toBeNull()
  })

  it('hides all buttons after closing', () => {
    renderOverlay(makeGame())
    advance()
    fireEvent.click(screen.getByTitle('Close and view board'))
    expect(screen.queryByText('Play Again')).toBeNull()
    expect(screen.queryByText('Back to Games')).toBeNull()
  })

  it('hides stats after closing', () => {
    renderOverlay(makeGame())
    advance()
    fireEvent.click(screen.getByTitle('Close and view board'))
    expect(screen.queryByText('Moves')).toBeNull()
  })
})