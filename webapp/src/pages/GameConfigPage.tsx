import { useNavigate } from 'react-router-dom'
import { useGameConfigController } from '@/controllers/useGameConfigController'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import type { BoardSize, BotLevel, PlayerColor } from '@/types'

const boardSizes: BoardSize[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
const botLevels: { value: BotLevel; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]
const playerColors: { value: PlayerColor; label: string }[] = [
  { value: 'player1', label: 'Blue (First)' },
  { value: 'player2', label: 'Red (Second)' },
]

export function GameConfigPage() {
  const navigate = useNavigate()
  const {
    mode,
    boardSize,
    setBoardSize,
    timerEnabled,
    setTimerEnabled,
    timerMinutes,
    setTimerMinutes,
    botLevel,
    setBotLevel,
    playerColor,
    setPlayerColor,
    isLoading,
    error,
    handleStartGame,
  } = useGameConfigController()

  const getModeTitle = () => {
    switch (mode) {
      case 'pvp-local':
        return 'Local Match'
      case 'pve':
        return 'vs Computer'
      default:
        return 'Game Setup'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-lg mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/games/y')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{getModeTitle()}</CardTitle>
            <CardDescription>
              Configure your game settings
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Board Size */}
            <div className="space-y-2">
              <Label htmlFor="boardSize">Board Size</Label>
              <Select
                id="boardSize"
                value={String(boardSize)}
                onChange={(e) => setBoardSize(Number(e.target.value) as BoardSize)}
              >
                {boardSizes.map((size) => (
                  <option key={size} value={size}>
                    {size} x {size}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Larger boards make for longer, more strategic games
              </p>
            </div>

            {/* PvE specific options */}
            {mode === 'pve' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="botLevel">Bot Difficulty</Label>
                  <Select
                    id="botLevel"
                    value={botLevel}
                    onChange={(e) => setBotLevel(e.target.value as BotLevel)}
                  >
                    {botLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="playerColor">Your Color</Label>
                  <Select
                    id="playerColor"
                    value={playerColor}
                    onChange={(e) => setPlayerColor(e.target.value as PlayerColor)}
                  >
                    {playerColors.map((color) => (
                      <option key={color.value} value={color.value}>
                        {color.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {/* Timer settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="timer">Enable Timer</Label>
                  <p className="text-xs text-muted-foreground">
                    Each player has limited time to play
                  </p>
                </div>
                <Switch
                  id="timer"
                  checked={timerEnabled}
                  onCheckedChange={setTimerEnabled}
                />
              </div>

              {timerEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="timerMinutes">Time per Player (minutes)</Label>
                  <Select
                    id="timerMinutes"
                    value={String(timerMinutes)}
                    onChange={(e) => setTimerMinutes(Number(e.target.value))}
                  >
                    {[5, 10, 15, 20, 30].map((mins) => (
                      <option key={mins} value={mins}>
                        {mins} minutes
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleStartGame}
              isLoading={isLoading}
            >
              Start Game
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
