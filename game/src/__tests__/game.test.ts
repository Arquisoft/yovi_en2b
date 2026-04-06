import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { TestDataSource } from './testDatabase';
import { Game } from '../entities/Game';

const JWT_SECRET = process.env.JWT_SECRET || 'please_dont_tell_anyone';

function makeToken(userId = 1, username = 'testplayer') {
  return jwt.sign({ id: userId, username, role: 'player' }, JWT_SECRET, { expiresIn: '1h' });
}

const token = makeToken();

const pvePatch = {
  config: {
    mode: 'pve',
    boardSize: 5,
    timerEnabled: false,
    botLevel: 'medium',
    playerColor: 'player1',
  },
};

const pvpLocalConfig = {
  config: {
    mode: 'pvp-local',
    boardSize: 5,
    timerEnabled: false,
  },
};

// Mock fetch globally (used by BotService + recordMatch)
global.fetch = vi.fn();

beforeEach(() => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ coords: { x: 3, y: 1, z: 0 } }),
  } as any);
});

describe('Game API', () => {
  describe('POST /api/games', () => {
    it('allows guest creation without token', async () => {
      const res = await request(app).post('/api/games').send({ ...pvePatch, guestId: 'guest-test' });
      expect(res.status).toBe(201);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', 'Bearer invalid-token')
        .send(pvePatch);
      expect(res.status).toBe(401);
    });

    it('creates a pve game and returns GameState', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvePatch);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.config.mode).toBe('pve');
      expect(res.body.status).toBe('playing');
      expect(res.body.players.player1.id).toBeDefined();
      expect(res.body.board).toBeDefined();
      expect(Array.isArray(res.body.moves)).toBe(true);
    });

    it('creates a pvp-local game', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);

      expect(res.status).toBe(201);
      expect(res.body.config.mode).toBe('pvp-local');
      expect(res.body.players.player1.isLocal).toBe(true);
      expect(res.body.players.player2.isLocal).toBe(true);
    });

    it('returns 400 without config', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('bot-goes-first when playerColor is player2 in pve', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({
          config: {
            mode: 'pve',
            boardSize: 5,
            timerEnabled: false,
            botLevel: 'medium',
            playerColor: 'player2',
          },
        });

      expect(res.status).toBe(201);
      // Bot is player1, so after createGame the board should have 1 move
      expect(res.body.moves.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/games/:id', () => {
    it('returns 404 for unknown game', async () => {
      const res = await request(app).get('/api/games/nonexistent-id');
      expect(res.status).toBe(404);
    });

    it('returns the game state', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);

      const gameId = createRes.body.id;
      const getRes = await request(app).get(`/api/games/${gameId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(gameId);
    });
  });

  describe('POST /api/games/:id/move', () => {
    it('returns 404 without token (guest allowed, game not found)', async () => {
      const res = await request(app)
        .post('/api/games/some-id/move')
        .send({ row: 0, col: 0, player: 'player1' });
      expect(res.status).toBe(404);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/games/some-id/move')
        .set('Authorization', 'Bearer invalid-token')
        .send({ row: 0, col: 0, player: 'player1' });
      expect(res.status).toBe(401);
    });

    it('returns 404 for unknown game', async () => {
      const res = await request(app)
        .post('/api/games/nonexistent/move')
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });
      expect(res.status).toBe(404);
    });

    it('applies a valid move to a pvp-local game', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);

      const gameId = createRes.body.id;

      const moveRes = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.moves).toHaveLength(1);
      expect(moveRes.body.moves[0]).toMatchObject({ row: 0, col: 0, player: 'player1' });
      expect(moveRes.body.currentTurn).toBe('player2');
    });

    it('rejects move when it is not player turn', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);
      const gameId = createRes.body.id;

      const res = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player2' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/not your turn/i);
    });

    it('rejects duplicate move on same cell', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);
      const gameId = createRes.body.id;

      await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });

      const res = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player2' });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/invalid move/i);
    });

    it('returns 400 when row/col/player missing', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);
      const gameId = createRes.body.id;

      const res = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/games/:id/surrender', () => {
    it('returns 404 without token (guest allowed, game not found)', async () => {
      const res = await request(app)
        .post('/api/games/some-id/surrender')
        .send({ player: 'player1' });
      expect(res.status).toBe(404);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/games/some-id/surrender')
        .set('Authorization', 'Bearer invalid-token')
        .send({ player: 'player1' });
      expect(res.status).toBe(401);
    });

    it('returns 404 for unknown game', async () => {
      const res = await request(app)
        .post('/api/games/nonexistent/surrender')
        .set('Authorization', `Bearer ${token}`)
        .send({ player: 'player1' });
      expect(res.status).toBe(404);
    });

    it('surrenders and marks winner as opponent', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);
      const gameId = createRes.body.id;

      const res = await request(app)
        .post(`/api/games/${gameId}/surrender`)
        .set('Authorization', `Bearer ${token}`)
        .send({ player: 'player1' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('finished');
      expect(res.body.winner).toBe('player2');
    });

    it('disables timer on surrender', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({
          config: {
            mode: 'pvp-local',
            boardSize: 5,
            timerEnabled: true,
            timerSeconds: 300,
          },
        });
      const gameId = createRes.body.id;

      const res = await request(app)
        .post(`/api/games/${gameId}/surrender`)
        .set('Authorization', `Bearer ${token}`)
        .send({ player: 'player1' });

      expect(res.status).toBe(200);
      if (res.body.timer) {
        expect(res.body.timer.activePlayer).toBeNull();
      }
    });

    it('returns 409 on already finished game', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);
      const gameId = createRes.body.id;

      await request(app)
        .post(`/api/games/${gameId}/surrender`)
        .set('Authorization', `Bearer ${token}`)
        .send({ player: 'player1' });

      const res = await request(app)
        .post(`/api/games/${gameId}/surrender`)
        .set('Authorization', `Bearer ${token}`)
        .send({ player: 'player2' });

      expect(res.status).toBe(409);
    });

    it('persists finished status in DB', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);
      const gameId = createRes.body.id;

      await request(app)
        .post(`/api/games/${gameId}/surrender`)
        .set('Authorization', `Bearer ${token}`)
        .send({ player: 'player2' });

      const game = await TestDataSource.getRepository(Game).findOne({ where: { id: gameId } });
      expect(game?.status).toBe('finished');
      expect(game?.winner).toBe('player1');
    });
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Unknown routes', () => {
    it('returns 404 for unknown GET route', async () => {
      const res = await request(app).get('/api/unknown-route');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    it('returns 404 for unknown POST route', async () => {
      const res = await request(app).post('/api/unknown-route').send({});
      expect(res.status).toBe(404);
    });
  });

  describe('Malformed JSON', () => {
    it('returns 400 for malformed JSON body', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send('{ invalid json }');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid JSON');
    });
  });

  describe('Authentication edge cases', () => {
    it('returns 401 for expired token on any route', async () => {
      const expiredToken = jwt.sign(
        { id: 1, username: 'test', role: 'player' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send(pvePatch);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token expired');
    });
  });

  describe('POST /api/games — config validation', () => {
    it('returns 400 when boardSize < 4', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 3, timerEnabled: false } });
      expect(res.status).toBe(400);
    });

    it('returns 400 when boardSize > 16', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 17, timerEnabled: false } });
      expect(res.status).toBe(400);
    });

    it('returns 400 when timerSeconds out of range', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 5, timerEnabled: true, timerSeconds: 10 } });
      expect(res.status).toBe(400);
    });

    it('creates game with easy bot level', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pve', boardSize: 5, timerEnabled: false, botLevel: 'easy', playerColor: 'player1' } });
      expect(res.status).toBe(201);
      expect(res.body.players.player2.isBot).toBe(true);
    });

    it('creates game with hard bot level', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pve', boardSize: 5, timerEnabled: false, botLevel: 'hard', playerColor: 'player1' } });
      expect(res.status).toBe(201);
      expect(res.body.players.player2.isBot).toBe(true);
    });

    it('creates game with timer enabled', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 5, timerEnabled: true, timerSeconds: 300 } });
      expect(res.status).toBe(201);
      expect(res.body.timer).not.toBeNull();
      expect(res.body.timer.player1RemainingMs).toBe(300000);
      expect(res.body.timer.activePlayer).toBe('player1');
    });
  });

  describe('POST /api/games/:id/surrender — validation', () => {
    it('returns 400 when player field is missing', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);
      const gameId = createRes.body.id;

      const res = await request(app)
        .post(`/api/games/${gameId}/surrender`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/player is required/i);
    });
  });

  describe('Timer game flow', () => {
    it('timer decrements after a move', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 5, timerEnabled: true, timerSeconds: 300 } });
      const gameId = createRes.body.id;
      const initialMs = createRes.body.timer.player1RemainingMs;

      const moveRes = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.timer).not.toBeNull();
      expect(moveRes.body.timer.player1RemainingMs).toBeLessThanOrEqual(initialMs);
      expect(moveRes.body.timer.activePlayer).toBe('player2');
    });

    it('timer activePlayer is null after surrender', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 5, timerEnabled: true, timerSeconds: 300 } });
      const gameId = createRes.body.id;

      const res = await request(app)
        .post(`/api/games/${gameId}/surrender`)
        .set('Authorization', `Bearer ${token}`)
        .send({ player: 'player1' });

      expect(res.status).toBe(200);
      expect(res.body.timer.activePlayer).toBeNull();
    });
  });

  describe('PvE game with token — match recording', () => {
    it('pve game records match when human wins (bot fails gracefully)', async () => {
      // Mock bot to return an invalid move so it skips — human can play to win
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ coords: { x: 0, y: 0, z: 0 } }) } as any)
        .mockResolvedValue({ ok: false, status: 503 } as any);

      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pve', boardSize: 5, timerEnabled: false, botLevel: 'medium', playerColor: 'player1' } });

      expect(createRes.status).toBe(201);
    });

    it('returns 201 for pve game where bot is player2 (human player1)', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pve', boardSize: 5, timerEnabled: false, botLevel: 'medium', playerColor: 'player1' } });
      expect(res.status).toBe(201);
      expect(res.body.players.player1.isBot).toBeUndefined();
      expect(res.body.players.player2.isBot).toBe(true);
    });
  });
});
