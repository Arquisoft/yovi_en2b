import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { TestDataSource } from './testDatabase';
import { Game } from '../src/entities/Game';

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
    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/games').send(pvePatch);
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
    it('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/games/some-id/move')
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
    it('returns 401 without token', async () => {
      const res = await request(app)
        .post('/api/games/some-id/surrender')
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
});
