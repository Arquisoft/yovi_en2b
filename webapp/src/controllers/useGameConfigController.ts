import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameMode, BoardSize, BotLevel, PlayerColor, GameConfig } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

const BOARD_MIN = 4
const BOARD_MAX = 16
const TIMER_MIN = 1
const TIMER_MAX = 20

function parseBoardSize(raw: string): BoardSize | null {
  const n = parseInt(raw, 10)
  if (isNaN(n) || n < BOARD_MIN || n > BOARD_MAX) return null
  return n as BoardSize
}

function parseTimerMinutes(raw: string): number | null {
  const n = parseInt(raw, 10)
  if (isNaN(n) || n < TIMER_MIN || n > TIMER_MAX) return null
  return n
}

interface SavedConfig {
  boardSizeInput: string
  timerInput: string
  timerEnabled: boolean
  botLevel: BotLevel
  playerColor: PlayerColor
}

function storageKey(mode: string) {
  return `yovi_config_${mode}`
}

function loadSaved(mode: string): SavedConfig | null {
  try {
    const raw = sessionStorage.getItem(storageKey(mode))
    return raw ? (JSON.parse(raw) as SavedConfig) : null
  } catch {
    return null
  }
}

function saveConfig(mode: string, cfg: SavedConfig) {
  try {
    sessionStorage.setItem(storageKey(mode), JSON.stringify(cfg))
  } catch { /* ignore */ }
}

export function useGameConfigController() {
  const navigate = useNavigate()
  const { mode } = useParams<{ mode: GameMode }>()
  const { user, token, isGuest } = useAuth()
  const effectiveToken = isGuest ? undefined : (token ?? undefined)

  const saved = mode ? loadSaved(mode) : null

  const [boardSizeInput, setBoardSizeInput] = useState(saved?.boardSizeInput ?? '9')
  const [timerInput, setTimerInput] = useState(saved?.timerInput ?? '10')
  const [timerEnabled, setTimerEnabled] = useState(saved?.timerEnabled ?? false)
  const [botLevel, setBotLevel] = useState<BotLevel>(saved?.botLevel ?? 'medium')
  const [playerColor, setPlayerColor] = useState<PlayerColor>(saved?.playerColor ?? 'player1')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-hydrate if mode changes (e.g. navigating between modes)
  useEffect(() => {
    if (!mode) return
    const s = loadSaved(mode)
    if (!s) return
    setBoardSizeInput(s.boardSizeInput)
    setTimerInput(s.timerInput)
    setTimerEnabled(s.timerEnabled)
    setBotLevel(s.botLevel)
    setPlayerColor(s.playerColor)
  }, [mode])

  const boardSizeError =
    boardSizeInput !== '' && parseBoardSize(boardSizeInput) === null
      ? `Must be a whole number between ${BOARD_MIN} and ${BOARD_MAX}`
      : null

  const timerError =
    timerEnabled && timerInput !== '' && parseTimerMinutes(timerInput) === null
      ? `Must be a whole number between ${TIMER_MIN} and ${TIMER_MAX}`
      : null

  const parsedBoardSize = parseBoardSize(boardSizeInput)
  const parsedTimerMinutes = parseTimerMinutes(timerInput)

  const handleStartGame = useCallback(async () => {
    if (!mode || !user) return

    const boardSize = parseBoardSize(boardSizeInput)
    if (!boardSize) {
      setError(`Board size must be a whole number between ${BOARD_MIN} and ${BOARD_MAX}`)
      return
    }

    if (timerEnabled) {
      const minutes = parseTimerMinutes(timerInput)
      if (!minutes) {
        setError(`Timer must be a whole number between ${TIMER_MIN} and ${TIMER_MAX} minutes`)
        return
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      const timerMinutes = timerEnabled ? (parseTimerMinutes(timerInput) ?? 10) : undefined
      const config: GameConfig = {
        mode: mode as GameMode,
        boardSize,
        timerEnabled,
        timerSeconds: timerEnabled && timerMinutes ? timerMinutes * 60 : undefined,
        botLevel: mode === 'pve' ? botLevel : undefined,
        playerColor: mode === 'pve' ? playerColor : undefined,
      }

      saveConfig(mode, { boardSizeInput, timerInput, timerEnabled, botLevel, playerColor })

      const guestId = isGuest ? user?.id : undefined
      const game = await gameService.createGame(config, effectiveToken, guestId)
      navigate(`/games/y/play/${game.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game')
    } finally {
      setIsLoading(false)
    }
  }, [mode, user, effectiveToken, isGuest, boardSizeInput, timerEnabled, timerInput, botLevel, playerColor, navigate])

  return {
    mode: mode as GameMode,
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
    boardMin: BOARD_MIN,
    boardMax: BOARD_MAX,
    timerMin: TIMER_MIN,
    timerMax: TIMER_MAX,
  }
}
