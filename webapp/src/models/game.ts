// ──────────────────────────────────────────────────────────────────────────────
// models/game.ts
//
// Single source of truth for every type shared between the controller,
// service, store and the external Rust engine.  Each type maps 1-to-1 to a
// schema in webapp/openapi.yaml so that callers never have to guess field names.
// ──────────────────────────────────────────────────────────────────────────────

// ── YEN (Y Exchange Notation) ─────────────────────────────────────────────────
// This is the exact JSON body the Rust engine expects on
//   POST /v1/ybot/choose/:botId
// and what we store as the canonical board representation.
// Field names match gamey/src/notation/yen.rs exactly.
export interface YEN {
  size: number;       // board edge length (e.g. 4)
  turn: number;       // 0 = player B, 1 = player R
  players: string[];  // always ["B","R"] for the classic game
  layout: string;     // "B/.B/RBB/B..R"  — rows separated by '/', '.' = empty
}

// ── Barycentric coordinates returned by the Rust engine ───────────────────────
// Mirrors gamey/src/core/coord.rs  Coordinates { x, y, z }
export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

// ── Rust engine response ───────────────────────────────────────────────────────
// Mirrors gamey/src/bot_server/choose.rs  MoveResponse
export interface RustMoveResponse {
  api_version: string;
  bot_id: string;
  coords: Coordinates;
}

// ── Player descriptors (polymorphic, discriminated by `type`) ─────────────────
export interface HumanPlayer {
  type: 'HUMAN';
  id: number;           // users-service user id
}

export interface BotPlayer {
  type: 'BOT';
  strategy: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  // The strategy maps to a bot_id in the Rust registry:
  //   EASY / MEDIUM → "random_bot"
  //   HARD / EXPERT → "minimax_bot"
}

export type PlayerInfo = HumanPlayer | BotPlayer;

// ── Timer map: token char → remaining milliseconds ───────────────────────────
export type Timers = Record<string, number>;

// ── Canonical game-status enum ────────────────────────────────────────────────
export type GameStatus = 'ONGOING' | 'PLAYER_B_WINS' | 'PLAYER_R_WINS';

// ── Full game state (lives in memory; persisted to DB when finished) ──────────
// Matches the GameState schema in webapp/openapi.yaml
export interface GameState {
  gameId: number;
  yen: YEN;                                  // current board (YEN object, not string)
  players: Record<string, PlayerInfo>;       // { "B": HumanPlayer, "R": BotPlayer }
  timers: Timers;                            // { "B": 600000, "R": 600000 }
  turn: string | null;                       // "B" | "R" | null (game over)
  status: GameStatus;
}

// ── Request / response DTOs ───────────────────────────────────────────────────

// Body of POST /games/:gameId/play
export interface PlayRequest {
  yen: string;   // proposed new layout string after the human places their piece
}

// Body returned by POST /games/:gameId/play (200 or 202)
export interface PlayResult {
  fastMove: string | null;   // "x,y,z" coordinate string if bot replied in <2 s
  yen: string;               // new layout string
  timers: Timers;
  nextTurn: string | null;
  status: GameStatus;
}

// Structured error body — matches ErrorResponse schema in openapi.yaml
export interface ApiError {
  code: string;
  message: string;
  gameStatus: GameStatus | null;
}

// ── Helper to build the layout string sent back to clients ───────────────────
// The OpenAPI spec returns `yen` as a plain string in PlayResult / GameState
// responses, so we expose a small utility here.
export function yenToString(yen: YEN): string {
  return yen.layout;
}