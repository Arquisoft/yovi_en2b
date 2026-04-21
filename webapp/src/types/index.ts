// webapp/src/types/index.ts
// ==================== User & Auth ====================

export interface User {
  id: string
  username: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface AuthSession {
  user: User
  token: string
  expiresAt: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  username: string
  email: string
  password: string
  passwordConfirm: string
}

// ==================== Game Configuration ====================

export type GameMode = 'pvp-local' | 'pvp-online' | 'pve'

export type BotLevel = 'easy' | 'medium' | 'hard'

export type BoardSize = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16

export type PlayerColor = 'player1' | 'player2'

export interface GameConfig {
  mode: GameMode
  boardSize: BoardSize
  timerEnabled: boolean
  timerSeconds?: number
  botLevel?: BotLevel
  playerColor?: PlayerColor
  pieRule?: boolean
}

// ==================== Game State ====================

export type GameStatus = 'waiting' | 'playing' | 'finished' | 'abandoned'
export type GamePhase = 'playing' | 'pie-decision'
export type PieDecision = 'keep' | 'swap'

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

// ==================== Chat ====================

export interface ChatMessage {
  id: string
  gameId: string
  senderId: string
  senderName: string
  content: string
  timestamp: string
}

// ==================== Real-time Events ====================

export type RealtimeEventType =
  | 'gameUpdated'
  | 'chatMessageReceived'
  | 'opponentDisconnected'
  | 'timerSync'
  | 'gameEnded'

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType
  payload: T
  timestamp: number
}

export interface GameUpdatedPayload {
  game: GameState
}

export interface ChatMessageReceivedPayload {
  message: ChatMessage
}

export interface OpponentDisconnectedPayload {
  playerId: string
  playerName: string
}

export interface TimerSyncPayload {
  timer: TimerState
}

export interface GameEndedPayload {
  gameId: string
  winner: PlayerColor | null
  reason: 'connection' | 'surrender' | 'timeout' | 'victory'
}

// ==================== API Responses ====================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ==================== Available Games ====================

export interface GameInfo {
  id: string
  name: string
  description: string
  thumbnail: string
  minPlayers: number
  maxPlayers: number
  isAvailable: boolean
}

// ==================== Stats ====================

export interface MatchRecord {
  id: string
  opponentName: string
  result: 'win' | 'loss'
  durationSeconds: number
  playedAt: string
  /** Optional: game mode slug, e.g. 'pve-easy', 'pve-medium', 'pve-hard', 'pvp-local' */
  gameMode?: string | null
}

export interface WinrateStat {
  wins: number
  losses: number
}

export interface StatsData {
  overall: WinrateStat
  recent: WinrateStat
}

// ==================== Stats Filtering ====================

export type MatchSortField = 'date' | 'duration' | 'result' | 'opponent' | 'gameMode'
export type SortDirection = 'asc' | 'desc'

export interface MatchHistoryFilter {
  result?: 'win' | 'loss' | 'all'
  gameMode?: string
  sortField: MatchSortField
  sortDirection: SortDirection
}

// ==================== Ranking ====================

export type RankingMode = 'pve-easy' | 'pve-medium' | 'pve-hard'

export interface RankingEntry {
  rank: number
  username: string
  wins: number
}