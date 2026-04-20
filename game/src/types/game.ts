// ==================== Game Types ====================

export type GameMode = 'pvp-local' | 'pvp-online' | 'pve'
export type BotLevel = 'easy' | 'medium' | 'hard'
export type BoardSize = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16
export type PlayerColor = 'player1' | 'player2'
export type GameStatus = 'waiting' | 'playing' | 'finished' | 'abandoned'
// Sub-phase within a 'playing' game. 'pie-decision' is entered after the first
// move when Pie Rule is enabled, and exits once player2 chooses keep or swap.
export type GamePhase = 'playing' | 'pie-decision'
export type PieDecision = 'keep' | 'swap'

export interface GameConfig {
  mode: GameMode
  boardSize: BoardSize
  timerEnabled: boolean
  timerSeconds?: number
  botLevel?: BotLevel
  playerColor?: PlayerColor
  pieRule?: boolean
}

export interface Player {
  id: string
  name: string
  color: PlayerColor
  isLocal?: boolean
  isBot?: boolean
}

export interface BoardCell {
  row: number
  col: number
  owner: PlayerColor | null
}

export interface Move {
  row: number
  col: number
  player: PlayerColor
  timestamp: number
}

export interface TimerState {
  player1RemainingMs: number
  player2RemainingMs: number
  activePlayer: PlayerColor | null
  lastSyncTimestamp: number
}

export interface GameState {
  id: string
  config: GameConfig
  status: GameStatus
  phase: GamePhase
  board: BoardCell[][]
  players: {
    player1: Player
    player2: Player
  }
  currentTurn: PlayerColor
  moves: Move[]
  winner: PlayerColor | null
  timer: TimerState | null
  createdAt: string
  updatedAt: string
}

export interface GameSummary {
  id: string
  config: GameConfig
  status: GameStatus
  phase: GamePhase
  players: {
    player1: Player
    player2: Player
  }
  winner: PlayerColor | null
  moveCount: number
  createdAt: string
  updatedAt: string
}
