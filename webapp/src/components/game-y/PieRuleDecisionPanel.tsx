import { useTranslation } from 'react-i18next'
import type { GameState, PieDecision } from '@/types'
import { Button } from '@/components/ui/Button'
import { Loader2, ArrowLeftRight, Shield } from 'lucide-react'

interface Props {
  game: GameState
  /** True when the bot is the one who should decide (unfinished path). */
  isBotDeciding: boolean
  onDecide: (decision: PieDecision) => void
  isLoading: boolean
}

/**
 * Decision panel shown during the Pie Rule phase.
 *
 * On desktop it renders as a compact bottom bar.
 * On mobile it renders as a taller card so touch targets are comfortable.
 */
export function PieRuleDecisionPanel({ game, isBotDeciding, onDecide, isLoading }: Readonly<Props>) {
  const { t } = useTranslation()
  const deciderName = game.players.player2.name

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20">
      {/* Gradient fade so the board doesn't feel cut off */}
      <div className="h-8 bg-gradient-to-t from-card/80 to-transparent pointer-events-none" />

      <div className="bg-card/95 backdrop-blur-sm border-t border-border px-4 py-4
                      flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 sm:py-3">

        {/* Stone swap illustration: Blue → Red */}
        <div className="flex items-center gap-2 shrink-0" aria-hidden="true">
          <span className="w-5 h-5 rounded-full inline-block"
                style={{ background: 'hsl(var(--player1))' }} />
          <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
          <span className="w-5 h-5 rounded-full inline-block"
                style={{ background: 'hsl(var(--player2))' }} />
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{t('game.pieRule')}</p>
          {isBotDeciding ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('game.pieDeciding', { name: deciderName })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('game.piePrompt', { name: deciderName })}
            </p>
          )}
        </div>

        {/* Action area */}
        {isBotDeciding ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0 self-center" />
        ) : (
          <div className="flex gap-2 sm:shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none gap-1.5 h-10 sm:h-8 text-sm sm:text-xs"
              onClick={() => onDecide('keep')}
              disabled={isLoading}
            >
              <Shield className="w-3.5 h-3.5" />
              {t('game.keep') }
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none gap-1.5 h-10 sm:h-8 text-sm sm:text-xs"
              onClick={() => onDecide('swap')}
              disabled={isLoading}
              isLoading={isLoading}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {t('game.swap') }
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
