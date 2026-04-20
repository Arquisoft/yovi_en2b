import { useTranslation } from 'react-i18next'
import { useGameReplayController } from '@/controllers/useGameReplayController'
import { GameYBoard } from '@/components/game-y/GameYBoard'
import { Button } from '@/components/ui/Button'
import {
  AlertCircle,
  ArrowLeft,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Bot,
  Users,
  Globe
} from 'lucide-react'
import { cn } from '@/utils'
import type { GameMode, PlayerColor } from '@/types'

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeChip({ mode }: Readonly<{ mode: GameMode }>) {
  const icons = { pve: Bot, 'pvp-local': Users, 'pvp-online': Globe }
  const Icon = icons[mode] ?? Globe
  const labels = { pve: 'vs Bot', 'pvp-local': 'Local', 'pvp-online': 'Online' }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-muted/50">
      <Icon className="w-3 h-3" />
      {labels[mode]}
    </span>
  )
}

function ResultChip({
  winner,
  humanColor
}: Readonly<{ winner: PlayerColor | null; humanColor: PlayerColor | null }>) {
  if (!winner) return null

  if (!humanColor) {
    const name = winner === 'player1' ? 'Player 1' : 'Player 2'
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
        {name} won
      </span>
    )
  }

  const isWin = winner === humanColor

  return (
    <span
      className={cn(
        'text-xs font-semibold px-2 py-0.5 rounded-full',
        isWin ? 'bg-player1/10 text-player1' : 'bg-player2/10 text-player2'
      )}
    >
      {isWin ? 'Win' : 'Loss'}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GameReplayPage() {
  const { t } = useTranslation()

  const {
    game,
    boardAtStep,
    step,
    totalMoves,
    currentMove,
    isLoading,
    error,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    goToStart,
    goToEnd,
    setStep,
    goToHistory
  } = useGameReplayController()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !game || !boardAtStep) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-lg text-destructive">
          {error || t('game.gameNotFound')}
        </p>
        <Button variant="ghost" className="mt-4" onClick={goToHistory}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('history.title')}
        </Button>
      </div>
    )
  }

  const humanIsPlayer1 = !game.players.player1.isBot
  const humanColor: PlayerColor | null = humanIsPlayer1 ? 'player1' : 'player2'

  const replayGame = {
    ...game,
    board: boardAtStep,
    status: 'playing' as const,
    winner: null
  }

  const highlightMove = currentMove ?? null

  // ─── MOVE PLAYER (refactor ternario → if) ──────────────────────────────────
  let currentMovePlayer: string | null = null

  if (currentMove) {
    if (currentMove.player === 'player1') {
      currentMovePlayer = game.players.player1.name
    } else {
      currentMovePlayer = game.players.player2.name
    }
  }

  const currentMoveColor: PlayerColor | null = currentMove?.player ?? null

  // ─── MOVE INFO (refactor ternario → if/else) ───────────────────────────────
  let moveInfoContent: React.ReactNode = null

  if (step === 0) {
    moveInfoContent = (
      <span className="text-muted-foreground italic">
        {t('replay.emptyBoard')}
      </span>
    )
  } else if (currentMovePlayer && currentMoveColor) {
    moveInfoContent = (
      <span>
        <span
          className={cn(
            'font-semibold',
            currentMoveColor === 'player1' ? 'text-player1' : 'text-player2'
          )}
        >
          {currentMovePlayer}
        </span>{' '}
        <span className="text-muted-foreground">
          {t('replay.played', {
            row: currentMove!.row,
            col: currentMove!.col
          })}
        </span>
      </span>
    )
  }

  // ─── STEP LABEL (refactor ternario → if/else) ──────────────────────────────
  let stepLabel = ''

  if (step === 0) {
    stepLabel = t('replay.start')
  } else if (step === totalMoves) {
    stepLabel = t('replay.end')
  } else {
    stepLabel = t('replay.stepOf', { step, total: totalMoves })
  }

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-border bg-card px-4 py-2 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={goToHistory} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" />
          {t('history.title')}
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <ModeChip mode={game.config.mode} />
          <span className="text-xs text-muted-foreground">
            {game.config.boardSize}×{game.config.boardSize}
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {new Date(game.updatedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })}
          </span>
          <ResultChip winner={game.winner} humanColor={humanColor} />
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-player1 inline-block" />
            {game.players.player1.name}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-player2 inline-block" />
            {game.players.player2.name}
          </span>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <GameYBoard
          game={replayGame}
          lastMove={highlightMove}
          isInteractive={false}
          onCellClick={() => {}}
        />
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3 space-y-3">
        <div className="text-center text-sm min-h-[1.5rem]">
          {moveInfoContent}
        </div>

        <input
          type="range"
          min={0}
          max={totalMoves}
          value={step}
          onChange={e => setStep(Number(e.target.value))}
          className="w-full h-1.5 rounded-full accent-primary cursor-pointer"
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goToStart} disabled={!canGoBack} className="h-8 w-8">
              <ChevronFirst className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goBack} disabled={!canGoBack} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          <span className="text-sm font-mono font-medium text-muted-foreground tabular-nums select-none">
            {stepLabel}
          </span>

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goForward} disabled={!canGoForward} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToEnd} disabled={!canGoForward} className="h-8 w-8">
              <ChevronLast className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 hidden sm:block">
          {t('replay.keyboardHint')}
        </p>
      </div>
    </div>
  )
}