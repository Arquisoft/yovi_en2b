// ──────────────────────────────────────────────────────────────────────────────
// __tests__/gameRoutes.integration.test.ts
//
// Integration tests for GET /play.
//
// The service layer is mocked so tests are fast and deterministic.
// Real Express middleware, routing, and controller validation are exercised.
//
// Coverage:
//   Happy path       — 200 with position + bot_id  → {coords}
//                    — 200 with position + strategy → {coords}
//                    — 200 with position only (default bot) → {coords}
//                    — 200 with swap action response → {action}
//   Request errors   — 400 missing position
//                    — 400 position not valid JSON
//                    — 400 position JSON but not a YEN object
//                    — 400 position with bad layout string
//                    — 400 position with wrong turn value
//                    — 400 position with zero size
//   Engine errors    — 404 BOT_NOT_FOUND
//                    — 422 NO_MOVES_AVAILABLE
//                    — 503 ENGINE_TIMEOUT
//                    — 502 ENGINE_ERROR
// ──────────────────────────────────────────────────────────────────────────────

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import gameRoutes from '../routes/gameRoutes';
import * as gameService from '../services/gameService';
import { emptyYEN } from '../services/yenService';
import type { YEN, PlayResponse } from '../models/game';

jest.mock('../services/gameService');
const mockedService = gameService as jest.Mocked<typeof gameService>;

const app = express();
app.use(cors());
app.use(express.json());
app.use(gameRoutes);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validPosition: YEN = emptyYEN(3);

const mockMoveResponse: PlayResponse = { coords: { x: 0, y: 0, z: 2 } };
const mockSwapResponse: PlayResponse = { action: 'swap' };

beforeEach(() => jest.clearAllMocks());

// ── Happy paths ───────────────────────────────────────────────────────────────

describe('GET /play — happy paths', () => {
  it('returns 200 with coords when position + bot_id are supplied', async () => {
    mockedService.play.mockResolvedValue(mockMoveResponse);

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition), bot_id: 'random_bot' });

    expect(res.status).toBe(200);
    expect(res.body.coords).toEqual({ x: 0, y: 0, z: 2 });
    expect(mockedService.play).toHaveBeenCalledWith(validPosition, 'random_bot', undefined);
  });

  it('returns 200 and forwards strategy HARD; service resolves it to smart_bot', async () => {
    mockedService.play.mockResolvedValue(mockMoveResponse);

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition), strategy: 'HARD' });

    expect(res.status).toBe(200);
    expect(res.body.coords).toEqual({ x: 0, y: 0, z: 2 });
    expect(mockedService.play).toHaveBeenCalledWith(validPosition, undefined, 'HARD');
  });

  it('returns 200 when only position is supplied (default bot used)', async () => {
    mockedService.play.mockResolvedValue(mockMoveResponse);

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition) });

    expect(res.status).toBe(200);
    expect(mockedService.play).toHaveBeenCalledWith(validPosition, undefined, undefined);
  });

  it('passes both bot_id and strategy when both are provided', async () => {
    mockedService.play.mockResolvedValue(mockMoveResponse);

    await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition), bot_id: 'custom_bot', strategy: 'EASY' });

    expect(mockedService.play).toHaveBeenCalledWith(validPosition, 'custom_bot', 'EASY');
  });

  it('returns 200 with {action} when service returns a swap response', async () => {
    mockedService.play.mockResolvedValue(mockSwapResponse);

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition) });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('swap');
    expect(res.body.coords).toBeUndefined();
  });
});

// ── Request validation errors ─────────────────────────────────────────────────

describe('GET /play — request validation', () => {
  it('returns 400 INVALID_POSITION when position query param is missing', async () => {
    const res = await request(app)
      .get('/play')
      .query({ bot_id: 'random_bot' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
    expect(mockedService.play).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_POSITION when position is not valid JSON', async () => {
    const res = await request(app)
      .get('/play')
      .query({ position: 'B/../...' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
    expect(mockedService.play).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_POSITION when position JSON is a string (not an object)', async () => {
    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify('B/../...') });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
    expect(mockedService.play).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_POSITION when position is missing the layout field', async () => {
    const { layout, ...withoutLayout } = validPosition;
    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(withoutLayout) });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });

  it('returns 400 INVALID_POSITION when position has a layout with wrong row count', async () => {
    const badPosition = { ...validPosition, layout: 'B/..' };

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(badPosition) });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });

  it('returns 400 INVALID_POSITION when layout contains invalid characters', async () => {
    const badPosition = { ...validPosition, layout: 'X/../...' };

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(badPosition) });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });

  it('returns 400 INVALID_POSITION when turn is not 0 or 1', async () => {
    const badPosition = { ...validPosition, turn: 2 };

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(badPosition) });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });

  it('returns 400 INVALID_POSITION when size is zero', async () => {
    const badPosition = { ...validPosition, size: 0 };

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(badPosition) });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });
});

// ── Engine error propagation ───────────────────────────────────────────────────

describe('GET /play — engine error propagation', () => {
  function serviceError(code: string, httpStatus: number) {
    return Object.assign(new Error(code), { code, httpStatus });
  }

  it('returns 404 BOT_NOT_FOUND when the engine does not recognise bot_id', async () => {
    mockedService.play.mockRejectedValue(serviceError('BOT_NOT_FOUND', 404));

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition), bot_id: 'ghost_bot' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOT_NOT_FOUND');
  });

  it('returns 422 NO_MOVES_AVAILABLE when the board has no legal moves', async () => {
    mockedService.play.mockRejectedValue(serviceError('NO_MOVES_AVAILABLE', 422));

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition) });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NO_MOVES_AVAILABLE');
  });

  it('returns 503 ENGINE_TIMEOUT when the Rust engine times out', async () => {
    mockedService.play.mockRejectedValue(serviceError('ENGINE_TIMEOUT', 503));

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition) });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ENGINE_TIMEOUT');
  });

  it('returns 502 ENGINE_ERROR for unexpected engine failures', async () => {
    mockedService.play.mockRejectedValue(serviceError('ENGINE_ERROR', 502));

    const res = await request(app)
      .get('/play')
      .query({ position: JSON.stringify(validPosition) });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('ENGINE_ERROR');
  });
});
