import { useState, useMemo, useCallback } from 'react'
import type { Move, GameState } from '@/types'
import { GameYCell } from './GameYCell'
import { getGameYPosition, getGameYBoardDimensions } from '@/utils/gameY'

interface GameYBoardProps {
  game: GameState
  lastMove: Move | null
  isInteractive: boolean
  onCellClick: (row: number, col: number) => void
}

/**
 * The triangular hexagonal board for Game Y
 * Renders a proper triangular arrangement of uniform hexagons
 */
export function GameYBoard({
  game,
  lastMove,
  isInteractive,
  onCellClick,
}: GameYBoardProps) {
  const size = game.config.boardSize
  const board = game.board
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)
  

  // Calculate cell size based on board size for good visual scaling
  // Larger base value ensures better visibility on mobile
  const cellSize = useMemo(() => {
    return Math.max(20, Math.min(40, 320 / size))
  }, [size])

  // Get board dimensions for SVG viewBox
  const dimensions = useMemo(
    () => getGameYBoardDimensions(size, cellSize),
    [size, cellSize]
  )

  // Handle cell click
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!isInteractive) return
      const cell = board[row]?.[col]
      if (cell?.owner === null) {
        onCellClick(row, col)
      }
    },
    [board, isInteractive, onCellClick]
  )

  // Check if a cell is the last move
  const isLastMove = useCallback(
    (row: number, col: number): boolean => {
      return lastMove?.row === row && lastMove?.col === col
    },
    [lastMove]
  )

  // Render all cells with uniform size
  const cells = useMemo(() => {
    const result: JSX.Element[] = []

    for (let row = 0; row < size; row++) {
      for (let col = 0; col <= row; col++) {
        const cell = board[row]?.[col]
        if (!cell) continue

        const { x, y } = getGameYPosition(row, col, cellSize, size)
        const isHovered = hoveredCell?.row === row && hoveredCell?.col === col
        const isClickable = isInteractive && cell.owner === null

        result.push(
          <GameYCell
            key={`${row}-${col}`}
            row={row}
            col={col}
            x={x}
            y={y}
            size={cellSize}
            owner={cell.owner}
            isLastMove={isLastMove(row, col)}
            isHovered={isHovered}
            isClickable={isClickable}
            onClick={() => handleCellClick(row, col)}
            onMouseEnter={() => setHoveredCell({ row, col })}
            onMouseLeave={() => setHoveredCell(null)}
          />
        )
      }
    }

    return result
  }, [board, size, cellSize, hoveredCell, isInteractive, handleCellClick, isLastMove])

  return (
    <div className="w-full h-full p-4">
      <svg
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block' }}
        aria-label="Game Y Board"
        role="grid"
      >
        {cells}
      </svg>
    </div>
  )
}
