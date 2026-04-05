import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameMode, BoardSize, BotLevel, PlayerColor, GameConfig } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

export function useGameConfigController() {
  const navigate = useNavigate()
  const { mode } = useParams<{ mode: GameMode }>()
  const { user, token } = useAuth()

  const [boardSize, setBoardSize] = useState<BoardSize>(9)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(10)
  const [botLevel, setBotLevel] = useState<BotLevel>('medium')
  const [playerColor, setPlayerColor] = useState<PlayerColor>('player1')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartGame = useCallback(async () => {
    if (!mode || !user) return

    setIsLoading(true)
    setError(null)

    try {
      const config: GameConfig = {
        mode: mode as GameMode,
        boardSize,
        timerEnabled,
        timerSeconds: timerEnabled ? timerMinutes * 60 : undefined,
        botLevel: mode === 'pve' ? botLevel : undefined,
        playerColor: mode === 'pve' ? playerColor : undefined,
      }

      const game = await gameService.createGame(config, token ?? '')
      navigate(`/games/y/play/${game.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setIsLoading(false)
    }
  }, [
    mode,
    user,
    token,
    boardSize,
    timerEnabled,
    timerMinutes,
    botLevel,
    playerColor,
    navigate,
  ])

  return {
    mode: mode as GameMode,
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
  }
}
