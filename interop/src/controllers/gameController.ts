// ──────────────────────────────────────────────────────────────────────────────
// controllers/gameController.ts
//
// Thin HTTP handler for GET /play.
//
//   1. Reads `position` (required) and `bot_id` / `strategy` (optional) from
//      query parameters.  `position` must be a JSON-encoded YEN object.
//   2. Calls gameService.play().
//   3. Returns 200 with the bot's move ({coords} or {action}), or a structured
//      error.
//
// No request body — the endpoint uses GET with query parameters.
// ──────────────────────────────────────────────────────────────────────────────

import type { Request, Response } from 'express';
import type { ApiError } from '../models/game';
import { play } from '../services/gameService';
import { isValidYEN } from '../services/yenService';

// ── GET /play ─────────────────────────────────────────────────────────────────

/**
 * Receive a board position in YEN notation (JSON query param) and return the
 * bot's next move.
 *
 * Query params:
 *   position  (required) — JSON-encoded YEN object
 *   bot_id    (optional) — defaults to "random_bot"
 *   strategy  (optional) — e.g. "EASY" | "MEDIUM" | "HARD"
 *
 * Response 200: { coords: {x,y,z} }  or  { action: "swap" | "resign" | … }
 * Response 400: INVALID_POSITION — position is missing, not JSON, or malformed
 * Response 404: BOT_NOT_FOUND    — bot_id is not registered in the engine
 * Response 422: NO_MOVES_AVAILABLE
 * Response 502: ENGINE_ERROR
 * Response 503: ENGINE_TIMEOUT
 */
export const playMove = async (req: Request, res: Response): Promise<void> => {
  const positionRaw = req.query.position as string | undefined;
  const bot_id      = req.query.bot_id   as string | undefined;
  const strategy    = req.query.strategy as string | undefined;

  // ── Validate the required `position` query param ──────────────────────────
  if (!positionRaw) {
    const error: ApiError = {
      code: 'INVALID_POSITION',
      message: 'Query parameter "position" is required and must be a JSON-encoded YEN object.',
    };
    res.status(400).json(error);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(positionRaw);
  } catch {
    const error: ApiError = {
      code: 'INVALID_POSITION',
      message: 'Query parameter "position" is not valid JSON.',
    };
    res.status(400).json(error);
    return;
  }

  if (!isValidYEN(parsed)) {
    const error: ApiError = {
      code: 'INVALID_POSITION',
      message: 'The "position" parameter is not a valid YEN object. '
        + 'Expected { size: number, turn: number, players: string[], layout: string }.',
    };
    res.status(400).json(error);
    return;
  }

  try {
    const result = await play(parsed, bot_id, strategy);
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
