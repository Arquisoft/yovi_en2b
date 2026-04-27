import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameHistoryController } from '@/controllers/useGameHistoryController'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  ArrowLeft, Play, Bot, Users, Globe, Trophy, BarChart2,
  ChevronLeft, ChevronRight, ChevronFirst, ChevronLast,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react'
import { cn, formatTime } from '@/utils'
import type { GameSummary, GameMode, PlayerColor } from '@/types'

// ─── Filter / sort types ──────────────────────────────────────────────────────

type GameSortField =
  | 'date' | 'variant' | 'mode' | 'opponent'
  | 'result' | 'board' | 'duration' | 'moves' | 'stats'
type SortDirection = 'asc' | 'desc'

interface HistoryFilter {
  result: 'all' | 'win' | 'loss'
  mode: string
  variant: string
  sortField: GameSortField
  sortDirection: SortDirection
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ModeIcon({ mode }: Readonly<{ mode: GameMode }>) {
  if (mode === 'pve') return <Bot className="w-3.5 h-3.5" />
  if (mode === 'pvp-local') return <Users className="w-3.5 h-3.5" />
  return <Globe className="w-3.5 h-3.5" />
}

function gameModeKey(game: GameSummary): string {
  if (game.config.mode === 'pve') return `pve-${game.config.botLevel ?? 'medium'}`
  return game.config.mode
}

function gameVariantKey(game: GameSummary): string {
  return game.config.variant ?? 'y'
}

function modeLabel(key: string, t: (k: string) => string): string {
  return t(`ranking.modes.${key}`)
}

function variantLabel(slug: string, t: (k: string, opts?: any) => string): string {
  return t(`variants.${slug}.name`, { defaultValue: slug })
}

function humanColor(game: GameSummary, currentUserId: string): PlayerColor {
  if (game.config.mode === 'pvp-online') {
    return String(game.players.player1.id) === String(currentUserId) ? 'player1' : 'player2'
  }
  return game.players.player1.isBot ? 'player2' : 'player1'
}

function resultForGame(
  game: GameSummary,
  currentUserId: string,
  t: (k: string) => string,
): { label: string; className: string } {
  if (!game.winner) return { label: t('history.result.draw'), className: 'text-muted-foreground bg-muted' }
  const isWin = game.winner === humanColor(game, currentUserId)
  return isWin
    ? { label: t('history.result.win'), className: 'text-player1 bg-player1/10' }
    : { label: t('history.result.loss'), className: 'text-player2 bg-player2/10' }
}

function opponentName(game: GameSummary, currentUserId: string): string {
  if (game.config.mode === 'pvp-online') {
    return String(game.players.player1.id) === String(currentUserId)
      ? game.players.player2.name
      : game.players.player1.name
  }
  return game.players.player1.isBot ? game.players.player1.name : game.players.player2.name
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function gameDurationMs(game: GameSummary): number {
  return new Date(game.updatedAt).getTime() - new Date(game.createdAt).getTime()
}

function applyFilter(games: GameSummary[], filter: HistoryFilter, currentUserId: string): GameSummary[] {
  return games.filter((g) => {
    if (filter.result !== 'all') {
      if (!g.winner) return false
      const isWin = g.winner === humanColor(g, currentUserId)
      if (filter.result === 'win' && !isWin) return false
      if (filter.result === 'loss' && isWin) return false
    }
    if (filter.mode !== 'all' && gameModeKey(g) !== filter.mode) return false
    if (filter.variant !== 'all' && gameVariantKey(g) !== filter.variant) return false
    return true
  })
}

function applySort(
  games: GameSummary[],
  field: GameSortField,
  dir: SortDirection,
  currentUserId: string,
): GameSummary[] {
  const d = dir === 'asc' ? 1 : -1
  return [...games].sort((a, b) => {
    switch (field) {
      case 'date':     return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * d
      case 'variant':  return gameVariantKey(a).localeCompare(gameVariantKey(b)) * d
      case 'mode':     return gameModeKey(a).localeCompare(gameModeKey(b)) * d
      case 'opponent': return opponentName(a, currentUserId).localeCompare(opponentName(b, currentUserId)) * d
      case 'board':    return (a.config.boardSize - b.config.boardSize) * d
      case 'duration': return (gameDurationMs(a) - gameDurationMs(b)) * d
      case 'moves':    return (a.moveCount - b.moveCount) * d
      case 'result': {
        const rank = (g: GameSummary) => {
          if (g.winner) return g.winner === humanColor(g, currentUserId) ? 0 : 1
          return 2
        }
        return (rank(a) - rank(b)) * d
      }
      default: return 0
    }
  })
}

// ─── SortButton ───────────────────────────────────────────────────────────────

function SortButton({ field, label, current, direction, onSort }: Readonly<{
  field: GameSortField
  label: string
  current: GameSortField
  direction: SortDirection
  onSort: (f: GameSortField) => void
}>) {
  const isActive = current === field
  const dirIcon = direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
  const icon = isActive ? dirIcon : <ArrowUpDown className="w-3 h-3 opacity-40" />

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium transition-colors select-none',
        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      {icon}
    </button>
  )
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

function FilterBar({ filter, availableModes, availableVariants, onChange }: Readonly<{
  filter: HistoryFilter
  availableModes: string[]
  availableVariants: string[]
  onChange: (f: HistoryFilter) => void
}>) {
  const { t } = useTranslation()

  const resultOptions: { value: HistoryFilter['result']; label: string }[] = [
    { value: 'all',  label: t('history.filterAll') },
    { value: 'win',  label: t('history.result.win') },
    { value: 'loss', label: t('history.result.loss') },
  ]

  return (
    <fieldset className="flex flex-wrap items-center gap-3 pb-3 border-none p-0 m-0">
      <legend className="sr-only">Filter options</legend>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t('history.colResult')}:</span>
        <div className="flex gap-1">
          {resultOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filter, result: opt.value })}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors border',
                filter.result === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50',
              )}
              aria-pressed={filter.result === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {availableVariants.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t('history.colVariant')}:</span>
          <select
            value={filter.variant}
            onChange={(e) => onChange({ ...filter, variant: e.target.value })}
            className="text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by game variant"
          >
            <option value="all">{t('history.filterAllVariants')}</option>
            {availableVariants.map((slug) => (
              <option key={slug} value={slug}>{variantLabel(slug, t)}</option>
            ))}
          </select>
        </div>
      )}

      {availableModes.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t('history.colMode')}:</span>
          <select
            value={filter.mode}
            onChange={(e) => onChange({ ...filter, mode: e.target.value })}
            className="text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by game mode"
          >
            <option value="all">{t('history.filterAllModes')}</option>
            {availableModes.map((key) => (
              <option key={key} value={key}>{modeLabel(key, t)}</option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page, totalPages, goToPage,
}: Readonly<{ page: number; totalPages: number; goToPage: (p: number) => void }>) {
  const { t } = useTranslation()

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-1 pt-4 border-t border-border">
      <Button variant="outline" size="icon" onClick={() => goToPage(1)} disabled={page === 1}
        aria-label={t('stats.first')} title={t('stats.first')}>
        <ChevronFirst className="w-4 h-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={() => goToPage(page - 1)} disabled={page === 1}
        aria-label={t('stats.previous')} title={t('stats.previous')}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-sm font-mono text-muted-foreground px-3 tabular-nums select-none">
        {t('stats.pageOf', { page, total: totalPages })}
      </span>
      <Button variant="outline" size="icon" onClick={() => goToPage(page + 1)} disabled={page === totalPages}
        aria-label={t('stats.next')} title={t('stats.next')}>
        <ChevronRight className="w-4 h-4" />
      </Button>
      <Button variant="outline" size="icon" onClick={() => goToPage(totalPages)} disabled={page === totalPages}
        aria-label={t('stats.last')} title={t('stats.last')}>
        <ChevronLast className="w-4 h-4" />
      </Button>
    </div>
  )
}

// ─── Row component ────────────────────────────────────────────────────────────

function GameRow({ game, currentUserId, onReplay, onResume }: Readonly<{
  game: GameSummary
  currentUserId: string
  onReplay: () => void
  onResume: () => void
}>) {
  const { t } = useTranslation()
  const result = resultForGame(game, currentUserId, t)
  const isActive = game.status === 'playing'
  const variant = gameVariantKey(game)
  const isNonDefault = variant !== 'y'

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      {/* Date */}
      <td className="py-3 pr-4 text-sm text-muted-foreground whitespace-nowrap">
        {formatDate(game.updatedAt)}
      </td>

      {/* Game = variant (if non-default) + mode badge */}
      <td className="py-3 pr-4">
        <div className="flex flex-col gap-0.5">
          {isNonDefault && (
            <span className="text-[10px] font-medium text-primary/70 leading-none">
              {variantLabel(variant, t)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full border border-border bg-muted/50 w-fit">
            <ModeIcon mode={game.config.mode} />
            {modeLabel(gameModeKey(game), t)}
          </span>
        </div>
      </td>

      {/* Opponent */}
      <td className="py-3 pr-4 font-medium text-sm truncate max-w-[110px]">
        {opponentName(game, currentUserId)}
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

      {/* Board */}
      <td className="py-3 pr-4 text-sm text-muted-foreground hidden sm:table-cell">
        {game.config.boardSize}×{game.config.boardSize}
      </td>

      {/* Duration · Moves */}
      <td className="py-3 pr-4 hidden md:table-cell">
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground tabular-nums font-mono">
          <span>{isActive ? '—' : formatTime(gameDurationMs(game))}</span>
          <span>{t('history.moves', { count: game.moveCount })}</span>
        </div>
      </td>

      {/* Action */}
      <td className="py-3">
        {isActive ? (
          <Button size="sm" variant="ghost" onClick={onResume} className="gap-1.5 h-7 text-xs text-primary">
            <Play className="w-3 h-3" />
            {t('history.resume')}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onReplay} className="gap-1.5 h-7 text-xs" disabled={game.moveCount === 0}>
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
  const { games, isLoading, error, isGuest, totalFinished, page, totalPages, goToPage, currentUserId } =
    useGameHistoryController()

  const [filter, setFilter] = useState<HistoryFilter>({
    result: 'all',
    mode: 'all',
    variant: 'all',
    sortField: 'date',
    sortDirection: 'desc',
  })

  const availableModes = useMemo(
    () => [...new Set(games.map(gameModeKey))].sort((a, b) => a.localeCompare(b)),
    [games],
  )

  const availableVariants = useMemo(
    () => [...new Set(games.map(gameVariantKey))].sort((a, b) => a.localeCompare(b)),
    [games],
  )

  const processed = useMemo(
    () => applySort(applyFilter(games, filter, currentUserId), filter.sortField, filter.sortDirection, currentUserId),
    [games, filter, currentUserId],
  )

  const handleSort = (field: GameSortField) => {
    setFilter((prev) => ({
      ...prev,
      sortField: field,
      sortDirection: prev.sortField === field && prev.sortDirection === 'desc' ? 'asc' : 'desc',
    }))
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

  let content
  if (isLoading) {
    content = (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  } else if (error) {
    content = <p className="text-center text-sm text-destructive py-8">{error}</p>
  } else if (games.length === 0) {
    content = <p className="text-center text-sm text-muted-foreground py-12">{t('history.noGames')}</p>
  } else {
    content = (
      <div className="space-y-4">
        <FilterBar
          filter={filter}
          availableModes={availableModes}
          availableVariants={availableVariants}
          onChange={setFilter}
        />

        {processed.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">{t('stats.noMatchesFilter')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4">
                    <SortButton field="date" label={t('history.colDate')} current={filter.sortField} direction={filter.sortDirection} onSort={handleSort} />
                  </th>
                  <th className="pb-2 pr-4">
                    <SortButton field="mode" label={t('history.colMode')} current={filter.sortField} direction={filter.sortDirection} onSort={handleSort} />
                  </th>
                  <th className="pb-2 pr-4">
                    <SortButton field="opponent" label={t('history.colOpponent')} current={filter.sortField} direction={filter.sortDirection} onSort={handleSort} />
                  </th>
                  <th className="pb-2 pr-4">
                    <SortButton field="result" label={t('history.colResult')} current={filter.sortField} direction={filter.sortDirection} onSort={handleSort} />
                  </th>
                  <th className="pb-2 pr-4 hidden sm:table-cell">
                    <SortButton field="board" label={t('history.colBoard')} current={filter.sortField} direction={filter.sortDirection} onSort={handleSort} />
                  </th>
                  <th className="pb-2 pr-4 hidden md:table-cell">
                    <SortButton field="duration" label={t('history.colDuration')} current={filter.sortField} direction={filter.sortDirection} onSort={handleSort} />
                  </th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {processed.map((game) => (
                  <GameRow
                    key={game.id}
                    game={game}
                    currentUserId={currentUserId}
                    onReplay={() => navigate(`/games/${game.config.variant ?? 'y'}/replay/${game.id}`)}
                    onResume={() => navigate(`/games/${game.config.variant ?? 'y'}/play/${game.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} goToPage={goToPage} />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
        <h1 className="text-3xl font-bold">{t('history.title')}</h1>
      </div>

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
