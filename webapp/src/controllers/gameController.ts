// ──────────────────────────────────────────────────────────────────────────────
// controllers/gameController.ts
//
// Thin HTTP handlers.  Each function:
//   1. Reads params / body (no business logic here).
//   2. Calls the matching gameService function.
//   3. Sends the response with the correct status code and JSON body.
//   4. Forwards structured service errors to the client via handleError().
//
// The controller never imports gameStore directly — that is the service's job.
// ──────────────────────────────────────────────────────────────────────────────

import type { Response } from 'express';
import type { AuthRequest } from '../types/request';
import type { ApiError, GameState, PlayResult } from '../models/game';
import * as gameService from '../services/gameService';

// ── GET /games/:gameId ────────────────────────────────────────────────────────

/**
 * Return the current game state.
 *
 * The caller must be authenticated (JWT via authMiddleware) but does not need
 * to be a participant — spectator access is permitted per the OpenAPI spec
 * (the spec only restricts private games, not listed here in M1).
 *
 * Response 200: GameState JSON
 * Response 404: game not found
 */
export const getGameState = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gameId = parseGameId(req.params.gameId, res);
    if (gameId === null) return;

    const game: GameState = gameService.getGameState(gameId);
    res.status(200).json(serializeGameState(game));
  } catch (err: any) {
    handleError(err, res);
  }
};

// ── POST /games/:gameId/play ──────────────────────────────────────────────────

/**
 * Execute the authenticated user's move.
 *
 * Body: { yen: string }  — the proposed layout string after the human's piece
 *
 * Response 200: PlayResult  (bot replied within 2 s)
 * Response 202: PlayResult  (bot still thinking, async reply pending)
 * Response 400: ILLEGAL_MOVE
 * Response 403: NOT_YOUR_TURN | NOT_PLAYING
 * Response 409: GAME_ALREADY_FINISHED
 */
export const playMove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gameId = parseGameId(req.params.gameId, res);
    if (gameId === null) return;

    const { yen } = req.body as { yen?: string };
    if (!yen || typeof yen !== 'string') {
      const error: ApiError = {
        code: 'ILLEGAL_MOVE',
        message: 'Request body must contain a "yen" string field with the proposed board layout.',
        gameStatus: null,
      };
      res.status(400).json(error);
      return;
    }

    const callerUserId = req.user!.id;
    const { result, httpStatus } = await gameService.playMove(gameId, yen, callerUserId);

    res.status(httpStatus).json(result satisfies PlayResult);
  } catch (err: any) {
    // Validation errors from yenService surface as plain Errors with no httpStatus
    if (!err.httpStatus && err.message) {
      const error: ApiError = {
        code: 'ILLEGAL_MOVE',
        message: err.message,
        gameStatus: null,
      };
      res.status(400).json(error);
      return;
    }
    handleError(err, res);
  }
};

// ── POST /games/:gameId/surrender ─────────────────────────────────────────────

/**
 * Forfeit the game on behalf of the authenticated user.
 *
 * Response 200: final GameState (turn = null, status = PLAYER_X_WINS)
 * Response 403: NOT_YOUR_TURN | NOT_PLAYING
 * Response 409: GAME_ALREADY_FINISHED
 */
export const surrenderGame = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gameId = parseGameId(req.params.gameId, res);
    if (gameId === null) return;

    const callerUserId = req.user!.id;
    const finalState: GameState = await gameService.surrender(gameId, callerUserId);

    res.status(200).json(serializeGameState(finalState));
  } catch (err: any) {
    handleError(err, res);
  }
};

// ── Serialisation helper ──────────────────────────────────────────────────────

/**
 * Convert an internal GameState (which holds a YEN object) to the wire format
 * expected by the OpenAPI spec (which has `yen` as a plain layout string).
 */
function serializeGameState(game: GameState) {
  return {
    gameId: game.gameId,
    yen: game.yen.layout,          // OpenAPI spec exposes yen as a string
    players: game.players,
    timers: game.timers,
    turn: game.turn,
    status: game.status,
  };
}

// ── Shared utilities ─────────────────────────────────────────────────────────

/**
 * Parse `:gameId` from the URL as a positive integer.
 * Writes a 400 response and returns null on failure.
 */
function parseGameId(raw: string, res: Response): number | null {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'gameId must be a positive integer', gameStatus: null });
    return null;
  }
  return id;
}

/**
 * Map a structured service error (produced by makeError() in gameService.ts)
 * to the ApiError response body defined in the OpenAPI spec.
 */
function handleError(err: any, res: Response): void {
  const httpStatus: number = err.httpStatus ?? 500;
  const body: ApiError = {
    code: err.code ?? 'INTERNAL_ERROR',
    message: err.message ?? 'An unexpected error occurred',
    gameStatus: err.gameStatus ?? null,
  };
  res.status(httpStatus).json(body);
}