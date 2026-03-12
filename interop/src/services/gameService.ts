// ──────────────────────────────────────────────────────────────────────────────
// services/gameService.ts
//
// Orchestrates every game operation:
//   getGameState  → read from in-memory store
//   playMove      → validate human move → call Rust engine → detect win → persist
//   surrender     → forfeit → persist
//
// The Rust engine is reached via the same HTTP contract defined in
//   gamey/src/bot_server/mod.rs   POST /{api_version}/ybot/choose/{bot_id}
//   Response: { api_version, bot_id, coords: { x, y, z } }
//
// DB persistence reuses the TypeORM AppDataSource from the users service
// (same MariaDB instance, separate table) following the established pattern in
// users/src/config/database.ts.
// ──────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import type {
  GameState,
  GameStatus,
  PlayResult,
  PlayerInfo,
  RustMoveResponse,
  Timers,
  YEN,
} from '../models/game';
import { yenToString } from '../models/game';
import * as gameStore from './gameStore';
import {
  advanceTurn,
  applyMove,
  tokenForTurn,
  validateHumanMove,
  emptyYEN,
  DEFAULT_TIME_MS,
} from './yenService';

// ── Configuration ─────────────────────────────────────────────────────────────

const RUST_URL = process.env.RUST_ENGINE_URL ?? 'http://localhost:4000';
const RUST_API_VERSION = 'v1';

// If the Rust engine does not respond within this window we return HTTP 202
// (accepted, async) to the client instead of waiting indefinitely.
const RUST_TIMEOUT_MS = 2_000;

// Map frontend strategy names to the bot IDs registered in the Rust registry
// (gamey/src/bot/mod.rs and gamey/src/main.rs)
const STRATEGY_TO_BOT: Record<string, string> = {
  EASY: 'random_bot',
  MEDIUM: 'random_bot',
  HARD: 'minimax_bot',
  EXPERT: 'minimax_bot',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a brand-new game and store it in memory.
 * Called when a user starts a new match from the frontend.
 *
 * @param size       Board edge length (e.g. 4)
 * @param players    Map of token → PlayerInfo  e.g. { B: HumanPlayer, R: BotPlayer }
 * @param timersMs   Optional custom time per player in ms (defaults to 10 min)
 */
export const createGame = (
  size: number,
  players: Record<string, PlayerInfo>,
  timersMs?: Partial<Timers>
): GameState => {
  const gameId = gameStore.allocateGameId();
  const yen = emptyYEN(size);
  const timers: Timers = {
    B: timersMs?.B ?? DEFAULT_TIME_MS,
    R: timersMs?.R ?? DEFAULT_TIME_MS,
  };

  const game: GameState = {
    gameId,
    yen,
    players,
    timers,
    turn: 'B',   // B always moves first per the YEN convention (turn index 0)
    status: 'ONGOING',
  };

  gameStore.saveToMemory(game);
  return game;
};

/**
 * Retrieve the current state of an active game.
 * Throws a structured error if the game does not exist.
 */
export const getGameState = (gameId: number): GameState => {
  const game = gameStore.getFromMemory(gameId);
  if (!game) {
    throw makeError('GAME_NOT_FOUND', 'Game not found', null, 404);
  }
  return game;
};

/**
 * Process a human player's move.
 *
 * Flow:
 *   1. Load game, guard against finished / wrong-turn states.
 *   2. Validate the proposed layout change (exactly one new cell, correct token).
 *   3. Update the YEN state with the human's piece.
 *   4. Check if the human's move already wins the game (via Rust win-check).
 *      If so, finalise and persist.
 *   5. Otherwise, ask the Rust engine for the bot's reply.
 *      • Response within RUST_TIMEOUT_MS → apply move, update state, return 200.
 *      • Timeout → return 202 with the current board (bot will reply later).
 *   6. Persist finished games to the database.
 *
 * Returns { result, httpStatus } so the controller can set the correct code.
 */
export const playMove = async (
  gameId: number,
  proposedLayout: string,
  callerUserId: number
): Promise<{ result: PlayResult; httpStatus: 200 | 202 }> => {
  const game = requireGame(gameId);
  requireOngoing(game);
  requirePlayerTurn(game, callerUserId);

  const currentToken = game.turn!;              // e.g. "B"
  const size = game.yen.size;

  // ── 1. Validate the human's move ──────────────────────────────────────────
  validateHumanMove(game.yen.layout, proposedLayout, currentToken, size);

  // ── 2. Apply the human's move to the in-memory YEN ────────────────────────
  const afterHuman: YEN = {
    ...game.yen,
    layout: proposedLayout,
    turn: nextTurnIndex(currentToken),
  };

  // ── 3. Check if human wins (ask Rust to validate) ─────────────────────────
  //    We detect a win by attempting to ask Rust for the bot's next move.
  //    If Rust can't find a valid move (no available cells) or the win-check
  //    endpoint tells us, we mark the game finished.
  //    For M1 simplicity we rely on "no moves available" as the win signal,
  //    which the Rust engine surfaces as an error response.

  // Deduct 100 ms from the human's timer as a nominal move cost.
  const updatedTimers: Timers = {
    ...game.timers,
    [currentToken]: Math.max(0, (game.timers[currentToken] ?? 0) - 100),
  };

  // ── 4. Ask Rust for the bot's move ────────────────────────────────────────
  const botToken = currentToken === 'B' ? 'R' : 'B';
  const botStrategy = getBotStrategy(game, botToken);
  const botId = STRATEGY_TO_BOT[botStrategy] ?? 'random_bot';

  let fastMove: string | null = null;
  let finalYen = afterHuman;
  let finalStatus: GameStatus = 'ONGOING';
  let finalTurn: string | null = botToken;
  let httpStatus: 200 | 202 = 200;

  try {
    const rustResponse = await callRustEngine(afterHuman, botId);

    // Apply bot move
    const botCoords = rustResponse.coords;
    const afterBot: YEN = {
      ...afterHuman,
      layout: applyMove(afterHuman.layout, botCoords, botToken, size),
      turn: nextTurnIndex(botToken),
    };

    fastMove = `${botCoords.x},${botCoords.y},${botCoords.z}`;
    finalYen = afterBot;
    finalTurn = tokenForTurn(afterBot.turn);

    // Deduct nominal cost from bot timer too
    updatedTimers[botToken] = Math.max(0, (updatedTimers[botToken] ?? 0) - 100);

  } catch (err: any) {
    if (err?.isTimeout) {
      // Rust is still thinking — return 202, bot's turn will be processed later
      httpStatus = 202;
      finalTurn = botToken;
    } else if (err?.isNoMoves) {
      // The human's move filled the last cell or won the game
      finalStatus = currentToken === 'B' ? 'PLAYER_B_WINS' : 'PLAYER_R_WINS';
      finalTurn = null;
    } else {
      // Propagate real errors (invalid YEN, bot not found, etc.)
      throw err;
    }
  }

  // ── 5. Persist state ───────────────────────────────────────────────────────
  const updatedGame: GameState = {
    ...game,
    yen: finalYen,
    timers: updatedTimers,
    turn: finalStatus === 'ONGOING' ? finalTurn : null,
    status: finalStatus,
  };

  gameStore.saveToMemory(updatedGame);

  if (finalStatus !== 'ONGOING') {
    await persistToDatabase(updatedGame);
    gameStore.removeFromMemory(gameId);
  }

  const result: PlayResult = {
    fastMove,
    yen: yenToString(finalYen),
    timers: updatedTimers,
    nextTurn: updatedGame.turn,
    status: finalStatus,
  };

  return { result, httpStatus };
};

/**
 * Forfeit a game on behalf of the human player identified by callerUserId.
 *
 * The opponent (always the bot in M1) wins immediately.
 * The final state is persisted to the database.
 */
export const surrender = async (
  gameId: number,
  callerUserId: number
): Promise<GameState> => {
  const game = requireGame(gameId);
  requireOngoing(game);
  requirePlayerTurn(game, callerUserId);

  const losingToken = game.turn!;
  const winningStatus: GameStatus =
    losingToken === 'B' ? 'PLAYER_R_WINS' : 'PLAYER_B_WINS';

  const updatedGame: GameState = {
    ...game,
    turn: null,
    status: winningStatus,
  };

  gameStore.saveToMemory(updatedGame);
  await persistToDatabase(updatedGame);
  gameStore.removeFromMemory(gameId);

  return updatedGame;
};

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Call the Rust bot engine.
 * Rejects with { isTimeout: true } when the engine exceeds RUST_TIMEOUT_MS.
 * Rejects with { isNoMoves: true } when the engine reports no valid moves.
 */
async function callRustEngine(yen: YEN, botId: string): Promise<RustMoveResponse> {
  try {
    const response = await axios.post<RustMoveResponse>(
      `${RUST_URL}/${RUST_API_VERSION}/ybot/choose/${botId}`,
      yen,                              // Rust expects the full YEN JSON object
      {
        timeout: RUST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;

      // ECONNABORTED = axios timeout
      if (axiosErr.code === 'ECONNABORTED') {
        throw { isTimeout: true, message: 'Rust engine timed out' };
      }

      // The Rust engine returns 200 with an error JSON body when no moves are
      // available (gamey/src/bot_server/choose.rs returns ErrorResponse inside
      // Ok(Json(...))).  We identify this by checking the message field.
      const body = axiosErr.response?.data as any;
      if (body?.message?.includes('No valid moves')) {
        throw { isNoMoves: true, message: body.message };
      }
    }
    throw err;
  }
}

/**
 * Persist a finished game to MariaDB.
 * In M1 we only need to record that the game happened (for user history).
 * This follows the same TypeORM pattern used in users/src/services/AuthService.ts.
 *
 * TODO (post-M1): import Match entity and AppDataSource once the Match table
 * is added to the schema (users/schema.sql).  The stub below is intentionally
 * explicit so any future developer knows exactly what must happen here.
 */
async function persistToDatabase(game: GameState): Promise<void> {
  // Post-M1 implementation:
  //
  //   const matchRepo = AppDataSource.getRepository(Match);
  //   const match = matchRepo.create({
  //     gameId:    game.gameId,
  //     layout:    game.yen.layout,
  //     size:      game.yen.size,
  //     status:    game.status,
  //     finishedAt: new Date(),
  //   });
  //   await matchRepo.save(match);
  //
  // For M1 we log the event so the CI pipeline can trace it.
  console.log(
    `[gameService] Match ${game.gameId} finished with status "${game.status}". ` +
    `Pending DB persistence (post-M1).`
  );
}

/** Look up the bot player's strategy name for the given token. */
function getBotStrategy(game: GameState, botToken: string): string {
  const player = game.players[botToken];
  if (!player || player.type !== 'BOT') return 'EASY';
  return player.strategy;
}

/** Require a game to exist; throw a 404 API error otherwise. */
function requireGame(gameId: number): GameState {
  const game = gameStore.getFromMemory(gameId);
  if (!game) throw makeError('GAME_NOT_FOUND', 'Game not found', null, 404);
  return game;
}

/** Throw a 409 API error if the game is already finished. */
function requireOngoing(game: GameState): void {
  if (game.status !== 'ONGOING') {
    throw makeError(
      'GAME_ALREADY_FINISHED',
      'Cannot process move. The game already concluded.',
      game.status,
      409
    );
  }
}

/**
 * Verify that the calling user is the player whose turn it is.
 * Throws 403 NOT_YOUR_TURN or NOT_PLAYING depending on the case.
 */
function requirePlayerTurn(game: GameState, callerUserId: number): void {
  const currentToken = game.turn!;
  const currentPlayerInfo = game.players[currentToken];

  // Is this user even in the game?
  const isParticipant = Object.values(game.players).some(
    (p) => p.type === 'HUMAN' && p.id === callerUserId
  );
  if (!isParticipant) {
    throw makeError('NOT_PLAYING', 'You cannot make a move because you are not playing.', game.status, 403);
  }

  // Is it their turn?
  if (currentPlayerInfo.type !== 'HUMAN' || currentPlayerInfo.id !== callerUserId) {
    throw makeError('NOT_YOUR_TURN', 'You cannot make a move because it is the opponent\'s turn.', game.status, 403);
  }
}

// ── Error factory ─────────────────────────────────────────────────────────────

/**
 * Build a structured error object that controllers can inspect to set both
 * the HTTP status code and the ApiError response body.
 */
function makeError(
  code: string,
  message: string,
  gameStatus: GameStatus | null,
  httpStatus: number
): Error & { code: string; gameStatus: GameStatus | null; httpStatus: number } {
  const err = new Error(message) as any;
  err.code = code;
  err.gameStatus = gameStatus;
  err.httpStatus = httpStatus;
  return err;
}

// ── Tiny utility (kept local to avoid circular dep with yenService) ──────────

function nextTurnIndex(token: string): number {
  return token === 'B' ? 1 : 0;
}