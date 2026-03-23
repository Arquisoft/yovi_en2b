// ──────────────────────────────────────────────────────────────────────────────
// __tests__/gameRoutes.integration.test.ts
//
// Integration tests for POST /games/play.
//
// The service layer is mocked so tests are fast and deterministic.
// Real Express middleware, routing, and controller validation are exercised.
//
// Coverage:
//   Happy path       — 200 with position + bot_id
//                    — 200 with position + strategy
//                    — 200 with position only (default bot)
//                    — 200 with both bot_id and strategy
//   Request errors   — 400 missing position
//                    — 400 malformed position (wrong shape)
//                    — 400 position with bad layout string
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
app.use('/games', gameRoutes);

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validPosition: YEN = emptyYEN(3); // "./../..."

const mockPlayResponse: PlayResponse = {
  move: '0,0,2',
  position: 'B/../...',
  bot_id: 'random_bot',
};

beforeEach(() => jest.clearAllMocks());

// ── Happy paths ───────────────────────────────────────────────────────────────

describe('POST /games/play — happy paths', () => {
  it('returns 200 with move and updated position when position + bot_id are supplied', async () => {
    mockedService.play.mockResolvedValue(mockPlayResponse);

    const res = await request(app)
      .post('/games/play')
      .send({ position: validPosition, bot_id: 'random_bot' });

    expect(res.status).toBe(200);
    expect(res.body.move).toBe('0,0,2');
    expect(res.body.position).toBe('B/../...');
    expect(res.body.bot_id).toBe('random_bot');
    expect(mockedService.play).toHaveBeenCalledWith(validPosition, 'random_bot', undefined);
  });

  it('returns 200 and forwards strategy when provided without bot_id', async () => {
    const hardResponse: PlayResponse = { ...mockPlayResponse, bot_id: 'minimax_bot' };
    mockedService.play.mockResolvedValue(hardResponse);

    const res = await request(app)
      .post('/games/play')
      .send({ position: validPosition, strategy: 'HARD' });

    expect(res.status).toBe(200);
    expect(res.body.bot_id).toBe('minimax_bot');
    expect(mockedService.play).toHaveBeenCalledWith(validPosition, undefined, 'HARD');
  });

  it('returns 200 when only position is supplied (default bot used)', async () => {
    mockedService.play.mockResolvedValue(mockPlayResponse);

    const res = await request(app)
      .post('/games/play')
      .send({ position: validPosition });

    expect(res.status).toBe(200);
    expect(mockedService.play).toHaveBeenCalledWith(validPosition, undefined, undefined);
  });

  it('passes both bot_id and strategy when both are provided', async () => {
    mockedService.play.mockResolvedValue(mockPlayResponse);

    await request(app)
      .post('/games/play')
      .send({ position: validPosition, bot_id: 'custom_bot', strategy: 'EASY' });

    expect(mockedService.play).toHaveBeenCalledWith(validPosition, 'custom_bot', 'EASY');
  });
});

// ── Request validation errors ─────────────────────────────────────────────────

describe('POST /games/play — request validation', () => {
  it('returns 400 INVALID_POSITION when position is missing', async () => {
    const res = await request(app)
      .post('/games/play')
      .send({ bot_id: 'random_bot' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
    expect(mockedService.play).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_POSITION when position is a plain string instead of a YEN object', async () => {
    const res = await request(app)
      .post('/games/play')
      .send({ position: 'B/../...' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
    expect(mockedService.play).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_POSITION when position is missing the layout field', async () => {
    const { layout, ...withoutLayout } = validPosition;
    const res = await request(app)
      .post('/games/play')
      .send({ position: withoutLayout });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });

  it('returns 400 INVALID_POSITION when position has a layout with wrong row count', async () => {
    const badPosition = { ...validPosition, layout: 'B/..' }; // size 3 needs 3 rows

    const res = await request(app)
      .post('/games/play')
      .send({ position: badPosition });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });

  it('returns 400 INVALID_POSITION when layout contains invalid characters', async () => {
    const badPosition = { ...validPosition, layout: 'X/../...' };

    const res = await request(app)
      .post('/games/play')
      .send({ position: badPosition });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });

  it('returns 400 INVALID_POSITION when turn is not 0 or 1', async () => {
    const badPosition = { ...validPosition, turn: 2 };

    const res = await request(app)
      .post('/games/play')
      .send({ position: badPosition });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });

  it('returns 400 INVALID_POSITION when size is zero', async () => {
    const badPosition = { ...validPosition, size: 0 };

    const res = await request(app)
      .post('/games/play')
      .send({ position: badPosition });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_POSITION');
  });
});

// ── Engine error propagation ───────────────────────────────────────────────────

describe('POST /games/play — engine error propagation', () => {
  function serviceError(code: string, httpStatus: number) {
    return Object.assign(new Error(code), { code, httpStatus });
  }

  it('returns 404 BOT_NOT_FOUND when the engine does not recognise bot_id', async () => {
    mockedService.play.mockRejectedValue(serviceError('BOT_NOT_FOUND', 404));

    const res = await request(app)
      .post('/games/play')
      .send({ position: validPosition, bot_id: 'ghost_bot' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('BOT_NOT_FOUND');
  });

  it('returns 422 NO_MOVES_AVAILABLE when the board has no legal moves', async () => {
    mockedService.play.mockRejectedValue(serviceError('NO_MOVES_AVAILABLE', 422));

    const res = await request(app)
      .post('/games/play')
      .send({ position: validPosition });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('NO_MOVES_AVAILABLE');
  });

  it('returns 503 ENGINE_TIMEOUT when the Rust engine times out', async () => {
    mockedService.play.mockRejectedValue(serviceError('ENGINE_TIMEOUT', 503));

    const res = await request(app)
      .post('/games/play')
      .send({ position: validPosition });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ENGINE_TIMEOUT');
  });

  it('returns 502 ENGINE_ERROR for unexpected engine failures', async () => {
    mockedService.play.mockRejectedValue(serviceError('ENGINE_ERROR', 502));

    const res = await request(app)
      .post('/games/play')
      .send({ position: validPosition });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe('ENGINE_ERROR');
  });
});