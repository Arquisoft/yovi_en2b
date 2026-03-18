// webapp/src/components/stats/MatchHistoryTable.tsx
import { useState } from 'react'
import type { MatchRecord } from '@/types'
import { formatTime, cn } from '@/utils'
import { Button } from '@/components/ui/Button'

interface MatchHistoryTableProps {
  history: MatchRecord[]
}

const PAGE_SIZE = 5

export function MatchHistoryTable({ history }: MatchHistoryTableProps) {
  const [page, setPage] = useState(0)
  const totalPages = Math.ceil(history.length / PAGE_SIZE)
  const paginated = history.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  if (history.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No matches played yet
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-left">
              <th className="pb-2 font-medium">Opponent</th>
              <th className="pb-2 font-medium">Result</th>
              <th className="pb-2 font-medium">Duration</th>
              <th className="pb-2 font-medium hidden sm:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated.map((match) => (
              <tr key={match.id} className="py-2">
                <td className="py-2 font-medium">{match.opponentName}</td>
                <td className="py-2">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-semibold',
                    match.result === 'win'
                      ? 'bg-player1/15 text-player1'
                      : 'bg-player2/15 text-player2'
                  )}>
                    {match.result === 'win' ? 'Win' : 'Loss'}
                  </span>
                </td>
                <td className="py-2 text-muted-foreground">
                  {formatTime(match.durationSeconds * 1000)}
                </td>
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
          <Button variant="outline" size="sm" onClick={() => setPage(0)} disabled={page === 0}>
            First
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages - 1}>
            Next
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}>
            Last
          </Button>
        </div>
      )}
    </div>
  )
}