import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MatchRecord } from '@/types'
import { formatTime, cn } from '@/utils'
import { Button } from '@/components/ui/Button'
 
const PAGE_SIZE = 5
 
export function MatchHistoryTable({ history }: Readonly<{ history: readonly MatchRecord[] }>) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(history.length / PAGE_SIZE)
  const paginated = history.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
 
  if (history.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">{t('stats.noMatches')}</p>
  }
 
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="pb-2 font-medium">{t('stats.opponent')}</th>
              <th className="pb-2 font-medium">{t('stats.result')}</th>
              <th className="pb-2 font-medium">{t('stats.duration')}</th>
              <th className="pb-2 font-medium hidden sm:table-cell">{t('stats.date')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((match) => (
              <tr key={match.id} className="py-2">
                <td className="py-2 font-medium">{match.opponentName}</td>
                <td className="py-2">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-semibold',
                    match.result === 'win' ? 'bg-player1/15 text-player1' : 'bg-player2/15 text-player2'
                  )}>
                    {match.result === 'win' ? t('stats.win') : t('stats.loss')}
                  </span>
                </td>
                <td className="py-2 text-muted-foreground">{formatTime(match.durationSeconds * 1000)}</td>
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
          <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0}>{t('stats.first')}</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>{t('stats.previous')}</Button>
          <span className="text-sm text-muted-foreground">{t('stats.pageOf', { page: page + 1, total: totalPages })}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1}>{t('stats.next')}</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}>{t('stats.last')}</Button>
        </div>
      )}
    </div>
  )
}
 