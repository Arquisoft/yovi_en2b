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
export interface RustMoveResponse {
  api_version: string;
  bot_id: string;
  coords: Coordinates;
}

// ── Request body for POST /games/play ────────────────────────────────────────
// `position` is required — the board state in YEN notation (JSON object).
// `bot_id` is optional — selects which registered Rust bot to use.
//   When omitted the default bot is used ("random_bot").
// `strategy` is optional — additional hint forwarded to bots that support
//   difficulty levels (e.g. "EASY" | "MEDIUM" | "HARD" | "EXPERT").
//   Ignored by bots that do not recognise it.
export interface PlayRequest {
  position: YEN;
  bot_id?: string;
  strategy?: string;
}

// ── Response body for POST /games/play ───────────────────────────────────────
// Returns the bot's chosen move expressed in YEN notation as required by the
// project specification ("the method will return the next move using YEN
// notation").  The `move` field contains the coordinate string "x,y,z" and
// `position` is the full updated board layout after the bot places its piece.
export interface PlayResponse {
  move: string;       // "x,y,z" coordinate string of the bot's chosen cell
  position: string;   // updated YEN layout string after the bot's move
  bot_id: string;     // which bot was used
}

// ── Structured error body ─────────────────────────────────────────────────────
// Matches ErrorResponse schema in openapi.yaml
export interface ApiError {
  code: string;
  message: string;
}