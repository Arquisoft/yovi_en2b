import { ModeCard } from '@/components/ModeCard'
import { useGameModeController } from '@/controllers/useGameModeController'
import { Button } from '@/components/ui/Button'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { GameMode } from '@/types'

const modes: GameMode[] = ['pvp-local', 'pvp-online', 'pve']

export function GameModePage() {
  const { handleSelectMode } = useGameModeController()
  const navigate = useNavigate()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/games')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Games
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Game Y</h1>
          <p className="text-muted-foreground">
            Select how you want to play
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map((mode) => (
            <ModeCard
              key={mode}
              mode={mode}
              onSelect={() => handleSelectMode(mode)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
