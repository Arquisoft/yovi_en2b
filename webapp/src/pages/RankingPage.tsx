import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRankingController } from '@/controllers/useRankingController'
import { RankingTable } from '@/components/ranking/RankingTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ArrowLeft } from 'lucide-react'
import type { RankingMode } from '@/types'
 
export function RankingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { selectedMode, setSelectedMode, entries, isLoading, currentUsername } = useRankingController()
 
  const MODES: { value: RankingMode; labelKey: string }[] = [
    { value: 'pve-easy',   labelKey: 'ranking.modes.pve-easy'   },
    { value: 'pve-medium', labelKey: 'ranking.modes.pve-medium' },
    { value: 'pve-hard',   labelKey: 'ranking.modes.pve-hard'   },
  ]
 
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
        <h1 className="text-3xl font-bold">{t('ranking.title')}</h1>
      </div>
 
      <div className="flex gap-2 flex-wrap">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setSelectedMode(mode.value)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
              selectedMode === mode.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            {t(mode.labelKey)}
          </button>
        ))}
      </div>
 
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {t('ranking.top5', { mode: t(`ranking.modes.${selectedMode}`) })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <RankingTable entries={entries.slice(0, 5)} currentUsername={currentUsername} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}