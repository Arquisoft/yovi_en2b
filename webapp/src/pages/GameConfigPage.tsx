import { useNavigate } from 'react-router-dom'
import { useGameConfigController } from '@/controllers/useGameConfigController'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import type { BotLevel, PlayerColor } from '@/types'

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
    boardSizeInput,
    setBoardSizeInput,
    boardSizeError,
    parsedBoardSize,
    timerInput,
    setTimerInput,
    timerError,
    parsedTimerMinutes,
    timerEnabled,
    setTimerEnabled,
    botLevel,
    setBotLevel,
    playerColor,
    setPlayerColor,
    isLoading,
    error,
    handleStartGame,
    boardMin,
    boardMax,
    timerMin,
    timerMax,
  } = useGameConfigController()

  const getModeTitle = () => {
    switch (mode) {
      case 'pvp-local': return 'Local Match'
      case 'pve':       return 'vs Computer'
      default:          return 'Game Setup'
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
            <CardDescription>Configure your game settings</CardDescription>
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
              <div className="flex items-center gap-3">
                <Input
                  id="boardSize"
                  type="number"
                  min={boardMin}
                  max={boardMax}
                  value={boardSizeInput}
                  onChange={(e) => setBoardSizeInput(e.target.value)}
                  error={!!boardSizeError}
                  className="w-24"
                  placeholder="9"
                />
                {parsedBoardSize ? (
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {parsedBoardSize} × {parsedBoardSize}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">— × —</span>
                )}
              </div>
              {boardSizeError ? (
                <p className="text-xs text-destructive">{boardSizeError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Enter a number from {boardMin} to {boardMax}. Larger boards make for longer, more strategic games.
                </p>
              )}
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

            {/* Timer */}
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
                  <Label htmlFor="timerMinutes">Time per Player</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="timerMinutes"
                      type="number"
                      min={timerMin}
                      max={timerMax}
                      value={timerInput}
                      onChange={(e) => setTimerInput(e.target.value)}
                      error={!!timerError}
                      className="w-24"
                      placeholder="10"
                    />
                    <span className="text-sm text-muted-foreground">
                      {parsedTimerMinutes === 1 ? 'minute' : 'minutes'}
                    </span>
                  </div>
                  {timerError ? (
                    <p className="text-xs text-destructive">{timerError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Enter a number from {timerMin} to {timerMax} minutes.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleStartGame}
              isLoading={isLoading}
              disabled={!!boardSizeError || !!timerError || boardSizeInput === '' || (timerEnabled && timerInput === '')}
            >
              Start Game
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
