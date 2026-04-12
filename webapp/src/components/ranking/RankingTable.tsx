import { useTranslation } from 'react-i18next'
import type { RankingEntry } from '@/types'
import { cn } from '@/utils'
import { Trophy } from 'lucide-react'
 
const medalColors: Record<number, string> = { 1: 'text-yellow-400', 2: 'text-gray-400', 3: 'text-amber-600' }
 
export function RankingTable({ entries, currentUsername }: { entries: RankingEntry[]; currentUsername: string | null }) {
  const { t } = useTranslation()
 
  if (entries.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-8">{t('ranking.noData')}</p>
  }
 
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-left">
            <th className="pb-2 font-medium w-12">{t('ranking.rankHash')}</th>
            <th className="pb-2 font-medium">{t('ranking.player')}</th>
            <th className="pb-2 font-medium text-right">{t('ranking.victories')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => {
            const isCurrentUser = entry.username === currentUsername
            const medalColor = medalColors[entry.rank]
            return (
              <tr key={entry.rank} className={cn('py-2', isCurrentUser && 'bg-primary/5')}>
                <td className="py-3">
                  {medalColor
                    ? <Trophy className={cn('w-4 h-4', medalColor)} />
                    : <span className="text-muted-foreground">{entry.rank}</span>
                  }
                </td>
                <td className={cn('py-3 font-medium', isCurrentUser && 'text-primary')}>
                  {entry.username}
                  {isCurrentUser && <span className="ml-2 text-xs text-muted-foreground">{t('ranking.you')}</span>}
                </td>
                <td className="py-3 text-right font-mono font-semibold">{entry.wins}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}