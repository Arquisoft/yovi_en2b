// webapp/src/components/stats/MatchHistoryTable.tsx
import type { MatchRecord } from '@/types'
import { formatTime } from '@/utils'
import { cn } from '@/utils'

interface MatchHistoryTableProps {
  history: MatchRecord[]
}

export function MatchHistoryTable({ history }: MatchHistoryTableProps) {
  if (history.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No matches played yet
      </p>
    )
  }

  return (
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
          {history.map((match) => (
            <tr key={match.id} className="py-2">
              <td className="py-2 font-medium">{match.opponentName}</td>
              <td className="py-2">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-semibold',
                    match.result === 'win'
                      ? 'bg-player1/15 text-player1'
                      : 'bg-player2/15 text-player2'
                  )}
                >
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
  )
}
