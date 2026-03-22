// webapp/src/pages/RankingPage.tsx

import { useNavigate } from 'react-router-dom'
import { useRankingController } from '@/controllers/useRankingController'
import { RankingTable } from '@/components/ranking/RankingTable'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ArrowLeft } from 'lucide-react'
import type { RankingMode } from '@/types'

const MODES: { value: RankingMode; label: string }[] = [
  { value: 'pve-easy',   label: 'Bot fácil'     },
  { value: 'pve-medium', label: 'Bot intermedio' },
  { value: 'pve-hard',   label: 'Bot difícil'    },
]

export function RankingPage() {
  const navigate = useNavigate()
  const { selectedMode, setSelectedMode, entries, isLoading, currentUsername } =
    useRankingController()

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Ranking</h1>
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
            {mode.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {MODES.find((m) => m.value === selectedMode)?.label} — Top 5
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