// ──────────────────────────────────────────────────────────────────────────────
// models/game.ts
//
// Types for the stateless play API.  The API receives a board position and
// returns the bot's next move — there is no session, no game store, and no
// timer state.  Types that belonged to the old stateful design (GameState,
// PlayResult, Timers, PlayerInfo, GameStatus) have been removed.
// ──────────────────────────────────────────────────────────────────────────────

// ── YEN (Y Exchange Notation) ─────────────────────────────────────────────────
// The full board representation sent to and stored by the Rust engine.
// Field names match gamey/src/notation/yen.rs exactly.
export interface YEN {
  size: number;       // board edge length (e.g. 4)
  turn: number;       // 0 = player B, 1 = player R
  players: string[];  // always ["B","R"] for the classic game
  layout: string;     // "B/.B/RBB/B..R" — rows separated by '/', '.' = empty
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
// May return either a coordinate move or a special action (e.g. swap).
export interface RustMoveResponse {
  api_version: string;
  bot_id: string;
  coords?: Coordinates;
  action?: string;
}

// ── Response for GET /play ────────────────────────────────────────────────────
// Either a normal move expressed as barycentric coordinates, or a special
// action such as "swap" (pie rule) or "resign".
export type PlayResponse =
  | { coords: Coordinates }
  | { action: string };

// ── Structured error body ─────────────────────────────────────────────────────
// Matches ErrorResponse schema in openapi.yaml
export interface ApiError {
  code: string;
  message: string;
}