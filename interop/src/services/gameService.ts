// ──────────────────────────────────────────────────────────────────────────────
// services/gameService.ts
//
// Stateless play service.  The single exported function receives a board
// position in YEN notation, forwards it to the selected Rust bot, and returns
// the bot's chosen move together with the updated board layout.
//
// The service maps directly onto the project-specification
// contract:
//
//   "a 'play' method will be exposed, requiring at least one 'position'
//    parameter indicating the board state in YEN notation and another optional
//    parameter called 'bot_id' which indicates the bot identifier to play with.
//    The method will return the next move using YEN notation."
//
// Rust engine endpoint (unchanged):
//   POST /{api_version}/ybot/choose/{bot_id}
//   Body: YEN JSON object
//   Response: { api_version, bot_id, coords: { x, y, z } }
// ──────────────────────────────────────────────────────────────────────────────

import axios, { AxiosError } from 'axios';
import type { YEN, RustMoveResponse, PlayResponse } from '../models/game';
import { applyMove } from './yenService';

// ── Configuration ─────────────────────────────────────────────────────────────

const RUST_URL = process.env.RUST_ENGINE_URL ?? 'http://localhost:4000';
const RUST_API_VERSION = 'v1';
const RUST_TIMEOUT_MS = 2_000;

const DEFAULT_BOT_ID = 'random_bot';

// Optional strategy → bot_id mapping for callers that pass a strategy name
// instead of a raw bot_id.  Additional difficulty levels can be added here.
const STRATEGY_TO_BOT: Record<string, string> = {
  EASY: 'random_bot',
  MEDIUM: 'fast_bot',
  HARD: 'smart_bot',
};

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
 * @returns PlayResponse containing the move coords, updated layout, and the
 *          bot that was used.
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

  const botCoords = rustResponse.coords;
  const botToken = position.players[position.turn]; // current player's token

  // Apply the bot's move to produce the updated layout string
  const updatedLayout = applyMove(
    position.layout,
    botCoords,
    botToken,
    position.size
  );

  return {
    move: `${botCoords.x},${botCoords.y},${botCoords.z}`,
    position: updatedLayout,
    bot_id: resolvedBotId,
  };
};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the effective bot ID from the caller-supplied options.
 * Priority: explicit bot_id > strategy mapping > default.
 */
function resolveBotId(botId?: string, strategy?: string): string {
  if (botId) return botId;
  if (strategy && STRATEGY_TO_BOT[strategy.toUpperCase()]) {
    return STRATEGY_TO_BOT[strategy.toUpperCase()];
  }
  return DEFAULT_BOT_ID;
}

/**
 * Forward a YEN position to the Rust engine and return its move response.
 * Maps Rust/network failures to structured errors the controller can handle.
 */
async function callRustEngine(yen: YEN, botId: string): Promise<RustMoveResponse> {
  try {
    const response = await axios.post<RustMoveResponse>(
      `${RUST_URL}/${RUST_API_VERSION}/ybot/choose/${botId}`,
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
        throw makeError('BOT_NOT_FOUND', `Bot '${botId}' is not registered in the engine.`, 404);
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