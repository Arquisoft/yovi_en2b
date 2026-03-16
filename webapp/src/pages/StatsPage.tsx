// webapp/src/pages/StatsPage.tsx
import { useStatsController } from '@/controllers/useStatsController'
import { WinrateChart } from '@/components/stats/WinrateChart'
import { MatchHistoryTable } from '@/components/stats/MatchHistoryTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

export function StatsPage() {
  const { history, stats, isLoading } = useStatsController()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Statistics</h1>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Winrate</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap justify-around gap-8">
            <WinrateChart data={stats.overall} title="Overall" />
            <WinrateChart data={stats.recent} title="Last 20 games" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Match History</CardTitle>
        </CardHeader>
        <CardContent>
          <MatchHistoryTable history={history} />
        </CardContent>
      </Card>
    </div>
  )
}