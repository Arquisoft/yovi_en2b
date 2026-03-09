import { memo } from 'react'
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
  onClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

/**
 * A single hexagonal cell on the Game Y board
 * Renders as an SVG path positioned absolutely
 */
export const GameYCell = memo(function GameYCell({
  x,
  y,
  size,
  owner,
  isLastMove,
  isHovered,
  isClickable,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: GameYCellProps) {
  const cellPath = getGameYPath(size * 0.95)

  // Determine fill color based on state
  const getFillColor = (): string => {
    if (owner === 'player1') {
      return isLastMove ? 'hsl(var(--player1) / 0.9)' : 'hsl(var(--player1))'
    }
    if (owner === 'player2') {
      return isLastMove ? 'hsl(var(--player2) / 0.9)' : 'hsl(var(--player2))'
    }
    if (isHovered && isClickable) {
      return 'hsl(var(--accent))'
    }
    return 'hsl(var(--card))'
  }

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ outline: 'none' }}
      className={cn(
        'transition-all duration-150',
        isClickable && 'cursor-pointer'
      )}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`Cell, ${owner ? `occupied by ${owner}` : 'empty'}`}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          onClick()
        }
      }}
      onFocus={(e) => e.currentTarget.style.outline = 'none'}
    >
      <path
        d={cellPath}
        fill={getFillColor()}
        stroke="hsl(var(--cell-stroke))"
        strokeWidth={1}
        style={{ outline: 'none' }}
        className="transition-colors duration-150"
      />

      {isLastMove && (
        <circle
          r={size * 0.2}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          className="animate-pulse"
        />
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
