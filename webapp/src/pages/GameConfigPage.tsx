import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGameConfigController } from '@/controllers/useGameConfigController'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import type { BotLevel, PlayerColor } from '@/types'

export function GameConfigPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    mode,
    boardSizeInput, setBoardSizeInput, boardSizeError, parsedBoardSize,
    timerInput, setTimerInput, timerError, parsedTimerMinutes,
    timerEnabled, setTimerEnabled,
    botLevel, setBotLevel,
    playerColor, setPlayerColor,
    pieRule, setPieRule,
    isLoading, error, handleStartGame,
    boardMin, boardMax, timerMin, timerMax,
  } = useGameConfigController()

  const getModeTitle = () => {
    switch (mode) {
      case 'pvp-local': return t('gameConfig.localMatch')
      case 'pve':       return t('gameConfig.vsComputer')
      default:          return t('gameConfig.gameSetup')
    }
  }

  const botLevels: { value: BotLevel; label: string }[] = [
    { value: 'easy',   label: t('gameConfig.botLevels.easy')   },
    { value: 'medium', label: t('gameConfig.botLevels.medium') },
    { value: 'hard',   label: t('gameConfig.botLevels.hard')   },
  ]

  const playerColors: { value: PlayerColor; label: string }[] = [
    { value: 'player1', label: t('gameConfig.colorBlue') },
    { value: 'player2', label: t('gameConfig.colorRed')  },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-lg mx-auto">
        <Button variant="ghost" onClick={() => navigate('/games/y')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{getModeTitle()}</CardTitle>
            <CardDescription>{t('gameConfig.configureSettings')}</CardDescription>
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
              <Label htmlFor="boardSize">{t('gameConfig.boardSize')}</Label>
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
                    {t('gameConfig.boardSizeDisplay', { size: parsedBoardSize })}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">{t('gameConfig.boardSizePlaceholder')}</span>
                )}
              </div>
              {boardSizeError ? (
                <p className="text-xs text-destructive">
                  {t('gameConfig.boardSizeError', { min: boardMin, max: boardMax })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('gameConfig.boardSizeRange', { min: boardMin, max: boardMax })}
                </p>
              )}
            </div>

            {/* PvE options */}
            {mode === 'pve' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="botLevel">{t('gameConfig.botDifficulty')}</Label>
                  <Select id="botLevel" value={botLevel} onChange={(e) => setBotLevel(e.target.value as BotLevel)}>
                    {botLevels.map((level) => (
                      <option key={level.value} value={level.value}>{level.label}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="playerColor">{t('gameConfig.yourColor')}</Label>
                  <Select id="playerColor" value={playerColor} onChange={(e) => setPlayerColor(e.target.value as PlayerColor)}>
                    {playerColors.map((color) => (
                      <option key={color.value} value={color.value}>{color.label}</option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {/* Timer */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="timer">{t('gameConfig.enableTimer')}</Label>
                  <p className="text-xs text-muted-foreground">{t('gameConfig.timerDescription')}</p>
                </div>
                <Switch id="timer" checked={timerEnabled} onCheckedChange={setTimerEnabled} />
              </div>

              {timerEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="timerMinutes">{t('gameConfig.timePerPlayer')}</Label>
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
                      {parsedTimerMinutes === 1 ? t('common.minute') : t('common.minutes')}
                    </span>
                  </div>
                  {timerError ? (
                    <p className="text-xs text-destructive">
                      {t('gameConfig.timerError', { min: timerMin, max: timerMax })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t('gameConfig.timerRange', { min: timerMin, max: timerMax })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Pie Rule */}
            {mode !== 'pvp-online' && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="pieRule">{t('gameConfig.pieRule')}</Label>
                  <p className="text-xs text-muted-foreground">{t('gameConfig.pieRuleDescription')}</p>
                </div>
                <Switch id="pieRule" checked={pieRule} onCheckedChange={setPieRule} />
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleStartGame}
              isLoading={isLoading}
              disabled={!!boardSizeError || !!timerError || boardSizeInput === '' || (timerEnabled && timerInput === '')}
            >
              {t('gameConfig.startGame')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}