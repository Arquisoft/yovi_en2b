import { memo, useState, useEffect } from 'react'
import type { PlayerColor } from '@/types'
import { cn } from '@/utils'
import { getGameYPath } from '@/utils/gameY'

interface GameYCellProps {
  row: number
  col: number
  x: number
  y: number
  size: number
  owner: PlayerColor | null
  isLastMove: boolean
  isHovered: boolean
  isClickable: boolean
  /** True when this cell holds the stone being contested by the Pie Rule decision. */
  isPieDecisionStone?: boolean
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

/**
 * A single hexagonal cell on the Game Y board.
 *
 * When `isPieDecisionStone` is true the cell renders two alternating rings:
 * one in player1 (Blue) and one in player2 (Red). They crossfade using
 * SVG opacity + a CSS transition so the stone appears "contested".
 * The fill transition is extended to 700 ms so that the optimistic colour
 * change (Blue → Red on swap) is visually prominent.
 */
export const GameYCell = memo(function GameYCell({
  x,
  y,
  size,
  owner,
  isLastMove,
  isHovered,
  isClickable,
  isPieDecisionStone,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: GameYCellProps) {
  const cellPath = getGameYPath(size * 0.95)

  // Alternating ring: phase 0 → Blue ring bright, Red dim; phase 1 → reversed.
  const [ringPhase, setRingPhase] = useState(0)
  useEffect(() => {
    if (!isPieDecisionStone) { setRingPhase(0); return }
    const id = setInterval(() => setRingPhase(p => p + 1), 650)
    return () => clearInterval(id)
  }, [isPieDecisionStone])

  const blueRingOpacity = isPieDecisionStone ? (ringPhase % 2 === 0 ? 1 : 0.08) : 0
  const redRingOpacity  = isPieDecisionStone ? (ringPhase % 2 === 0 ? 0.08 : 1) : 0

  const getFillColor = (): string => {
    if (owner === 'player1') return isLastMove ? 'hsl(var(--player1) / 0.9)' : 'hsl(var(--player1))'
    if (owner === 'player2') return isLastMove ? 'hsl(var(--player2) / 0.9)' : 'hsl(var(--player2))'
    if (isHovered && isClickable) return 'hsl(var(--accent))'
    return 'hsl(var(--card))'
  }

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ outline: 'none' }}
      className={cn('transition-all duration-150', isClickable && 'cursor-pointer')}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`Cell, ${owner ? `occupied by ${owner}` : 'empty'}`}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) onClick()
      }}
      onFocus={(e) => e.currentTarget.style.outline = 'none'}
    >
      {/* Stone fill — transition extended to 500 ms for the pie stone so the
          Blue→Red colour change is clearly visible on swap. */}
      <path
        d={cellPath}
        fill={getFillColor()}
        stroke="hsl(var(--cell-stroke))"
        strokeWidth={1}
        style={{
          outline: 'none',
          transition: isPieDecisionStone
            ? 'fill 500ms ease'
            : 'fill 150ms, color 150ms',
        }}
      />

      {/* Normal last-move pulse — hidden while the pie rings are active */}
      {isLastMove && !isPieDecisionStone && (
        <circle
          r={size * 0.2}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          className="animate-pulse"
        />
      )}

      {/* Contested-stone rings: Blue and Red crossfade via opacity */}
      {isPieDecisionStone && (
        <>
          <circle
            r={size * 0.48}
            fill="none"
            stroke="hsl(var(--player1))"
            strokeWidth={3.5}
            opacity={blueRingOpacity}
            style={{ transition: 'opacity 0.5s ease' }}
          />
          <circle
            r={size * 0.56}
            fill="none"
            stroke="hsl(var(--player2))"
            strokeWidth={3.5}
            opacity={redRingOpacity}
            style={{ transition: 'opacity 0.5s ease' }}
          />
        </>
      )}

      {isHovered && isClickable && !owner && (
        <circle
          r={size * 0.3}
          fill="hsl(var(--muted-foreground) / 0.3)"
          className="pointer-events-none"
        />
      )}
    </g>
  )
})
