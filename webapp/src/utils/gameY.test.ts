import { describe, it, expect } from 'vitest'
import {
  createEmptyBoard,
  getTotalCells,
  getNeighbors,
  getCellSides,
  isValidMove,
  applyMove,
  checkWinner,
  getOppositePlayer,
} from './gameY'
import type { BoardSize } from '@/types'

describe('createEmptyBoard', () => {
  it('creates a triangular board with correct dimensions', () => {
    const board = createEmptyBoard(4)
    expect(board.length).toBe(4)
    expect(board[0].length).toBe(1)
    expect(board[1].length).toBe(2)
    expect(board[2].length).toBe(3)
    expect(board[3].length).toBe(4)
  })

  it('initializes all cells as empty', () => {
    const board = createEmptyBoard(4)
    for (const row of board) {
      for (const cell of row) {
        expect(cell.owner).toBe(null)
      }
    }
  })
})

describe('getTotalCells', () => {
  it('calculates correct number of cells', () => {
    expect(getTotalCells(4)).toBe(10)
    expect(getTotalCells(5)).toBe(15)
    expect(getTotalCells(9)).toBe(45)
  })
})

describe('getNeighbors', () => {
  const size: BoardSize = 4

  it('returns correct neighbors for corner cell (0,0)', () => {
    const neighbors = getNeighbors(0, 0, size)
    expect(neighbors).toHaveLength(2)
    expect(neighbors).toContainEqual({ row: 1, col: 0 })
    expect(neighbors).toContainEqual({ row: 1, col: 1 })
  })

  it('returns correct neighbors for middle cell', () => {
    const neighbors = getNeighbors(2, 1, size)
    expect(neighbors.length).toBeGreaterThanOrEqual(4)
  })

  it('respects board boundaries', () => {
    const neighbors = getNeighbors(0, 0, size)
    for (const n of neighbors) {
      expect(n.row).toBeGreaterThanOrEqual(0)
      expect(n.row).toBeLessThan(size)
      expect(n.col).toBeGreaterThanOrEqual(0)
      expect(n.col).toBeLessThanOrEqual(n.row)
    }
  })
})

describe('getCellSides', () => {
  const size: BoardSize = 4

  it('identifies left edge cells', () => {
    expect(getCellSides(0, 0, size)).toContain(0)
    expect(getCellSides(1, 0, size)).toContain(0)
    expect(getCellSides(2, 0, size)).toContain(0)
  })

  it('identifies right edge cells', () => {
    expect(getCellSides(0, 0, size)).toContain(1)
    expect(getCellSides(1, 1, size)).toContain(1)
    expect(getCellSides(2, 2, size)).toContain(1)
  })

  it('identifies bottom edge cells', () => {
    expect(getCellSides(3, 0, size)).toContain(2)
    expect(getCellSides(3, 1, size)).toContain(2)
    expect(getCellSides(3, 3, size)).toContain(2)
  })

  it('identifies corners as belonging to multiple sides', () => {
    // Top corner (0,0) is both left and right
    expect(getCellSides(0, 0, size)).toContain(0)
    expect(getCellSides(0, 0, size)).toContain(1)
    
    // Bottom-left corner
    expect(getCellSides(3, 0, size)).toContain(0)
    expect(getCellSides(3, 0, size)).toContain(2)
    
    // Bottom-right corner
    expect(getCellSides(3, 3, size)).toContain(1)
    expect(getCellSides(3, 3, size)).toContain(2)
  })
})

describe('isValidMove', () => {
  it('allows moves on empty cells', () => {
    const board = createEmptyBoard(4)
    expect(isValidMove(board, 0, 0)).toBe(true)
    expect(isValidMove(board, 2, 1)).toBe(true)
  })

  it('rejects moves on occupied cells', () => {
    const board = createEmptyBoard(4)
    board[0][0].owner = 'player1'
    expect(isValidMove(board, 0, 0)).toBe(false)
  })

  it('rejects out-of-bounds moves', () => {
    const board = createEmptyBoard(4)
    expect(isValidMove(board, -1, 0)).toBe(false)
    expect(isValidMove(board, 0, 1)).toBe(false) // Row 0 only has col 0
    expect(isValidMove(board, 10, 0)).toBe(false)
  })
})

describe('applyMove', () => {
  it('creates a new board with the move applied', () => {
    const board = createEmptyBoard(4)
    const newBoard = applyMove(board, { row: 0, col: 0, player: 'player1', timestamp: 0 })
    
    expect(newBoard[0][0].owner).toBe('player1')
    expect(board[0][0].owner).toBe(null) // Original unchanged
  })
})

describe('getOppositePlayer', () => {
  it('returns the opposite player', () => {
    expect(getOppositePlayer('player1')).toBe('player2')
    expect(getOppositePlayer('player2')).toBe('player1')
  })
})

describe('checkWinner', () => {
  it('returns null for empty board', () => {
    const board = createEmptyBoard(4)
    expect(checkWinner(board, 4)).toBe(null)
  })

  it('returns null when no player has connected all sides', () => {
    const board = createEmptyBoard(4)
    board[0][0].owner = 'player1'
    board[1][1].owner = 'player2'
    expect(checkWinner(board, 4)).toBe(null)
  })

  // Note: A full winning path test would be more complex
  // This tests the basic functionality
})
