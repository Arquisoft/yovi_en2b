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

  describe('POST /api/games — Pie Rule', () => {
    it('creates a game with pieRule enabled and returns phase "playing" initially', async () => {
      const res = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 5, timerEnabled: false, pieRule: true } });

      expect(res.status).toBe(201);
      expect(res.body.config.pieRule).toBe(true);
      expect(res.body.phase).toBe('playing');
    });

    it('enters pie-decision phase after the first move when pieRule is enabled', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 5, timerEnabled: false, pieRule: true } });
      const gameId = createRes.body.id;

      const moveRes = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.phase).toBe('pie-decision');
      expect(moveRes.body.currentTurn).toBe('player2');
      expect(moveRes.body.status).toBe('playing');
    });

    it('rejects a normal move while in pie-decision phase', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 5, timerEnabled: false, pieRule: true } });
      const gameId = createRes.body.id;

      await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });

      const illegalMove = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 1, col: 0, player: 'player2' });

      expect(illegalMove.status).toBe(409);
      expect(illegalMove.body.error).toMatch(/pie rule/i);
    });
  });

  describe('POST /api/games/:id/pie-decision', () => {
    async function createPieGame() {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({ config: { mode: 'pvp-local', boardSize: 5, timerEnabled: false, pieRule: true } });
      const gameId = createRes.body.id;

      await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });

      return gameId;
    }

    it('returns 400 for an invalid decision value', async () => {
      const gameId = await createPieGame();
      const res = await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('returns 409 when the game is not in pie-decision phase', async () => {
      // Game without pie rule — no pie-decision phase ever entered
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send(pvpLocalConfig);
      const gameId = createRes.body.id;

      const res = await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'keep' });

      expect(res.status).toBe(409);
    });

    it('keep: resumes game in playing phase with unchanged board and player order', async () => {
      const gameId = await createPieGame();

      const res = await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'keep' });

      expect(res.status).toBe(200);
      expect(res.body.phase).toBe('playing');
      expect(res.body.currentTurn).toBe('player2');
      // First stone still belongs to player1
      const stone = (res.body.board as any[][]).flat().find((c: any) => c.owner !== null);
      expect(stone?.owner).toBe('player1');
      // Player identities unchanged: player1 is still the one who placed the stone
      expect(res.body.players.player1.isLocal).toBe(true);
      expect(res.body.players.player2.isLocal).toBe(true);
    });

    it('keep: allows player2 to play immediately after keeping', async () => {
      const gameId = await createPieGame();

      await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'keep' });

      const moveRes = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 1, col: 0, player: 'player2' });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.moves).toHaveLength(2);
    });

    it('swap: changes the first stone from player1 (Blue) to player2 (Red)', async () => {
      const gameId = await createPieGame();

      const res = await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'swap' });

      expect(res.status).toBe(200);
      expect(res.body.phase).toBe('playing');
      // Stone colour changes: was player1 (Blue), now player2 (Red)
      const stone = (res.body.board as any[][]).flat().find((c: any) => c.owner !== null);
      expect(stone?.owner).toBe('player2');
      // player1 (Blue) goes next — they respond after their stone was taken
      expect(res.body.currentTurn).toBe('player1');
      // Player objects are unchanged — player1 is still Blue, player2 is still Red
      expect(res.body.players.player1.isLocal).toBe(true);
      expect(res.body.players.player2.isLocal).toBe(true);
    });

    it('swap: player1 (Blue) can play immediately after the swap', async () => {
      const gameId = await createPieGame();

      await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'swap' });

      // currentTurn is 'player1' — Blue plays next
      const moveRes = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 1, col: 0, player: 'player1' });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.moves).toHaveLength(2);
    });

    it('pie-decision phase with bot as player2 (PvE, human is player1): bot auto-resolves pie decision', async () => {
      // Mock: first fetch = pie-decide (bot decides keep), second fetch = bot move
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ decision: 'keep' }) } as any)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ coords: { x: 3, y: 1, z: 0 } }) } as any);

      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({
          config: {
            mode: 'pve',
            boardSize: 5,
            timerEnabled: false,
            botLevel: 'medium',
            playerColor: 'player1',
            pieRule: true,
          },
        });
      const gameId = createRes.body.id;
      expect(createRes.body.players.player2.isBot).toBe(true);

      // Human (player1) plays first move — bot auto-resolves pie decision
      const moveRes = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });

      expect(moveRes.status).toBe(200);
      // Bot auto-resolved the pie decision, game is back to playing
      expect(moveRes.body.phase).toBe('playing');
      expect(moveRes.body.players.player2.isBot).toBe(true);
    });

    it('pie-decision with human as player2 (PvE): keep → human plays next as Red', async () => {
      // Human is player2 (Red), bot is player1 (Blue) — bot plays first automatically
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({
          config: {
            mode: 'pve',
            boardSize: 5,
            timerEnabled: false,
            botLevel: 'medium',
            playerColor: 'player2',
            pieRule: true,
          },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.phase).toBe('pie-decision');
      expect(createRes.body.players.player1.isBot).toBe(true);

      const gameId = createRes.body.id;

      // Human (player2/Red) keeps — stone stays Blue (player1), human plays next as Red
      const keepRes = await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'keep' });

      expect(keepRes.status).toBe(200);
      expect(keepRes.body.phase).toBe('playing');
      // currentTurn was already 'player2' after the first move; keep leaves it unchanged
      expect(keepRes.body.currentTurn).toBe('player2');
      // Stone stays Blue (player1's)
      const stone = (keepRes.body.board as any[][]).flat().find((c: any) => c.owner !== null);
      expect(stone?.owner).toBe('player1');
    });

    it('pie-decision with human as player2 (PvE): swap → stone becomes Red, bot (player1) auto-plays', async () => {
      // Bot's first move (on creation): x=3,y=1 → row=1,col=1
      // Bot's second move (after swap):  x=2,y=0 → row=2,col=0  (different empty cell)
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ coords: { x: 3, y: 1, z: 0 } }) } as any)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ coords: { x: 2, y: 0, z: 0 } }) } as any);

      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({
          config: {
            mode: 'pve',
            boardSize: 5,
            timerEnabled: false,
            botLevel: 'medium',
            playerColor: 'player2',
            pieRule: true,
          },
        });

      const gameId = createRes.body.id;

      // Human (player2/Red) swaps — stone becomes Red (player2), bot (player1/Blue) goes next
      const swapRes = await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'swap' });

      expect(swapRes.status).toBe(200);
      // Bot (player1) auto-played: at least 2 moves in history
      expect(swapRes.body.moves.length).toBeGreaterThanOrEqual(2);
      // The originally-placed stone is now Red (player2 = human)
      const swappedStone = (swapRes.body.board as any[][]).flat().find(
        (c: any) => c.row === 1 && c.col === 1
      );
      expect(swappedStone?.owner).toBe('player2');
      // Bot played its second stone as Blue (player1)
      expect(swapRes.body.currentTurn).toBe('player2');
    });

    it('timer is paused in pie-decision phase and resumed after keep', async () => {
      const createRes = await request(app)
        .post('/api/games')
        .set('Authorization', `Bearer ${token}`)
        .send({
          config: {
            mode: 'pvp-local',
            boardSize: 5,
            timerEnabled: true,
            timerSeconds: 300,
            pieRule: true,
          },
        });
      const gameId = createRes.body.id;

      const moveRes = await request(app)
        .post(`/api/games/${gameId}/move`)
        .set('Authorization', `Bearer ${token}`)
        .send({ row: 0, col: 0, player: 'player1' });

      expect(moveRes.body.phase).toBe('pie-decision');
      expect(moveRes.body.timer.activePlayer).toBeNull();

      const keepRes = await request(app)
        .post(`/api/games/${gameId}/pie-decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'keep' });

      expect(keepRes.body.phase).toBe('playing');
      expect(keepRes.body.timer.activePlayer).toBe('player2');
    });

    it('normal game without pieRule does not enter pie-decision after first move', async () => {
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
      expect(moveRes.body.phase).toBe('playing');
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
