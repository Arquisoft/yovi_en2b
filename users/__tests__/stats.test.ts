// users/tests/stats.test.ts
import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('Stats API', () => {
  const testUser = {
    username: 'statsplayer',
    email: 'stats@example.com',
    password: 'password123'
  };

  let authToken: string;

beforeEach(async () => {
  await request(app).post('/api/auth/register').send(testUser).catch(() => {})
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: testUser.email, password: testUser.password });
  authToken = loginRes.body.token;
});

  describe('GET /api/stats/history', () => {
    it('should return match history for authenticated user', async () => {
      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return entries with required fields', async () => {
      const res = await request(app)
        .get('/api/stats/history')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');

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
        .set('Authorization', 'Bearer invalid_token')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/stats/winrate', () => {
    it('should return winrate data for authenticated user', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('overall');
      expect(res.body).toHaveProperty('recent');
    });

    it('should return overall with wins and losses', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(typeof res.body.overall.wins).toBe('number');
      expect(typeof res.body.overall.losses).toBe('number');
    });

    it('should return recent with wins and losses', async () => {
      const res = await request(app)
        .get('/api/stats/winrate')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(typeof res.body.recent.wins).toBe('number');
      expect(typeof res.body.recent.losses).toBe('number');
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
        .set('Authorization', 'Bearer invalid_token')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });
  });
});
