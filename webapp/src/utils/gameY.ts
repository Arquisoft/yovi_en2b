import type { BoardCell, BoardSize, PlayerColor, Move } from '@/types'

const ALL_SIDES = [0, 1, 2]
const SQRT3 = Math.sqrt(3)

/**
 * Create an empty triangular board for Game Y
 * Row 0 has 1 cell, Row 1 has 2 cells, etc.
 */
export function createEmptyBoard(size: BoardSize): BoardCell[][] {
  const board: BoardCell[][] = []
  for (let row = 0; row < size; row++) {
    const rowCells: BoardCell[] = []
    for (let col = 0; col <= row; col++) {
      rowCells.push({ row, col, owner: null })
    }
    board.push(rowCells)
  }
  return board
}

/**
 * Get the total number of cells on a triangular board
 */
export function getTotalCells(size: BoardSize): number {
  return (size * (size + 1)) / 2
}

/**
 * Get all valid neighbors for a hex cell on a triangular board
 * Hex adjacency: up to 6 neighbors
 */
export function getNeighbors(
  row: number,
  col: number,
  size: BoardSize
): { row: number; col: number }[] {
  const neighbors: { row: number; col: number }[] = []

  // Possible neighbor offsets for hex cells on triangular grid
  const offsets = [
    [-1, -1], // upper-left
    [-1, 0],  // upper-right
    [0, -1],  // left
    [0, 1],   // right
    [1, 0],   // lower-left
    [1, 1],   // lower-right
  ]

  for (const [dr, dc] of offsets) {
    const newRow = row + dr
    const newCol = col + dc

    // Check bounds for triangular board
    if (newRow >= 0 && newRow < size && newCol >= 0 && newCol <= newRow) {
      neighbors.push({ row: newRow, col: newCol })
    }
  }

  return neighbors
}

/**
 * Identify which side(s) a cell belongs to
 * Side 0: Left edge (col === 0)
 * Side 1: Right edge (col === row)
 * Side 2: Bottom edge (row === size - 1)
 * Corners belong to both adjacent sides
 */
export function getCellSides(
  row: number,
  col: number,
  size: BoardSize
): number[] {
  const sides: number[] = []

  // Left edge
  if (col === 0) {
    sides.push(0)
  }

  // Right edge
  if (col === row) {
    sides.push(1)
  }

  // Bottom edge
  if (row === size - 1) {
    sides.push(2)
  }

  return sides
}

/**
 * Check if a player has won by connecting all three sides
 * Uses flood fill / BFS to find connected components
 */
export function checkWinner(
  board: BoardCell[][],
  size: BoardSize
): PlayerColor | null {
  const players: PlayerColor[] = ['player1', 'player2']

  for (const player of players) {
    if (hasConnectedAllSides(board, size, player)) {
      return player
    }
  }

  return null
}

function hasConnectedAllSides(
  board: BoardCell[][],
  size: BoardSize,
  player: PlayerColor
): boolean {
  const visited = new Set<string>()

  for (let row = 0; row < size; row++) {
    const isOnLeftEdge = board[row][0]?.owner === player
    const alreadyExplored = visited.has(`${row},0`)

    if (!isOnLeftEdge || alreadyExplored) continue

    const sidesReached = explorComponent(board, size, player, row, visited)
    const connectsAllSides = ALL_SIDES.every((side) => sidesReached.has(side))

    if (connectsAllSides) return true
  }

  return false
}

/**
 * BFS from a starting cell, marking all reachable cells of the same player
 * as visited and collecting which board sides they touch.
 */
function explorComponent(
  board: BoardCell[][],
  size: BoardSize,
  player: PlayerColor,
  startRow: number,
  visited: Set<string>
): Set<number> {
  const sidesReached = new Set<number>()
  const queue: { row: number; col: number }[] = [{ row: startRow, col: 0 }]

  visited.add(`${startRow},0`)
  getCellSides(startRow, 0, size).forEach((s) => sidesReached.add(s))

  while (queue.length > 0) {
    const current = queue.shift()!

    for (const neighbor of getNeighbors(current.row, current.col, size)) {
      const key = `${neighbor.row},${neighbor.col}`
      const alreadyVisited = visited.has(key)
      const belongsToPlayer = board[neighbor.row]?.[neighbor.col]?.owner === player

      if (alreadyVisited || !belongsToPlayer) continue

      visited.add(key)
      queue.push(neighbor)
      getCellSides(neighbor.row, neighbor.col, size).forEach((s) => sidesReached.add(s))
    }
  }

  return sidesReached
}

/**
 * Apply a move to the board (immutable)
 */
export function applyMove(
  board: BoardCell[][],
  move: Move
): BoardCell[][] {
  return board.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      rowIndex === move.row && colIndex === move.col
        ? { ...cell, owner: move.player }
        : cell
    )
  )
}

/**
 * Check if a move is valid
 */
export function isValidMove(
  board: BoardCell[][],
  row: number,
  col: number
): boolean {
  const cell = board[row]?.[col]
  return cell !== undefined && cell.owner === null
}

/**
 * Get the opposite player
 */
export function getOppositePlayer(player: PlayerColor): PlayerColor {
  return player === 'player1' ? 'player2' : 'player1'
}

/**
 * Calculate cell center position for SVG rendering.
 * Uses pointy-top hexagons on a centered equilateral triangular board.
 *
 * Row 0 = apex (1 cell), Row size-1 = base (size cells).
 * Each row is horizontally centered, forming a proper equilateral triangle.
 */
export function getGameYPosition(
  row: number,
  col: number,
  cellSize: number,
  size: number
): { x: number; y: number } {
  const cellWidth = SQRT3 * cellSize       // pointy-top: w = sqrt(3) * r
  const cellHeight = 2 * cellSize          // pointy-top: h = 2 * r
  const vertSpacing = cellHeight * 0.75    // vertical distance between row centers
  const padding = cellSize * 1.5

  // Centering offset: shorter rows (near apex) are shifted right so the
  // triangle is centered, not left-aligned into a parallelogram.
  const centeringOffset = (size - 1 - row) * (cellWidth / 2)

  const x = centeringOffset + col * cellWidth + padding
  const y = row * vertSpacing + padding

  return { x, y }
}

/**
 * Generate SVG polygon points for a pointy-top hexagon centered at (0, 0).
 */
export function getGameYPath(cellSize: number): string {
  const points: string[] = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30
    const angleRad = (Math.PI / 180) * angleDeg
    const x = cellSize * Math.cos(angleRad)
    const y = cellSize * Math.sin(angleRad)
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `M ${points.join(' L ')} Z`
}

/**
 * Calculate total SVG canvas dimensions for a board of the given size.
 */
export function getGameYBoardDimensions(
  size: BoardSize,
  cellSize: number
): { width: number; height: number } {
  const cellWidth = SQRT3 * cellSize
  const cellHeight = 2 * cellSize
  const vertSpacing = cellHeight * 0.75
  const padding = cellSize * 1.5

  // Width: the base row (size cells) spans (size-1) gaps plus one cell width
  const width = (size - 1) * cellWidth + cellWidth + padding * 2

  // Height: (size-1) vertical steps plus one full cell height
  const height = (size - 1) * vertSpacing + cellHeight + padding * 2

  return { width, height }
}
