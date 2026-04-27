import type { BoardSize, GameVariant, PieDecision, PlayerColor } from '../types/game'

// ── Online game config (sent by client when joining queue) ────────────────────

/**
 * Subset of game configuration that the client sends when entering the online
 * queue or creating a room. The server decides the rest (mode = 'pvp-online'),
 * applies safe defaults for omitted fields, and validates the requested
 * `variant` against the rules registry when the game is created.
 *
 * `variant` is optional purely for backwards compatibility with old clients;
 * unset is treated as `'y'`.
 */
export interface OnlineGameConfig {
  variant?: GameVariant
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
  | { type: 'chat_message'; gameId: string; content: string }
  | { type: 'ping' }

// ── Messages SERVER → CLIENT ──────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'authenticated'; userId: number; username: string }
  | { type: 'queue_joined'; queueSize: number; variant: GameVariant }
  | { type: 'queue_left' }
  | { type: 'room_created'; code: string }
  | { type: 'matched'; gameId: string; opponentName: string; playerColor: PlayerColor; opponentId: number }
  | { type: 'game_update'; game: unknown }
  | { type: 'opponent_disconnected'; gracePeriodMs: number }
  | { type: 'opponent_reconnected' }
  | { type: 'chat_message'; gameId: string; senderId: string; senderName: string; content: string; timestamp: string }
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

/** Default variant when a client omits the field (legacy clients). */
export const DEFAULT_VARIANT: GameVariant = 'y'
