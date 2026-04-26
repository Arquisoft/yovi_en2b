import type { BoardSize, OnlineGameConfig } from '@/types'

export const DEFAULT_ONLINE_CONFIG: OnlineGameConfig = {
  boardSize: 11 as BoardSize,
  timerEnabled: true,
  timerSeconds: 600,
}

export function loadOnlineConfig(): OnlineGameConfig {
  try {
    const raw = sessionStorage.getItem('yovi_config_pvp-online')
    if (!raw) return DEFAULT_ONLINE_CONFIG
    const saved = JSON.parse(raw) as {
      boardSizeInput?: string
      timerInput?: string
      timerEnabled?: boolean
      pieRule?: boolean
      playerColor?: 'player1' | 'player2'
    }
    const boardSize = parseInt(saved.boardSizeInput ?? '', 10)
    const timerMinutes = parseInt(saved.timerInput ?? '', 10)
    const validBoardSize = boardSize >= 4 && boardSize <= 16 ? boardSize : 11
    const validTimerMs = timerMinutes >= 1 && timerMinutes <= 20 ? timerMinutes * 60 : 600
    const timerEnabled = saved.timerEnabled ?? true
    return {
      boardSize: validBoardSize as BoardSize,
      timerEnabled,
      timerSeconds: timerEnabled ? validTimerMs : undefined,
      pieRule: saved.pieRule ?? false,
      playerColor: saved.playerColor ?? 'player1',
    }
  } catch {
    return DEFAULT_ONLINE_CONFIG
  }
}
