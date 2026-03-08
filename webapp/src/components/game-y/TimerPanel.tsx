import type { PlayerColor, TimerState } from '@/types'
import { formatTime } from '@/utils'
import { cn } from '@/utils'
import { Clock } from 'lucide-react'

interface TimerPanelProps {
  timer: TimerState
  player: PlayerColor
  playerName: string
  isCurrentPlayer: boolean
}

export function TimerPanel({
  timer,
  player,
  playerName,
  isCurrentPlayer,
}: TimerPanelProps) {
  const remainingMs = player === 'player1'
    ? timer.player1RemainingMs
    : timer.player2RemainingMs
  
  const isActive = timer.activePlayer === player
  const isLow = remainingMs < 60000 // Less than 1 minute
  const isCritical = remainingMs < 30000 // Less than 30 seconds
  
  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-all',
        isActive && 'border-primary bg-primary/5',
        !isActive && 'border-border bg-muted/30',
        isCurrentPlayer && 'ring-2 ring-primary/50'
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-3 h-3 rounded-full',
            player === 'player1' ? 'bg-player1' : 'bg-player2'
          )}
        />
        <span className="font-medium text-sm">{playerName}</span>
      </div>
      
      <div
        className={cn(
          'flex items-center gap-2 font-mono text-lg font-bold',
          isActive && 'text-foreground',
          !isActive && 'text-muted-foreground',
          isLow && isActive && 'text-yellow-500',
          isCritical && isActive && 'text-destructive animate-pulse'
        )}
      >
        <Clock className={cn('w-4 h-4', isActive && isCritical && 'animate-spin')} />
        {formatTime(remainingMs)}
      </div>
    </div>
  )
}
