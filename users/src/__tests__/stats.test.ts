// users/__tests__/stats.test.ts
import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Stats API', () => {
  const testUser = {
    username: `statsplayer_${Date.now()}`,
    email: `stats_${Date.now()}@example.com`,
    password: 'password123'
  };

  let authToken: string;

  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(testUser).catch(() => {})
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    if (!loginRes.body.token) {
      throw new Error(`Login failed in beforeEach: ${JSON.stringify(loginRes.body)}`);
    }
    authToken = loginRes.body.token;
  });

  // ─── GET /api/stats/history ───────────────────────────────────────────────

  describe('GET /api/stats/history', () => {
    it('should return match history for authenticated user', async () => {
      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return empty array when no matches played', async () => {
      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return entries with required fields', async () => {
      await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'Bot', result: 'win', durationSeconds: 120 });

      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      for (const match of res.body) {
        expect(match).toHaveProperty('id');
        expect(match).toHaveProperty('opponentName');
        expect(match).toHaveProperty('result');
        expect(match).toHaveProperty('durationSeconds');
        expect(match).toHaveProperty('playedAt');
        expect(['win', 'loss']).toContain(match.result);
      }
    });

    it('should return matches ordered by date descending', async () => {
      await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'PlayerA', result: 'win', durationSeconds: 100 });
      await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'PlayerB', result: 'loss', durationSeconds: 200 });

      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      const dates = res.body.map((m: any) => new Date(m.playedAt).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it('should only return matches for the authenticated user', async () => {
      const otherUser = {
        username: `other_${Date.now()}`,
        email: `other_${Date.now()}@example.com`,
        password: 'password123'
      };
      await request(app).post('/api/auth/register').send(otherUser);
      const otherLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: otherUser.email, password: otherUser.password });

      await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${otherLogin.body.token}`)
        .send({ opponentName: 'SomePlayer', result: 'win', durationSeconds: 90 });

      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/stats/history')
        .set('Accept', 'application/json');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/stats/winrate ───────────────────────────────────────────────

  describe('GET /api/stats/winrate', () => {
    it('should return winrate data for authenticated user', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('overall');
      expect(res.body).toHaveProperty('recent');
    });

    it('should return overall with wins and losses', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.overall.wins).toBe('number');
      expect(typeof res.body.overall.losses).toBe('number');
    });

    it('should return recent with wins and losses', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.recent.wins).toBe('number');
      expect(typeof res.body.recent.losses).toBe('number');
    });

    it('should return zeros when no matches played', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.overall.wins).toBe(0);
      expect(res.body.overall.losses).toBe(0);
      expect(res.body.overall.total).toBe(0);
    });

    it('should count wins and losses correctly', async () => {
      await request(app).post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'A', result: 'win', durationSeconds: 100 });
      await request(app).post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'B', result: 'win', durationSeconds: 100 });
      await request(app).post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'C', result: 'loss', durationSeconds: 100 });

      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body.overall.wins).toBe(2);
      expect(res.body.overall.losses).toBe(1);
      expect(res.body.overall.total).toBe(3);
    });

    it('should return total as sum of wins and losses', async () => {
      await request(app).post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'X', result: 'win', durationSeconds: 60 });

      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.body.overall.total).toBe(
        res.body.overall.wins + res.body.overall.losses
      );
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Accept', 'application/json');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', 'Bearer invalid_token');
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/stats/record ───────────────────────────────────────────────

  describe('POST /api/stats/record', () => {
    it('should save a win record successfully', async () => {
      const res = await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'Bot (medium)', result: 'win', durationSeconds: 142 });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.result).toBe('win');
    });

    it('should save a loss record successfully', async () => {
      const res = await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'PlayerTwo', result: 'loss', durationSeconds: 87 });
      expect(res.status).toBe(201);
      expect(res.body.result).toBe('loss');
    });

    it('should return saved record with all fields', async () => {
      const res = await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'Bot (hard)', result: 'win', durationSeconds: 200 });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('opponentName', 'Bot (hard)');
      expect(res.body).toHaveProperty('result', 'win');
      expect(res.body).toHaveProperty('durationSeconds', 200);
      expect(res.body).toHaveProperty('playedAt');
    });

    it('should appear in history after being saved', async () => {
      await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'TestOpponent', result: 'win', durationSeconds: 99 });

      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.body.some((m: any) => m.opponentName === 'TestOpponent')).toBe(true);
    });

    it('should increment winrate after saving a win', async () => {
      const before = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      const winsBefore = before.body.overall.wins;

      await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'Someone', result: 'win', durationSeconds: 60 });

      const after = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(after.body.overall.wins).toBe(winsBefore + 1);
    });

    it('should increment losses after saving a loss', async () => {
      const before = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      const lossesBefore = before.body.overall.losses;

      await request(app)
        .post('/api/stats/record')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ opponentName: 'Someone', result: 'loss', durationSeconds: 60 });

      const after = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`);
      expect(after.body.overall.losses).toBe(lossesBefore + 1);
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/stats/record')
        .send({ opponentName: 'Bot', result: 'win', durationSeconds: 100 });
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .post('/api/stats/record')
        .set('Authorization', 'Bearer invalid_token')
        .send({ opponentName: 'Bot', result: 'win', durationSeconds: 100 });
      expect(res.status).toBe(401);
    });
  });
});