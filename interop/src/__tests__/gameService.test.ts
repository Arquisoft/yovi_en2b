// ──────────────────────────────────────────────────────────────────────────────
// __tests__/gameService.test.ts
//
// Unit tests for services/gameService.ts  (stateless play service).
//
// The only external dependency is axios (the Rust engine HTTP call).
// There is no store, no database, no auth — just: position in, move out.
//
// Scope:
//   play() — happy path with explicit bot_id → returns { coords }
//           — happy path with strategy falling back to bot_id mapping
//           — happy path with neither bot_id nor strategy (default bot)
//           — happy path when engine returns { action } (e.g. swap)
//           — ENGINE_TIMEOUT (503) when axios times out
//           — BOT_NOT_FOUND (404) when Rust returns 404
//           — NO_MOVES_AVAILABLE (422) when Rust says no valid moves
//           — ENGINE_ERROR (502) for any other axios failure
//           — forwards the full YEN position object to the Rust engine
//           — strategy lookup is case-insensitive
// ──────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import { play } from '../services/gameService';
import { emptyYEN } from '../services/yenService';
import type { YEN } from '../models/game';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
// Restore the real isAxiosError shape on the mock
(mockedAxios as any).isAxiosError = axios.isAxiosError;

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Size-3 empty board, B's turn (turn = 0)
const emptyPosition: YEN = emptyYEN(3);

// Standard engine response: bot places a piece at (0, 0, 2)
const engineMoveResponse = {
  data: {
    api_version: 'v1',
    bot_id: 'random_bot',
    coords: { x: 0, y: 0, z: 2 },
  },
};

// Engine response for a swap action
const engineSwapResponse = {
  data: {
    api_version: 'v1',
    bot_id: 'random_bot',
    action: 'swap',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  (mockedAxios as any).isAxiosError = axios.isAxiosError;
});

// ── Happy paths ───────────────────────────────────────────────────────────────

describe('play — happy paths', () => {
  it('returns { coords } when bot_id is provided explicitly', async () => {
    mockedAxios.post.mockResolvedValue(engineMoveResponse);

    const result = await play(emptyPosition, 'random_bot');

    expect(result).toEqual({ coords: { x: 0, y: 0, z: 2 } });
  });

  it('resolves bot_id from strategy when bot_id is omitted', async () => {
    mockedAxios.post.mockResolvedValue(engineMoveResponse);

    const result = await play(emptyPosition, undefined, 'HARD');

    expect(result).toEqual({ coords: { x: 0, y: 0, z: 2 } });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('smart_bot'),
      emptyPosition,
      expect.any(Object)
    );
  });

  it('falls back to "random_bot" when neither bot_id nor strategy is supplied', async () => {
    mockedAxios.post.mockResolvedValue(engineMoveResponse);

    const result = await play(emptyPosition);

    expect(result).toEqual({ coords: { x: 0, y: 0, z: 2 } });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('random_bot'),
      emptyPosition,
      expect.any(Object)
    );
  });

  it('returns { action } when the engine responds with a special action', async () => {
    mockedAxios.post.mockResolvedValue(engineSwapResponse);

    const result = await play(emptyPosition, 'random_bot');

    expect(result).toEqual({ action: 'swap' });
  });

  it('forwards the full YEN position object to the Rust engine', async () => {
    mockedAxios.post.mockResolvedValue(engineMoveResponse);

    await play(emptyPosition, 'random_bot');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.any(String),
      emptyPosition,
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
    );
  });

  it('strategy lookup is case-insensitive', async () => {
    mockedAxios.post.mockResolvedValue(engineMoveResponse);

    await play(emptyPosition, undefined, 'medium');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('fast_bot'),
      expect.any(Object),
      expect.any(Object)
    );
  });
});

// ── Engine error paths ────────────────────────────────────────────────────────

describe('play — engine error handling', () => {
  function axiosError(code?: string, status?: number, bodyMessage?: string) {
    const err: any = new Error('axios error');
    err.isAxiosError = true;
    err.code = code;
    err.response = status
      ? { status, data: bodyMessage ? { message: bodyMessage } : {} }
      : undefined;
    return err;
  }

  beforeEach(() => {
    (mockedAxios as any).isAxiosError = () => true;
  });

  it('throws ENGINE_TIMEOUT (503) when axios reports ECONNABORTED', async () => {
    mockedAxios.post.mockRejectedValue(axiosError('ECONNABORTED'));

    await expect(play(emptyPosition)).rejects.toMatchObject({
      code: 'ENGINE_TIMEOUT',
      httpStatus: 503,
    });
  });

  it('throws BOT_NOT_FOUND (404) when the engine returns HTTP 404', async () => {
    mockedAxios.post.mockRejectedValue(axiosError(undefined, 404));

    await expect(play(emptyPosition, 'ghost_bot')).rejects.toMatchObject({
      code: 'BOT_NOT_FOUND',
      httpStatus: 404,
    });
  });

  it('throws NO_MOVES_AVAILABLE (422) when engine body contains "no valid moves"', async () => {
    mockedAxios.post.mockRejectedValue(
      axiosError(undefined, 400, 'No valid moves for bot')
    );

    await expect(play(emptyPosition)).rejects.toMatchObject({
      code: 'NO_MOVES_AVAILABLE',
      httpStatus: 422,
    });
  });

  it('throws ENGINE_ERROR (502) for any other axios failure', async () => {
    mockedAxios.post.mockRejectedValue(axiosError(undefined, 500));

    await expect(play(emptyPosition)).rejects.toMatchObject({
      code: 'ENGINE_ERROR',
      httpStatus: 502,
    });
  });

  it('throws ENGINE_ERROR (502) for a non-axios network error', async () => {
    (mockedAxios as any).isAxiosError = () => false;
    mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(play(emptyPosition)).rejects.toMatchObject({
      code: 'ENGINE_ERROR',
      httpStatus: 502,
    });
  });
});
