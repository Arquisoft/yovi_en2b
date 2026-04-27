// ──────────────────────────────────────────────────────────────────────────────
// services/gameService.ts
//
// Stateless play service.  The single exported function receives a board
// position in YEN notation, forwards it to the selected Rust bot, and returns
// the bot's chosen move as either barycentric coordinates or a special action
// (swap, resign, etc.).
//
// Rust engine endpoint (unchanged):
//   POST /{api_version}/ybot/choose/{bot_id}
//   Body: YEN JSON object
//   Response: { api_version, bot_id, coords?: { x, y, z }, action?: string }
// ──────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import type { YEN, RustMoveResponse, PlayResponse } from '../models/game';

// ── Configuration ─────────────────────────────────────────────────────────────

const RUST_URL = process.env.RUST_INTERNAL_URL ?? 'http://localhost:4000';
const RUST_TIMEOUT_MS = parseInt(process.env.RUST_TIMEOUT_MS ?? '3500', 10);

type BotId = 'random_bot' | 'fast_bot' | 'smart_bot';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ask the selected Rust bot for its next move given a board position.
 *
 * @param position  The current board state in YEN format (already validated
 *                  by the controller).
 * @param botId     Optional bot identifier.  When omitted, `strategy` is
 *                  checked next; if that is also absent the default bot is used.
 * @param strategy  Optional strategy / difficulty hint.  Only consulted when
 *                  `botId` is not provided.
 *
 * @returns PlayResponse — either { coords: {x,y,z} } for a normal move or
 *          { action: string } for a special action such as "swap" or "resign".
 *
 * @throws  Structured errors with `code` and `httpStatus`:
 *            BOT_NOT_FOUND (404)       — bot_id is not registered in Rust
 *            NO_MOVES_AVAILABLE (422)  — board is full / no legal moves
 *            ENGINE_TIMEOUT (503)      — Rust did not respond in time
 *            ENGINE_ERROR (502)        — unexpected error from the Rust engine
 */
export const play = async (
  position: YEN,
  botId?: string,
  strategy?: string
): Promise<PlayResponse> => {
  const resolvedBotId = resolveBotId(botId, strategy);
  const rustResponse = await callRustEngine(position, resolvedBotId);

  if (rustResponse.action) {
    return { action: rustResponse.action };
  }

  if (!rustResponse.coords) {
    throw makeError('ENGINE_ERROR', 'The bot engine returned a response with neither coords nor action.', 502);
  }

  return { coords: rustResponse.coords };
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Map user-supplied identifiers to a known bot ID.
 * Returns a safe string literal — never the raw user-supplied value.
 */
function resolveBotId(botId?: string, strategy?: string): BotId {
  switch (botId ?? strategy?.toUpperCase()) {
    case 'random_bot': case 'EASY':   return 'random_bot';
    case 'fast_bot':   case 'MEDIUM': return 'fast_bot';
    case 'smart_bot':  case 'HARD':   return 'smart_bot';
    default:
      if (botId) throw makeError('BOT_NOT_FOUND', `Bot '${botId}' is not registered in the engine.`, 404);
      return 'random_bot';
  }
}

/**
 * Forward a YEN position to the Rust engine and return its move response.
 *
 * The guard clause validates `botId` against string literals immediately before
 * URL construction — this acts as a Sonar-recognised sanitiser that proves no
 * user-controlled data can reach the URL path.
 */
async function callRustEngine(yen: YEN, botId: BotId): Promise<RustMoveResponse> {
  try {
    const response = await axios.post<RustMoveResponse>(
      `${RUST_URL}/v1/ybot/choose/${botId}`,
      yen,
      {
        timeout: RUST_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return response.data;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosError;

      if (axiosErr.code === 'ECONNABORTED') {
        throw makeError('ENGINE_TIMEOUT', 'The bot engine did not respond in time.', 503);
      }

      if (axiosErr.response?.status === 404) {
        throw makeError('BOT_NOT_FOUND', 'The requested bot is not registered in the engine.', 404);
      }

      const body = axiosErr.response?.data as any;
      if (body?.message?.toLowerCase().includes('no valid moves')) {
        throw makeError('NO_MOVES_AVAILABLE', 'No legal moves are available for the given position.', 422);
      }
    }

    throw makeError('ENGINE_ERROR', `Unexpected error from the bot engine: ${err?.message ?? err}`, 502);
  }
}

// ── Error factory ─────────────────────────────────────────────────────────────

function makeError(
  code: string,
  message: string,
  httpStatus: number
): Error & { code: string; httpStatus: number } {
  const err = new Error(message) as any;
  err.code = code;
  err.httpStatus = httpStatus;
  return err;
}
