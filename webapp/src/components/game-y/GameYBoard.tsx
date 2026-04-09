import { useState, useMemo, useCallback, useEffect } from 'react'
import type { Move, GameState } from '@/types'
import { GameYCell } from './GameYCell'
import { getGameYPosition, getGameYBoardDimensions, getGameYPath } from '@/utils/gameY'

interface GameYBoardProps {
  game: GameState
  lastMove: Move | null
  isInteractive: boolean
  onCellClick: (row: number, col: number) => void
  /** Stone being contested by the Pie Rule decision. Only row/col are used. */
  pieDecisionStone?: { row: number; col: number } | null
  /** True while the swap flash animation is playing. */
  isSwapAnimating?: boolean
  /** True after human commits to swap but before the API responds — pre-colors the stone red. */
  swapCommitted?: boolean
}

// ─── Pie stone highlight ──────────────────────────────────────────────────────
// Rendered in a SEPARATE SVG layer above the dimmed board so its brightness
// is fully independent of the brightness(0.45) filter on the board below.

interface PieStoneHighlightProps {
  row: number
  col: number
  cellSize: number
  size: number
  isSwapAnimating: boolean
  swapCommitted: boolean
}

function PieStoneHighlight({ row, col, cellSize, size, isSwapAnimating, swapCommitted }: PieStoneHighlightProps) {
  const { x, y } = getGameYPosition(row, col, cellSize, size)
  const stonePath = getGameYPath(cellSize * 0.95)

  // Alternating ring: increments every 650 ms. Stops during swap flash.
  const [ringPhase, setRingPhase] = useState(0)
  useEffect(() => {
    if (isSwapAnimating) return
    const id = setInterval(() => setRingPhase(p => p + 1), 650)
    return () => clearInterval(id)
  }, [isSwapAnimating])

  // Rapid flash: increments every 110 ms while swap is animating.
  const [flashPhase, setFlashPhase] = useState(0)
  useEffect(() => {
    if (!isSwapAnimating) { setFlashPhase(0); return }
    const id = setInterval(() => setFlashPhase(p => p + 1), 110)
    return () => clearInterval(id)
  }, [isSwapAnimating])

  const blueRing = ringPhase % 2 === 0 ? 1 : 0.08
  const redRing  = ringPhase % 2 === 0 ? 0.08 : 1

  // During swap: stone fill flickers between Blue and Red.
  // After animation ends but before API responds (swapCommitted): pre-color as Red.
  const stoneFill = isSwapAnimating
    ? (flashPhase % 2 === 1 ? 'hsl(var(--player2))' : 'hsl(var(--player1))')
    : swapCommitted
      ? 'hsl(var(--player2))'
      : 'hsl(var(--player1))'

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Glow halo so the stone pops against any background */}
      <circle
        r={cellSize * 0.72}
        fill={isSwapAnimating
          ? (flashPhase % 2 === 1 ? 'hsl(var(--player2) / 0.25)' : 'hsl(var(--player1) / 0.25)')
          : 'hsl(var(--foreground) / 0.12)'}
      />

      {/* Stone at full brightness — visible through the dim */}
      <path
        d={stonePath}
        fill={stoneFill}
        stroke="hsl(var(--cell-stroke))"
        strokeWidth={1}
      />

      {/* Blue ring (player1) */}
      <circle
        r={cellSize * 0.62}
        fill="none"
        stroke="hsl(var(--player1))"
        strokeWidth={5}
        opacity={isSwapAnimating ? 0 : blueRing}
        style={{ transition: 'opacity 0.48s ease' }}
      />

      {/* Red ring (player2) */}
      <circle
        r={cellSize * 0.76}
        fill="none"
        stroke="hsl(var(--player2))"
        strokeWidth={5}
        opacity={isSwapAnimating ? 0 : redRing}
        style={{ transition: 'opacity 0.48s ease' }}
      />

      {/* Swap flash: alternating rings that pulse while flashing */}
      {isSwapAnimating && (
        <>
          <circle
            r={cellSize * 0.62}
            fill="none"
            stroke={flashPhase % 2 === 1 ? 'hsl(var(--player2))' : 'hsl(var(--player1))'}
            strokeWidth={5}
            opacity={0.95}
          />
          <circle
            r={cellSize * 0.76}
            fill="none"
            stroke={flashPhase % 2 === 1 ? 'hsl(var(--player1))' : 'hsl(var(--player2))'}
            strokeWidth={5}
            opacity={0.95}
          />
        </>
      )}
    </g>
  )
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function GameYBoard({
  game,
  lastMove,
  isInteractive,
  onCellClick,
  pieDecisionStone,
  isSwapAnimating = false,
  swapCommitted = false,
}: GameYBoardProps) {
  const size = game.config.boardSize
  const board = game.board
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  const cellSize = useMemo(() => Math.max(20, Math.min(40, 320 / size)), [size])
  const dimensions = useMemo(() => getGameYBoardDimensions(size, cellSize), [size, cellSize])

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!isInteractive) return
      const cell = board[row]?.[col]
      if (cell?.owner === null) onCellClick(row, col)
    },
    [board, isInteractive, onCellClick]
  )

  const isLastMove = useCallback(
    (row: number, col: number): boolean => lastMove?.row === row && lastMove?.col === col,
    [lastMove]
  )

  const cells = useMemo(() => {
    const result: JSX.Element[] = []
    for (let row = 0; row < size; row++) {
      for (let col = 0; col <= row; col++) {
        const cell = board[row]?.[col]
        if (!cell) continue
        const { x, y } = getGameYPosition(row, col, cellSize, size)
        const isHovered = hoveredCell?.row === row && hoveredCell?.col === col
        const isClickable = isInteractive && cell.owner === null
        const isPieDecisionStoneCell =
          pieDecisionStone != null &&
          pieDecisionStone.row === row &&
          pieDecisionStone.col === col

        result.push(
          <GameYCell
            key={`${row}-${col}`}
            row={row} col={col} x={x} y={y} size={cellSize}
            owner={cell.owner}
            isLastMove={isLastMove(row, col)}
            isHovered={isHovered}
            isClickable={isClickable}
            isPieDecisionStone={isPieDecisionStoneCell}
            onClick={() => handleCellClick(row, col)}
            onMouseEnter={() => setHoveredCell({ row, col })}
            onMouseLeave={() => setHoveredCell(null)}
          />
        )
      }
    }
    return result
  }, [board, size, cellSize, hoveredCell, isInteractive, handleCellClick, isLastMove, pieDecisionStone])

  const sharedSvgProps = {
    viewBox: `0 0 ${dimensions.width} ${dimensions.height}`,
    preserveAspectRatio: 'xMidYMid meet' as const,
    className: 'w-full h-full',
    style: { display: 'block' },
  }

  return (
    // Outer container is `relative` so the highlight layer can be positioned on top.
    <div className="w-full h-full relative">

      {/* ── Board layer — dimmed during pie decision ──────────────────── */}
      <div
        className="w-full h-full p-4"
        style={{
          filter: pieDecisionStone ? 'brightness(0.45)' : undefined,
          transition: 'filter 350ms ease',
        }}
      >
        <svg {...sharedSvgProps} aria-label="Game Y Board" role="grid">
          {cells}
        </svg>
      </div>

      {/* ── Highlight layer — same padding/viewBox, sits above the dim ── */}
      {pieDecisionStone && (
        <div
          className="absolute inset-0 p-4 pointer-events-none"
          aria-hidden="true"
        >
          <svg {...sharedSvgProps}>
            <PieStoneHighlight
              row={pieDecisionStone.row}
              col={pieDecisionStone.col}
              cellSize={cellSize}
              size={size}
              isSwapAnimating={isSwapAnimating}
              swapCommitted={swapCommitted}
            />
          </svg>
        </div>
      )}
    </div>
  )
}
