import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameYBoard } from './GameYBoard'
import type { GameState, BoardCell, Move } from '@/types'

/** Build a triangular board of size N with all cells empty */
function makeBoard(size: number): BoardCell[][] {
  const board: BoardCell[][] = []
  for (let row = 0; row < size; row++) {
    board[row] = []
    for (let col = 0; col <= row; col++) {
      board[row][col] = { row, col, owner: null }
    }
  }
  return board
}

function makeGame(overrides: Partial<GameState> = {}): GameState {
  const size = 5
  return {
    id: 'game-1',
    config: { mode: 'pve', boardSize: size, timerEnabled: false, botLevel: 'easy' },
    status: 'playing',
    board: makeBoard(size),
    players: {
      player1: { id: 'user-1', name: 'Alice', color: 'player1' },
      player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
    },
    currentTurn: 'player1',
    moves: [],
    winner: null,
    timer: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('GameYBoard — rendering', () => {
  it('renders an SVG element with role="grid"', () => {
    render(
      <GameYBoard
        game={makeGame()}
        lastMove={null}
        isInteractive={true}
        onCellClick={vi.fn()}
      />
    )
    expect(screen.getByRole('grid')).toBeDefined()
  })

  it('renders clickable cells when interactive', () => {
    render(
      <GameYBoard
        game={makeGame()}
        lastMove={null}
        isInteractive={true}
        onCellClick={vi.fn()}
      />
    )
    // For a size-5 board, all cells are empty → all should be clickable (role="button")
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('renders no clickable cells when not interactive', () => {
    render(
      <GameYBoard
        game={makeGame()}
        lastMove={null}
        isInteractive={false}
        onCellClick={vi.fn()}
      />
    )
    expect(screen.queryAllByRole('button').length).toBe(0)
  })
})

describe('GameYBoard — cell click handling', () => {
  it('calls onCellClick when an empty interactive cell is clicked', () => {
    const onCellClick = vi.fn()
    render(
      <GameYBoard
        game={makeGame()}
        lastMove={null}
        isInteractive={true}
        onCellClick={onCellClick}
      />
    )
    const [firstCell] = screen.getAllByRole('button')
    fireEvent.click(firstCell)
    expect(onCellClick).toHaveBeenCalledOnce()
    expect(onCellClick).toHaveBeenCalledWith(expect.any(Number), expect.any(Number))
  })

  it('does NOT call onCellClick when an occupied cell is clicked', () => {
    const onCellClick = vi.fn()
    const board = makeBoard(5)
    board[0][0].owner = 'player1' // occupy the first cell
    const game = makeGame({ board })

    render(
      <GameYBoard
        game={game}
        lastMove={null}
        isInteractive={true}
        onCellClick={onCellClick}
      />
    )
    // The occupied cell should NOT be a button (not clickable)
    // Occupied cells get isClickable=false → no role="button" for that cell
    // All buttons left are unoccupied cells
    const buttons = screen.getAllByRole('button')
    // Size 5 board has 1+2+3+4+5=15 cells, 1 occupied → 14 buttons
    expect(buttons.length).toBe(14)
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('does NOT call onCellClick when not interactive, even on empty cells', () => {
    const onCellClick = vi.fn()
    const { container } = render(
      <GameYBoard
        game={makeGame()}
        lastMove={null}
        isInteractive={false}
        onCellClick={onCellClick}
      />
    )
    container.querySelectorAll('g').forEach((g) => fireEvent.click(g))
    expect(onCellClick).not.toHaveBeenCalled()
  })
})

describe('GameYBoard — last move indicator', () => {
  it('marks the last move cell with a pulse indicator', () => {
    const board = makeBoard(5)
    board[1][0].owner = 'player1'
    const lastMove: Move = { row: 1, col: 0, player: 'player1', timestamp: Date.now() }

    const { container } = render(
      <GameYBoard
        game={makeGame({ board })}
        lastMove={lastMove}
        isInteractive={true}
        onCellClick={vi.fn()}
      />
    )
    // The last-move cell renders a pulse circle with stroke="hsl(var(--foreground))"
    const pulseCircle = Array.from(container.querySelectorAll('circle')).find(
      (c) => c.getAttribute('stroke') === 'hsl(var(--foreground))'
    )
    expect(pulseCircle).toBeDefined()
  })

  it('does NOT render a pulse indicator when lastMove is null', () => {
    const { container } = render(
      <GameYBoard
        game={makeGame()}
        lastMove={null}
        isInteractive={true}
        onCellClick={vi.fn()}
      />
    )
    const pulseCircle = Array.from(container.querySelectorAll('circle')).find(
      (c) => c.getAttribute('stroke') === 'hsl(var(--foreground))'
    )
    expect(pulseCircle).toBeUndefined()
  })
})
