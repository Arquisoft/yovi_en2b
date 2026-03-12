import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameMode, BoardSize, BotLevel, PlayerColor, GameConfig } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

export function useGameConfigController() {
  const navigate = useNavigate()
  const { mode } = useParams<{ mode: GameMode }>()
  const { user } = useAuth()

  const [boardSize, setBoardSize] = useState<BoardSize>(9)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(10)
  const [botLevel, setBotLevel] = useState<BotLevel>('medium')
  const [playerColor, setPlayerColor] = useState<PlayerColor>('player1')
  const [roomName, setRoomName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
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
        roomName: mode === 'pvp-online' ? roomName : undefined,
        isPrivate: mode === 'pvp-online' ? isPrivate : undefined,
      }

      if (mode === 'pvp-online') {
        // Create a room and go to lobby
        const room = await gameService.createRoom(config, {
          id: user.id,
          name: user.username,
          color: 'player1',
        })
        navigate(`/games/y/lobby?roomId=${room.id}`)
      } else {
        // Start game directly
        const game = await gameService.createGame(config, {
          id: user.id,
          name: user.username,
          color: 'player1',
        })
        navigate(`/games/y/play/${game.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setIsLoading(false)
    }
  }, [
    mode,
    user,
    boardSize,
    timerEnabled,
    timerMinutes,
    botLevel,
    playerColor,
    roomName,
    isPrivate,
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
    roomName,
    setRoomName,
    isPrivate,
    setIsPrivate,
    isLoading,
    error,
    handleStartGame,
  }
}
