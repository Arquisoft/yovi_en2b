// ──────────────────────────────────────────────────────────────────────────────
// controllers/gameController.ts
//
// Thin HTTP handler for POST /games/play.
//
//   1. Validates the request body (position required, bot_id / strategy optional).
//   2. Calls gameService.play().
//   3. Returns 200 with the bot's move, or a structured error.
//
// No gameId param, no callerUserId extraction, no 202 handling — the endpoint
// is stateless.
// ──────────────────────────────────────────────────────────────────────────────

import type { Response } from 'express';
import type { AuthRequest } from '../types/request';
import type { ApiError, PlayRequest } from '../models/game';
import { play } from '../services/gameService';
import { isValidYEN } from '../services/yenService';

// ── POST /games/play ──────────────────────────────────────────────────────────

/**
 * Receive a board position in YEN notation and return the bot's next move.
 *
 * Body: {
 *   position: YEN      — required, the current board state
 *   bot_id?: string    — optional, defaults to "random_bot"
 *   strategy?: string  — optional, e.g. "EASY" | "HARD"
 * }
 *
 * Response 200: PlayResponse  { move, position, bot_id }
 * Response 400: INVALID_POSITION — position is missing or malformed
 * Response 404: BOT_NOT_FOUND    — bot_id is not registered in the engine
 * Response 422: NO_MOVES_AVAILABLE
 * Response 502: ENGINE_ERROR
 * Response 503: ENGINE_TIMEOUT
 */
export const playMove = async (req: AuthRequest, res: Response): Promise<void> => {
  const { position, bot_id, strategy } = req.body as Partial<PlayRequest>;

  // ── Validate the required `position` field ────────────────────────────────
  if (!position) {
    const error: ApiError = {
      code: 'INVALID_POSITION',
      message: 'Request body must contain a "position" field with the board state in YEN notation.',
    };
    res.status(400).json(error);
    return;
  }

  if (!isValidYEN(position)) {
    const error: ApiError = {
      code: 'INVALID_POSITION',
      message: 'The "position" field is not a valid YEN object. '
        + 'Expected { size: number, turn: number, players: string[], layout: string }.',
    };
    res.status(400).json(error);
    return;
  }

  try {
    const result = await play(position, bot_id, strategy);
    res.status(200).json(result);
  } catch (err: any) {
    const httpStatus: number = err.httpStatus ?? 500;
    const body: ApiError = {
      code: err.code ?? 'INTERNAL_ERROR',
      message: err.message ?? 'An unexpected error occurred.',
    };
    res.status(httpStatus).json(body);
  }
};