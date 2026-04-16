import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatchRecord, MatchHistoryFilter, MatchSortField, SortDirection } from '@/types'
import { formatTime, cn } from '@/utils'
import { Button } from '@/components/ui/Button'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

const PAGE_SIZE = 5

// ── Sort helpers ──────────────────────────────────────────────────────────────

function sortRecords(
  records: readonly MatchRecord[],
  field: MatchSortField,
  direction: SortDirection,
): MatchRecord[] {
  const dir = direction === 'asc' ? 1 : -1
  return [...records].sort((a, b) => {
    switch (field) {
      case 'date':
        return (new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()) * dir
      case 'duration':
        return (a.durationSeconds - b.durationSeconds) * dir
      case 'result':
        return a.result.localeCompare(b.result) * dir
      case 'opponent':
        return a.opponentName.localeCompare(b.opponentName) * dir
      case 'gameMode':
        return ((a.gameMode ?? '').localeCompare(b.gameMode ?? '')) * dir
      default:
        return 0
    }
  })
}

function filterRecords(
  records: readonly MatchRecord[],
  filter: MatchHistoryFilter,
): MatchRecord[] {
  return records.filter((r) => {
    if (filter.result && filter.result !== 'all' && r.result !== filter.result) return false
    if (filter.gameMode && filter.gameMode !== 'all' && r.gameMode !== filter.gameMode) return false
    return true
  })
}

// ── SortButton ────────────────────────────────────────────────────────────────

interface SortButtonProps {
  field: MatchSortField
  label: string
  current: MatchSortField
  direction: SortDirection
  onSort: (field: MatchSortField) => void
}

export function SortButton({ field, label, current, direction, onSort }: SortButtonProps) {
  const isActive = current === field
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium transition-colors select-none',
        isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
      aria-label={`Sort by ${label}`}
      aria-pressed={isActive}
    >
      {label}
      {isActive ? (
        direction === 'asc' ? (
          <ArrowUp className="w-3 h-3" data-testid="sort-asc" />
        ) : (
          <ArrowDown className="w-3 h-3" data-testid="sort-desc" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" data-testid="sort-neutral" />
      )}
    </button>
  )
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

interface FilterBarProps {
  filter: MatchHistoryFilter
  availableModes: string[]
  onChange: (f: MatchHistoryFilter) => void
}

export function FilterBar({ filter, availableModes, onChange }: FilterBarProps) {
  const { t } = useTranslation()

  const resultOptions = [
    { value: 'all', label: t('stats.filterAll') },
    { value: 'win', label: t('stats.win') },
    { value: 'loss', label: t('stats.loss') },
  ]

  const modeOptions = [
    { value: 'all', label: t('stats.filterAllModes') },
    ...availableModes.map((m) => ({ value: m, label: m })),
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 pb-3" role="group" aria-label="Filter options">
      {/* Result filter */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{t('stats.result')}:</span>
        <div className="flex gap-1">
          {resultOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...filter, result: opt.value as any })}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors border',
                filter.result === opt.value || (!filter.result && opt.value === 'all')
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50',
              )}
              aria-pressed={filter.result === opt.value || (!filter.result && opt.value === 'all')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Game mode filter — only shown if there are multiple modes */}
      {availableModes.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t('stats.gameMode')}:</span>
          <select
            value={filter.gameMode ?? 'all'}
            onChange={(e) => onChange({ ...filter, gameMode: e.target.value })}
            className="text-xs rounded border border-border bg-card px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by game mode"
          >
            {modeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface MatchHistoryTableProps {
  history: readonly MatchRecord[]
}

export function MatchHistoryTable({ history }: Readonly<MatchHistoryTableProps>) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<MatchHistoryFilter>({
    result: 'all',
    gameMode: 'all',
    sortField: 'date',
    sortDirection: 'desc',
  })

  // Extract unique game modes from history for the filter dropdown
  const availableModes = useMemo(() => {
    const modes = new Set(history.map((r) => r.gameMode).filter(Boolean) as string[])
    return Array.from(modes).sort((a, b) => a.localeCompare(b))
  }, [history])

  const handleSort = (field: MatchSortField) => {
    setFilter((prev) => ({
      ...prev,
      sortField: field,
      sortDirection: prev.sortField === field && prev.sortDirection === 'desc' ? 'asc' : 'desc',
    }))
    setPage(0)
  }

  const handleFilterChange = (f: MatchHistoryFilter) => {
    setFilter(f)
    setPage(0)
  }

  const processed = useMemo(
    () => sortRecords(filterRecords(history, filter), filter.sortField, filter.sortDirection),
    [history, filter],
  )

  const totalPages = Math.ceil(processed.length / PAGE_SIZE)
  const paginated = processed.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (history.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">{t('stats.noMatches')}</p>
  }

  return (
    <div className="space-y-3">
      <FilterBar
        filter={filter}
        availableModes={availableModes}
        onChange={handleFilterChange}
      />

      {processed.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">{t('stats.noMatchesFilter')}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-3">
                    <SortButton
                      field="opponent"
                      label={t('stats.opponent')}
                      current={filter.sortField}
                      direction={filter.sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="pb-2 pr-3">
                    <SortButton
                      field="result"
                      label={t('stats.result')}
                      current={filter.sortField}
                      direction={filter.sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  <th className="pb-2 pr-3">
                    <SortButton
                      field="duration"
                      label={t('stats.duration')}
                      current={filter.sortField}
                      direction={filter.sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                  {availableModes.length > 0 && (
                    <th className="pb-2 pr-3 hidden sm:table-cell">
                      <SortButton
                        field="gameMode"
                        label={t('stats.gameMode')}
                        current={filter.sortField}
                        direction={filter.sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                  )}
                  <th className="pb-2 hidden sm:table-cell">
                    <SortButton
                      field="date"
                      label={t('stats.date')}
                      current={filter.sortField}
                      direction={filter.sortDirection}
                      onSort={handleSort}
                    />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((match) => (
                  <tr key={match.id} className="py-2">
                    <td className="py-2 pr-3 font-medium">{match.opponentName}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-semibold',
                          match.result === 'win'
                            ? 'bg-player1/15 text-player1'
                            : 'bg-player2/15 text-player2',
                        )}
                      >
                        {match.result === 'win' ? t('stats.win') : t('stats.loss')}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground tabular-nums">
                      {formatTime(match.durationSeconds * 1000)}
                    </td>
                    {availableModes.length > 0 && (
                      <td className="py-2 pr-3 text-muted-foreground hidden sm:table-cell text-xs">
                        {match.gameMode ?? '—'}
                      </td>
                    )}
                    <td className="py-2 text-muted-foreground hidden sm:table-cell">
                      {new Date(match.playedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(0)}
                disabled={page === 0}
              >
                {t('stats.first')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                {t('stats.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('stats.pageOf', { page: page + 1, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === totalPages - 1}
              >
                {t('stats.next')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages - 1)}
                disabled={page === totalPages - 1}
              >
                {t('stats.last')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}