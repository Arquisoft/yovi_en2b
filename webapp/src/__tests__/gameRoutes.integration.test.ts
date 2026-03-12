// ──────────────────────────────────────────────────────────────────────────────
// __tests__/gameRoutes.integration.test.ts
//
// Integration tests for the full HTTP layer: routes → middleware → controller.
//
// WHY integration tests on top of unit tests:
//   Unit tests verify logic in isolation; integration tests verify that the
//   pieces are wired together correctly.  This file fires real HTTP requests
//   against a real Express app (in-process, no network) using supertest.
//   The only thing mocked is the gameService layer so we can control what the
//   service returns without needing a running Rust engine or database.
//
// Coverage per endpoint:
//   GET  /games/:gameId           — 200, 400 (bad id), 404
//   POST /games/:gameId/play      — 200, 202, 400 (missing body / bad id), 403, 404, 409
//   POST /games/:gameId/surrender — 200, 403, 404, 409
//   All routes without a token   — 401
// ──────────────────────────────────────────────────────────────────────────────

import request from 'supertest';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import gameRoutes from '../routes/gameRoutes';
import * as gameService from '../services/gameService';
import { emptyYEN } from '../services/yenService';
import type { GameState, PlayResult } from '../models/game';

// ── Mock the entire service layer ─────────────────────────────────────────────
jest.mock('../services/gameService');
const mockedService = gameService as jest.Mocked<typeof gameService>;

// ── Build the Express app (same wiring as server.ts) ─────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use('/games', gameRoutes);

// ── JWT helpers ───────────────────────────────────────────────────────────────
const SECRET = process.env.JWT_SECRET ?? 'please_dont_tell_anyone';
const USER_ID = 42;

function validToken(id = USER_ID) {
  return jwt.sign({ id, username: 'alice', role: 'USER' }, SECRET, { expiresIn: '1h' });
}

function authHeader(id = USER_ID) {
  return { Authorization: `Bearer ${validToken(id)}` };
}

// ── Shared game fixture ───────────────────────────────────────────────────────
const mockGame: GameState = {
  gameId: 1,
  yen: emptyYEN(3),
  players: {
    B: { type: 'HUMAN', id: USER_ID },
    R: { type: 'BOT', strategy: 'EASY' },
  },
  timers: { B: 600_000, R: 600_000 },
  turn: 'B',
  status: 'ONGOING',
};

const mockPlayResult: PlayResult = {
  fastMove: '0,0,2',
  yen: 'B/../R..',
  timers: { B: 599_900, R: 599_900 },
  nextTurn: 'B',
  status: 'ONGOING',
};

beforeEach(() => jest.clearAllMocks());

// ──────────────────────────────────────────────────────────────────────────────
// Auth wall — applies to every route
// ──────────────────────────────────────────────────────────────────────────────

describe('Authentication wall', () => {
  it('GET /games/1 returns 401 when no token is provided', async () => {
    const res = await request(app).get('/games/1');
    expect(res.status).toBe(401);
  });

  it('POST /games/1/play returns 401 when no token is provided', async () => {
    const res = await request(app).post('/games/1/play').send({ yen: 'B/../...' });
    expect(res.status).toBe(401);
  });

  it('POST /games/1/surrender returns 401 when no token is provided', async () => {
    const res = await request(app).post('/games/1/surrender');
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /games/:gameId
// ──────────────────────────────────────────────────────────────────────────────

describe('GET /games/:gameId', () => {
  it('returns 200 and a serialised game state for a known game', async () => {
    mockedService.getGameState.mockReturnValue(mockGame);

    const res = await request(app)
      .get('/games/1')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.gameId).toBe(1);
    expect(res.body.status).toBe('ONGOING');
    // yen is serialised as the layout string, not an object
    expect(typeof res.body.yen).toBe('string');
    expect(mockedService.getGameState).toHaveBeenCalledWith(1);
  });

  it('returns 404 when the game does not exist', async () => {
    mockedService.getGameState.mockImplementation(() => {
      throw Object.assign(new Error('Game not found'), {
        code: 'GAME_NOT_FOUND',
        httpStatus: 404,
        gameStatus: null,
      });
    });

    const res = await request(app)
      .get('/games/999')
      .set(authHeader());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('GAME_NOT_FOUND');
  });

  it('returns 400 when gameId is not a positive integer', async () => {
    const res = await request(app)
      .get('/games/abc')
      .set(authHeader());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when gameId is zero', async () => {
    const res = await request(app)
      .get('/games/0')
      .set(authHeader());

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /games/:gameId/play
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /games/:gameId/play', () => {
  it('returns 200 and a PlayResult when the bot replies fast', async () => {
    mockedService.playMove.mockResolvedValue({ result: mockPlayResult, httpStatus: 200 });

    const res = await request(app)
      .post('/games/1/play')
      .set(authHeader())
      .send({ yen: 'B/../...' });

    expect(res.status).toBe(200);
    expect(res.body.fastMove).toBe('0,0,2');
    expect(res.body.status).toBe('ONGOING');
    expect(mockedService.playMove).toHaveBeenCalledWith(1, 'B/../...', USER_ID);
  });

  it('returns 202 when the Rust engine times out', async () => {
    const asyncResult: PlayResult = { ...mockPlayResult, fastMove: null, nextTurn: 'R' };
    mockedService.playMove.mockResolvedValue({ result: asyncResult, httpStatus: 202 });

    const res = await request(app)
      .post('/games/1/play')
      .set(authHeader())
      .send({ yen: 'B/../...' });

    expect(res.status).toBe(202);
    expect(res.body.fastMove).toBeNull();
  });

  it('returns 400 when the request body is missing the yen field', async () => {
    const res = await request(app)
      .post('/games/1/play')
      .set(authHeader())
      .send({});  // no yen

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ILLEGAL_MOVE');
    // Service must not be called for malformed requests
    expect(mockedService.playMove).not.toHaveBeenCalled();
  });

  it('returns 400 for an illegal board layout (validation error from service)', async () => {
    mockedService.playMove.mockRejectedValue(
      new Error('Expected exactly 1 new cell, found 2')
    );

    const res = await request(app)
      .post('/games/1/play')
      .set(authHeader())
      .send({ yen: 'B/../B..' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ILLEGAL_MOVE');
  });

  it('returns 403 NOT_YOUR_TURN when it is the opponent\'s turn', async () => {
    mockedService.playMove.mockRejectedValue(
      Object.assign(new Error("Not your turn"), {
        code: 'NOT_YOUR_TURN',
        httpStatus: 403,
        gameStatus: 'ONGOING',
      })
    );

    const res = await request(app)
      .post('/games/1/play')
      .set(authHeader())
      .send({ yen: 'B/../...' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_YOUR_TURN');
  });

  it('returns 409 GAME_ALREADY_FINISHED when the game is over', async () => {
    mockedService.playMove.mockRejectedValue(
      Object.assign(new Error('Game already finished'), {
        code: 'GAME_ALREADY_FINISHED',
        httpStatus: 409,
        gameStatus: 'PLAYER_B_WINS',
      })
    );

    const res = await request(app)
      .post('/games/1/play')
      .set(authHeader())
      .send({ yen: 'B/../...' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('GAME_ALREADY_FINISHED');
    expect(res.body.gameStatus).toBe('PLAYER_B_WINS');
  });

  it('returns 400 when gameId is not a number', async () => {
    const res = await request(app)
      .post('/games/notanumber/play')
      .set(authHeader())
      .send({ yen: 'B/../...' });

    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /games/:gameId/surrender
// ──────────────────────────────────────────────────────────────────────────────

describe('POST /games/:gameId/surrender', () => {
  it('returns 200 and the final game state with PLAYER_R_WINS', async () => {
    const finishedGame: GameState = {
      ...mockGame,
      status: 'PLAYER_R_WINS',
      turn: null,
    };
    mockedService.surrender.mockResolvedValue(finishedGame);

    const res = await request(app)
      .post('/games/1/surrender')
      .set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PLAYER_R_WINS');
    expect(res.body.turn).toBeNull();
    expect(mockedService.surrender).toHaveBeenCalledWith(1, USER_ID);
  });

  it('returns 403 when the caller is not in the game', async () => {
    mockedService.surrender.mockRejectedValue(
      Object.assign(new Error('Not playing'), {
        code: 'NOT_PLAYING',
        httpStatus: 403,
        gameStatus: 'ONGOING',
      })
    );

    const res = await request(app)
      .post('/games/1/surrender')
      .set(authHeader());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NOT_PLAYING');
  });

  it('returns 404 when the game does not exist', async () => {
    mockedService.surrender.mockRejectedValue(
      Object.assign(new Error('Game not found'), {
        code: 'GAME_NOT_FOUND',
        httpStatus: 404,
        gameStatus: null,
      })
    );

    const res = await request(app)
      .post('/games/999/surrender')
      .set(authHeader());

    expect(res.status).toBe(404);
  });

  it('returns 409 when the game is already finished', async () => {
    mockedService.surrender.mockRejectedValue(
      Object.assign(new Error('Game already finished'), {
        code: 'GAME_ALREADY_FINISHED',
        httpStatus: 409,
        gameStatus: 'PLAYER_B_WINS',
      })
    );

    const res = await request(app)
      .post('/games/1/surrender')
      .set(authHeader());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('GAME_ALREADY_FINISHED');
  });

  it('returns 400 when gameId is not a positive integer', async () => {
    const res = await request(app)
      .post('/games/-5/surrender')
      .set(authHeader());

    expect(res.status).toBe(400);
  });
});
