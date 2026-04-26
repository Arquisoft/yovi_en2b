import type { BoardSize, PieDecision, PlayerColor } from '../types/game'

// ── Online game config (sent by client when joining queue) ────────────────────

export interface OnlineGameConfig {
  boardSize: BoardSize
  timerEnabled: boolean
  timerSeconds?: number
  pieRule?: boolean
  playerColor?: 'player1' | 'player2'
}

// ── Messages CLIENT → SERVER ──────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'join_queue'; config?: OnlineGameConfig }
  | { type: 'leave_queue' }
  | { type: 'create_room'; config?: OnlineGameConfig }
  | { type: 'join_room'; code: string }
  | { type: 'join_game'; gameId: string }
  | { type: 'leave_game'; gameId: string }
  | { type: 'move'; gameId: string; row: number; col: number }
  | { type: 'pie_decision'; gameId: string; decision: PieDecision }
  | { type: 'surrender'; gameId: string }
  | { type: 'ping' }

// ── Messages SERVER → CLIENT ──────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'authenticated'; userId: number; username: string }
  | { type: 'queue_joined'; queueSize: number }
  | { type: 'queue_left' }
  | { type: 'room_created'; code: string }
  | { type: 'matched'; gameId: string; opponentName: string; playerColor: PlayerColor; opponentId: number }
  | { type: 'game_update'; game: unknown }
  | { type: 'opponent_disconnected'; gracePeriodMs: number }
  | { type: 'opponent_reconnected' }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong' }

// ── Internal client record ────────────────────────────────────────────────────

export interface ConnectedClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any
  userId: number
  username: string
  /** Raw JWT stored so the server can call the users-service on this player's behalf */
  token: string
  currentGameId?: string
  inQueue: boolean
  /** Set when the socket drops; cleared on reconnect within the grace period */
  disconnectedAt?: number
}

// ── Matchmaking queue entry (pure data, no WS dependency) ────────────────────

export interface QueueEntry {
  userId: number
  username: string
  token: string
  joinedAt: number
  config?: OnlineGameConfig
}