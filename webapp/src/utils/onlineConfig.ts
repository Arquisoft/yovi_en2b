import type { BoardSize, GameVariant, OnlineGameConfig } from '@/types'

export const DEFAULT_ONLINE_CONFIG: OnlineGameConfig = {
  boardSize: 11 as BoardSize,
  timerEnabled: true,
  timerSeconds: 600,
}

/**
 * Loads the saved online configuration for a specific game variant from
 * sessionStorage.  The storage key matches the one written by
 * `useGameConfigController` (`yovi_config_${variant}_pvp-online`), so each
 * variant remembers its own online settings independently.
 */
export function loadOnlineConfig(variant: GameVariant = 'y'): OnlineGameConfig {
  try {
    const raw = sessionStorage.getItem(`yovi_config_${variant}_pvp-online`)
    if (!raw) return { ...DEFAULT_ONLINE_CONFIG, variant }
    const saved = JSON.parse(raw) as {
      boardSizeInput?: string
      timerInput?: string
      timerEnabled?: boolean
      pieRule?: boolean
      playerColor?: 'player1' | 'player2'
    }
    const boardSize = Number.parseInt(saved.boardSizeInput ?? '', 10)
    const timerMinutes = Number.parseInt(saved.timerInput ?? '', 10)
    const validBoardSize = boardSize >= 4 && boardSize <= 16 ? boardSize : 11
    const validTimerMs = timerMinutes >= 1 && timerMinutes <= 20 ? timerMinutes * 60 : 600
    const timerEnabled = saved.timerEnabled ?? true
    return {
      variant,
      boardSize: validBoardSize as BoardSize,
      timerEnabled,
      timerSeconds: timerEnabled ? validTimerMs : undefined,
      pieRule: saved.pieRule ?? false,
      playerColor: saved.playerColor ?? 'player1',
    }
  } catch {
    return { ...DEFAULT_ONLINE_CONFIG, variant }
  }
}
