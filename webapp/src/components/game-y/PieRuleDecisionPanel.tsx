import type { GameState, PieDecision } from '@/types'
import { Button } from '@/components/ui/Button'
import { Loader2 } from 'lucide-react'

interface Props {
  game: GameState
  /** True when the bot is the one who should decide (unfinished path). */
  isBotDeciding: boolean
  onDecide: (decision: PieDecision) => void
  isLoading: boolean
}

/**
 * Compact bottom-bar shown during the Pie Rule decision phase.
 * Positioned at the bottom of the board container so the contested stone
 * (usually at the apex — top of the board) remains fully visible.
 */
export function PieRuleDecisionPanel({ game, isBotDeciding, onDecide, isLoading }: Props) {
  const deciderName = game.players.player2.name

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20
                    bg-card/95 backdrop-blur-sm border-t border-border">
      {/* Subtle top-gradient fade so the board doesn't feel cut off */}
      <div className="absolute -top-6 left-0 right-0 h-6
                      bg-gradient-to-t from-card/60 to-transparent pointer-events-none" />

      <div className="px-4 py-3 flex items-center gap-4 max-w-lg mx-auto">
        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Pie Rule</p>
          {isBotDeciding ? (
            <p className="text-xs text-muted-foreground truncate">
              {deciderName} is deciding whether to swap…
            </p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">
              <span className="font-medium text-foreground">{deciderName}</span>
              {' — take the first stone or keep your side?'}
            </p>
          )}
        </div>

        {/* Action area */}
        {isBotDeciding ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
        ) : (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDecide('keep')}
              disabled={isLoading}
            >
              Keep
            </Button>
            <Button
              size="sm"
              onClick={() => onDecide('swap')}
              disabled={isLoading}
              isLoading={isLoading}
            >
              Swap
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
