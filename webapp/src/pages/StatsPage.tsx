import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useStatsController } from '@/controllers/useStatsController'
import { WinrateChart } from '@/components/stats/WinrateChart'
import { MatchHistoryTable } from '@/components/stats/MatchHistoryTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, BarChart2 } from 'lucide-react'
 
export function StatsPage() {
  const { t } = useTranslation()
  const { history, stats, isLoading, isGuest } = useStatsController()
  const navigate = useNavigate()
 
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
 
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
        <h1 className="text-3xl font-bold">{t('stats.title')}</h1>
      </div>
 
      {isGuest ? (
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
      ) : (
        <>
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('stats.winrate')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap justify-around gap-8">
                <WinrateChart data={stats.overall} title={t('stats.overall')} />
                <WinrateChart data={stats.recent}  title={t('stats.recent')}  />
              </CardContent>
            </Card>
          )}
 
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('stats.matchHistory')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MatchHistoryTable history={history} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
 