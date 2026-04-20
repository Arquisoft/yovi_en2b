import { describe, it, expect } from 'vitest'
import { createEmptyBoard, applyMoveToBoard, getBoardAtStep } from '@/utils/replayUtils'
import type { GameState, Move, BoardCell } from '@/types'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeMove(row: number, col: number, player: 'player1' | 'player2', ts = 0): Move {
  return { row, col, player, timestamp: ts }
}

/**
 * Build a minimal GameState for testing.
 * `board` defaults to the final board state after all moves are applied,
 * which is how the real API responds.
 */
function makeGame(
  size: number,
  moves: Move[],
  overrides: Partial<GameState> = {}
): GameState {
  // Build a board that reflects all moves (simulates what the server returns)
  let board: BoardCell[][] = createEmptyBoard(size)
  for (const m of moves) {
    board = board.map(row =>
      row.map(cell =>
        cell.row === m.row && cell.col === m.col ? { ...cell, owner: m.player } : cell
      )
    )
  }

  return {
    id: 'test-game',
    config: {
      mode: 'pvp-local',
      boardSize: size as any,
      timerEnabled: false,
    },
    status: 'finished',
    phase: 'playing',
    board,
    players: {
      player1: { id: 'p1', name: 'P1', color: 'player1' },
      player2: { id: 'p2', name: 'P2', color: 'player2' },
    },
    currentTurn: 'player1',
    moves,
    winner: null,
    timer: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// ─── createEmptyBoard ────────────────────────────────────────────────────────

describe('createEmptyBoard', () => {
  it('creates a board with the correct number of rows', () => {
    const board = createEmptyBoard(5)
    expect(board).toHaveLength(5)
  })

  it('row N has N+1 cells (triangular board)', () => {
    const board = createEmptyBoard(5)
    board.forEach((row, i) => {
      expect(row).toHaveLength(i + 1)
    })
  })

  it('all cells start with owner null', () => {
    const board = createEmptyBoard(5)
    board.forEach(row =>
      row.forEach(cell => expect(cell.owner).toBeNull())
    )
  })

  it('cell row/col coordinates are set correctly', () => {
    const board = createEmptyBoard(4)
    expect(board[0][0]).toEqual({ row: 0, col: 0, owner: null })
    expect(board[3][2]).toEqual({ row: 3, col: 2, owner: null })
  })

  it('works for the minimum board size of 4', () => {
    const board = createEmptyBoard(4)
    expect(board).toHaveLength(4)
    expect(board[3]).toHaveLength(4)
  })

  it('works for the maximum board size of 16', () => {
    const board = createEmptyBoard(16)
    expect(board).toHaveLength(16)
    expect(board[15]).toHaveLength(16)
  })
})

// ─── applyMoveToBoard ────────────────────────────────────────────────────────

describe('applyMoveToBoard', () => {
  it('sets the correct cell owner', () => {
    const board = createEmptyBoard(5)
    const updated = applyMoveToBoard(board, makeMove(2, 1, 'player1'))
    expect(updated[2][1].owner).toBe('player1')
  })

  it('does not mutate the original board (immutability)', () => {
    const board = createEmptyBoard(5)
    applyMoveToBoard(board, makeMove(2, 1, 'player1'))
    expect(board[2][1].owner).toBeNull()
  })

  it('leaves all other cells unchanged', () => {
    const board = createEmptyBoard(4)
    const updated = applyMoveToBoard(board, makeMove(1, 0, 'player2'))
    // Only (1,0) should be set
    updated.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (r === 1 && c === 0) {
          expect(cell.owner).toBe('player2')
        } else {
          expect(cell.owner).toBeNull()
        }
      })
    )
  })

  it('allows overwriting an existing cell owner (for pie rule simulation)', () => {
    const board = createEmptyBoard(5)
    const after1 = applyMoveToBoard(board, makeMove(0, 0, 'player1'))
    const after2 = applyMoveToBoard(after1, makeMove(0, 0, 'player2'))
    expect(after2[0][0].owner).toBe('player2')
  })
})

// ─── getBoardAtStep ──────────────────────────────────────────────────────────

describe('getBoardAtStep', () => {
  it('step 0 returns an empty board', () => {
    const moves = [makeMove(0, 0, 'player1'), makeMove(1, 0, 'player2')]
    const game = makeGame(5, moves)
    const board = getBoardAtStep(game, 0)
    board.forEach(row => row.forEach(cell => expect(cell.owner).toBeNull()))
  })

  it('step 1 applies only the first move', () => {
    const moves = [makeMove(0, 0, 'player1'), makeMove(1, 0, 'player2')]
    const game = makeGame(5, moves)
    const board = getBoardAtStep(game, 1)
    expect(board[0][0].owner).toBe('player1')
    expect(board[1][0].owner).toBeNull()
  })

  it('step 2 applies both moves', () => {
    const moves = [makeMove(0, 0, 'player1'), makeMove(1, 0, 'player2')]
    const game = makeGame(5, moves)
    const board = getBoardAtStep(game, 2)
    expect(board[0][0].owner).toBe('player1')
    expect(board[1][0].owner).toBe('player2')
  })

  it('step === totalMoves shows all moves (final position)', () => {
    const moves = [
      makeMove(0, 0, 'player1'),
      makeMove(1, 0, 'player2'),
      makeMove(2, 0, 'player1'),
    ]
    const game = makeGame(5, moves)
    const board = getBoardAtStep(game, 3)
    expect(board[0][0].owner).toBe('player1')
    expect(board[1][0].owner).toBe('player2')
    expect(board[2][0].owner).toBe('player1')
  })

  it('step > totalMoves is clamped to totalMoves', () => {
    const moves = [makeMove(0, 0, 'player1')]
    const game = makeGame(5, moves)
    const board = getBoardAtStep(game, 999)
    expect(board[0][0].owner).toBe('player1')
  })

  it('step < 0 is clamped to 0', () => {
    const moves = [makeMove(0, 0, 'player1')]
    const game = makeGame(5, moves)
    const board = getBoardAtStep(game, -5)
    board.forEach(row => row.forEach(cell => expect(cell.owner).toBeNull()))
  })

  it('returns the correct board size', () => {
    const game = makeGame(6, [makeMove(0, 0, 'player1')])
    const board = getBoardAtStep(game, 1)
    expect(board).toHaveLength(6)
    expect(board[5]).toHaveLength(6)
  })

  it('does not mutate the game object', () => {
    const moves = [makeMove(0, 0, 'player1')]
    const game = makeGame(5, moves)
    getBoardAtStep(game, 1)
    expect(game.board[0][0].owner).toBe('player1') // original game board untouched
  })

  it('pie rule swap: first stone owner changes to player2 from step 2', () => {
    // After a swap the server returns board[0][0].owner === 'player2'
    // even though moves[0].player === 'player1'
    const moves = [
      makeMove(0, 0, 'player1'),
      makeMove(1, 0, 'player2'), // second move after swap decision
    ]
    const boardAfterSwap: BoardCell[][] = createEmptyBoard(5).map(row =>
      row.map(cell => {
        if (cell.row === 0 && cell.col === 0) return { ...cell, owner: 'player2' as const }
        if (cell.row === 1 && cell.col === 0) return { ...cell, owner: 'player2' as const }
        return cell
      })
    )
    const game = makeGame(5, moves, {
      board: boardAfterSwap,
      config: { mode: 'pvp-local', boardSize: 5 as any, timerEnabled: false, pieRule: true },
    })

    const boardAtStep2 = getBoardAtStep(game, 2)
    // After swap the contested stone should be owned by player2
    expect(boardAtStep2[0][0].owner).toBe('player2')
  })

  it('pie rule swap: step 1 still shows original player1 stone (before decision)', () => {
    const moves = [
      makeMove(0, 0, 'player1'),
      makeMove(1, 0, 'player2'),
    ]
    const boardAfterSwap: BoardCell[][] = createEmptyBoard(5).map(row =>
      row.map(cell => {
        if (cell.row === 0 && cell.col === 0) return { ...cell, owner: 'player2' as const }
        if (cell.row === 1 && cell.col === 0) return { ...cell, owner: 'player2' as const }
        return cell
      })
    )
    const game = makeGame(5, moves, {
      board: boardAfterSwap,
      config: { mode: 'pvp-local', boardSize: 5 as any, timerEnabled: false, pieRule: true },
    })

    // At step 1, pie decision has not happened yet — stone is player1's
    const boardAtStep1 = getBoardAtStep(game, 1)
    expect(boardAtStep1[0][0].owner).toBe('player1')
  })

  it('no pie rule: stone ownership never changes', () => {
    const moves = [makeMove(0, 0, 'player1'), makeMove(1, 0, 'player2')]
    const game = makeGame(5, moves) // pieRule = undefined
    const board = getBoardAtStep(game, 2)
    expect(board[0][0].owner).toBe('player1')
  })

  it('intermediate steps produce distinct board states', () => {
    const moves = [
      makeMove(0, 0, 'player1'),
      makeMove(1, 0, 'player2'),
      makeMove(2, 0, 'player1'),
    ]
    const game = makeGame(5, moves)

    const b1 = getBoardAtStep(game, 1)
    const b2 = getBoardAtStep(game, 2)
    const b3 = getBoardAtStep(game, 3)

    // Each step adds exactly one more stone
    const count = (b: BoardCell[][]) =>
      b.flat().filter(c => c.owner !== null).length

    expect(count(b1)).toBe(1)
    expect(count(b2)).toBe(2)
    expect(count(b3)).toBe(3)
  })
})