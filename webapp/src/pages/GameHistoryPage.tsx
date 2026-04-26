import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameHistoryController } from '@/controllers/useGameHistoryController'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Play, Bot, Users, Globe, Trophy, BarChart2, ChevronLeft, ChevronRight, ChevronFirst, ChevronLast } from 'lucide-react'
import { cn } from '@/utils'
import type { GameSummary, GameMode, PlayerColor } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ModeIcon({ mode }: Readonly<{ mode: GameMode }>) {
  if (mode === 'pve') return <Bot className="w-3.5 h-3.5" />
  if (mode === 'pvp-local') return <Users className="w-3.5 h-3.5" />
  return <Globe className="w-3.5 h-3.5" />
}

function modeLabel(mode: GameMode, t: (k: string) => string): string {
  return t(`history.mode.${mode}`)
}

function resultForGame(game: GameSummary, t: (k: string) => string): {
  label: string
  className: string
} {
  if (!game.winner) return { label: t('history.result.draw'), className: 'text-muted-foreground bg-muted' }
  const humanIsPlayer1 = !game.players.player1.isBot
  const humanColor: PlayerColor = humanIsPlayer1 ? 'player1' : 'player2'
  const isWin = game.winner === humanColor
  return isWin
    ? { label: t('history.result.win'), className: 'text-player1 bg-player1/10' }
    : { label: t('history.result.loss'), className: 'text-player2 bg-player2/10' }
}

function opponentName(game: GameSummary): string {
  return game.players.player1.isBot
    ? game.players.player1.name
    : game.players.player2.name
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  goToPage,
}: Readonly<{ page: number; totalPages: number; goToPage: (p: number) => void }>) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-1 pt-4 border-t border-border">
      <Button
        variant="outline"
        size="icon"
        onClick={() => goToPage(1)}
        disabled={page === 1}
        aria-label={t('stats.first')}
        title={t('stats.first')}
      >
        <ChevronFirst className="w-4 h-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={() => goToPage(page - 1)}
        disabled={page === 1}
        aria-label={t('stats.previous')}
        title={t('stats.previous')}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      <span className="text-sm font-mono text-muted-foreground px-3 tabular-nums select-none">
        {t('stats.pageOf', { page, total: totalPages })}
      </span>

      <Button
        variant="outline"
        size="icon"
        onClick={() => goToPage(page + 1)}
        disabled={page === totalPages}
        aria-label={t('stats.next')}
        title={t('stats.next')}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        onClick={() => goToPage(totalPages)}
        disabled={page === totalPages}
        aria-label={t('stats.last')}
        title={t('stats.last')}
      >
        <ChevronLast className="w-4 h-4" />
      </Button>
    </div>
  )
}

// ─── Row component ────────────────────────────────────────────────────────────

function GameRow({ game, onReplay, onResume }: Readonly<{ game: GameSummary; onReplay: () => void; onResume: () => void }>) {
  const { t } = useTranslation()
  const isActive = game.status === 'playing'
  const result = resultForGame(game, t)

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      {/* Date */}
      <td className="py-3 pr-4 text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(game.updatedAt)}
      </td>

      {/* Mode */}
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-muted/50">
          <ModeIcon mode={game.config.mode} />
          {modeLabel(game.config.mode, t)}
        </span>
      </td>

      {/* Opponent */}
      <td className="py-3 pr-4 font-medium text-sm truncate max-w-[120px]">
        {opponentName(game)}
      </td>

      {/* Board size */}
      <td className="py-3 pr-4 text-sm text-muted-foreground hidden sm:table-cell">
        {game.config.boardSize}×{game.config.boardSize}
      </td>

      {/* Move count */}
      <td className="py-3 pr-4 text-sm text-muted-foreground hidden md:table-cell font-mono">
        {t('history.moves', { count: game.moveCount })}
      </td>

      {/* Result */}
      <td className="py-3 pr-4">
        {isActive ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-yellow-600 bg-yellow-500/10">
            {t('history.result.active')}
          </span>
        ) : (
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', result.className)}>
            {result.label}
          </span>
        )}
      </td>

      {/* Action */}
      <td className="py-3">
        {isActive ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onResume}
            className="gap-1.5 h-7 text-xs text-primary"
          >
            <Play className="w-3 h-3" />
            {t('history.resume')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={onReplay}
            className="gap-1.5 h-7 text-xs"
            disabled={game.moveCount === 0}
          >
            <Play className="w-3 h-3" />
            {t('history.watchReplay')}
          </Button>
        )}
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GameHistoryPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { games, isLoading, error, isGuest, totalFinished, page, totalPages, goToPage } =
    useGameHistoryController()

  let content

  if (isLoading) {
    content = (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  } else if (error) {
    content = (
      <p className="text-center text-sm text-destructive py-8">{error}</p>
    )
  } else if (games.length === 0) {
    content = (
      <p className="text-center text-sm text-muted-foreground py-12">
        {t('history.noGames')}
      </p>
    )
  } else {
    content = (
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="pb-2 font-medium pr-4">{t('history.colDate')}</th>
                <th className="pb-2 font-medium pr-4">{t('history.colMode')}</th>
                <th className="pb-2 font-medium pr-4">{t('history.colOpponent')}</th>
                <th className="pb-2 font-medium pr-4 hidden sm:table-cell">{t('history.colBoard')}</th>
                <th className="pb-2 font-medium pr-4 hidden md:table-cell">{t('history.colMoves')}</th>
                <th className="pb-2 font-medium pr-4">{t('history.colResult')}</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {games.map(game => (
                <GameRow
                  key={game.id}
                  game={game}
                  onReplay={() => navigate(`/games/y/replay/${game.id}`)}
                  onResume={() => navigate(`/games/y/${game.id}`)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} goToPage={goToPage} />
      </div>
    )
  }

  // Guest upsell
  if (isGuest) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          <h1 className="text-3xl font-bold">{t('history.title')}</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <BarChart2 className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{t('stats.trackProgress')}</h2>
              <p className="text-muted-foreground max-w-xs mx-auto text-sm">
                {t('stats.trackProgressDescription')}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => navigate('/register')}>{t('stats.createAccount')}</Button>
              <Button variant="outline" onClick={() => navigate('/login')}>{t('stats.signIn')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
        <h1 className="text-3xl font-bold">{t('history.title')}</h1>
      </div>

      {/* Total finished games stat */}
      {!isLoading && !error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30">
          <Trophy className="w-5 h-5 text-primary flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            {t('history.totalFinished', { count: totalFinished })}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            {t('history.tableTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {content}
        </CardContent>
      </Card>
    </div>
  )
}