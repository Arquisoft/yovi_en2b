import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { useGameSelectionController } from '@/controllers/useGameSelectionController'
import { AlertCircle, Users, Gamepad2, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { GameInfo } from '@/types'

const formatPlayers = (game: GameInfo) =>
  game.minPlayers === game.maxPlayers
    ? `${game.minPlayers}`
    : `${game.minPlayers}-${game.maxPlayers}`

export function GameSelectionPage() {
  const { games, isLoading, error, handlePlayGame } = useGameSelectionController()
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null)
  const [imgError, setImgError] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    if (games.length > 0 && !selectedGame) {
      setSelectedGame(games[0])
    }
  }, [games])

  // Resetea el error de imagen al cambiar de juego
  useEffect(() => {
    setImgError(false)
  }, [selectedGame?.id])

  const activeGame = selectedGame

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
          <p className="text-muted-foreground">Select a game to start playing</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-6 min-h-[400px]">

          {/* Panel izquierdo */}
          <div className="order-2 md:order-1 flex flex-col">
            {activeGame ? (
              <div className="flex-1 rounded-xl border bg-card overflow-hidden flex flex-col transition-all duration-300">

                {/* Imagen */}
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
                  {activeGame.thumbnail && !imgError ? (
                    <img
                      src={activeGame.thumbnail
                        ? theme === 'dark'
                          ? activeGame.thumbnail.replace('.png', '-dark.png')
                          : activeGame.thumbnail.replace('.png', '-light.png')
                        : undefined}
                      alt={activeGame.name}
                      className="w-full h-full object-cover transition-all duration-300"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <Gamepad2 className="w-24 h-24 text-primary/50" /> //Si no tiene foto le pongo el icono
                  )}

                  {/* Coming Soon sobre la imagen */}
                  {!activeGame.isAvailable && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-semibold text-lg bg-amber-500/80 px-4 py-1 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-2xl font-bold">{activeGame.name}</h2>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {formatPlayers(activeGame)} players
                    </span>
                  </div>
                  <p className="text-muted-foreground flex-1">{activeGame.description}</p>
                  <Button
                    onClick={() => handlePlayGame(activeGame.id)}
                    className="w-full mt-4"
                    size="lg"
                    disabled={!activeGame.isAvailable}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {activeGame.isAvailable ? 'Play Now' : 'Coming Soon'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 rounded-xl border bg-card flex items-center justify-center text-muted-foreground">
                Select a game from the list
              </div>
            )}
          </div>

          {/* Lista de juegos */}
          <div className="order-1 md:order-2 flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-1">
              Available Games
            </h3>
            <div className="flex flex-col gap-2">
              {games.map((game) => (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(game)}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 hover:border-primary/50 hover:bg-accent/50 ${
                    activeGame?.id === game.id
                      ? 'border-primary bg-accent'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 overflow-hidden">
                      {game.thumbnail ? (
                        <img
                          src={game.thumbnail
                            ? theme === 'dark'
                              ? game.thumbnail.replace('.png', '-dark.png')
                              : game.thumbnail.replace('.png', '-light.png')
                            : undefined}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            const fallback = e.currentTarget.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = 'block'
                          }}
                        />
                      ) : null}
                      <Gamepad2
                        className="w-5 h-5 text-primary/50"
                        style={{ display: game.thumbnail ? 'none' : 'block' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{game.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {formatPlayers(game)} players
                        {!game.isAvailable && (
                          <span className="ml-2 text-amber-500">Coming Soon</span>
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}