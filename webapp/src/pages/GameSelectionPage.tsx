import { GameCard } from '@/components/GameCard'
import { useGameSelectionController } from '@/controllers/useGameSelectionController'
import { AlertCircle } from 'lucide-react'

export function GameSelectionPage() {
  const { games, isLoading, error, handlePlayGame } = useGameSelectionController()

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <p className="text-lg text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Choose Your Game</h1>
          <p className="text-muted-foreground">
            Select a game to start playing
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={() => handlePlayGame(game.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
