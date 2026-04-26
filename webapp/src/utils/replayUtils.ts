import type { BoardCell, Move, GameState } from '@/types'

/** Creates a fully empty triangular board of the given size. */
export function createEmptyBoard(size: number): BoardCell[][] {
  const board: BoardCell[][] = []
  for (let row = 0; row < size; row++) {
    board[row] = []
    for (let col = 0; col <= row; col++) {
      board[row][col] = { row, col, owner: null }
    }
  }
  return board
}

/** Returns a new board with the given move applied (immutable). */
export function applyMoveToBoard(board: BoardCell[][], move: Move): BoardCell[][] {
  return board.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      rowIndex === move.row && colIndex === move.col
        ? { ...cell, owner: move.player }
        : cell
    )
  )
}

/**
 * Reconstructs the board state after exactly `step` moves have been played.
 *
 * Pie Rule swap handling: if a swap occurred (detectable by comparing the
 * first move's player to the final board's cell owner), the stone colour
 * correction is applied starting from step 2 onward — matching the real
 * game timeline where the decision happens after move 1.
 */
export function getBoardAtStep(game: GameState, step: number): BoardCell[][] {
  const { boardSize } = game.config
  let board = createEmptyBoard(boardSize)

  const clampedStep = Math.max(0, Math.min(step, game.moves.length))
  for (let i = 0; i < clampedStep; i++) {
    board = applyMoveToBoard(board, game.moves[i])
  }

  // Detect and apply Pie Rule swap for step >= 2
  if (clampedStep >= 2 && game.config.pieRule && game.moves.length > 0) {
    const firstMove = game.moves[0]
    const finalCell = game.board[firstMove.row]?.[firstMove.col]
    if (finalCell?.owner && finalCell.owner !== firstMove.player) {
      // Swap happened — update the contested stone's colour
      board = board.map(row =>
        row.map(cell =>
          cell.row === firstMove.row && cell.col === firstMove.col && cell.owner !== null
            ? { ...cell, owner: finalCell.owner }
            : cell
        )
      )
    }
  }

  return board
}