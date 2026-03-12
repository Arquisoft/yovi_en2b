// ──────────────────────────────────────────────────────────────────────────────
// __tests__/authMiddleware.test.ts
//
// Unit tests for middleware/auth.ts.
//
// WHY test the middleware separately:
//   Every single game route is behind this middleware.  A bug here silently
//   blocks all authenticated traffic or, worse, lets unauthenticated traffic
//   through.  We test it in isolation using mock Express req/res objects so
//   we never need a running HTTP server.
//
// Scope covered:
//   — No Authorization header            → 401
//   — Header without "Bearer " prefix    → 401
//   — Valid JWT                          → 200 (next() called, req.user set)
//   — Expired JWT                        → 401 "Token expired"
//   — Invalid / tampered JWT             → 401 "Invalid token"
// ──────────────────────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth';
import type { Response, NextFunction } from 'express';
import type { AuthRequest } from '../types/request';

// We test against the same fallback secret the middleware uses when JWT_SECRET
// is not set in the environment.
const SECRET = process.env.JWT_SECRET ?? 'please_dont_tell_anyone';

// ── Helper: build a mock Express res object ───────────────────────────────────
function makeMockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

// ── Helper: build a valid JWT for a given payload ─────────────────────────────
function makeToken(
  payload: object = { id: 1, username: 'alice', role: 'USER' },
  secret = SECRET,
  options: jwt.SignOptions = { expiresIn: '1h' }
) {
  return jwt.sign(payload, secret, options);
}

describe('authMiddleware', () => {

  it('calls next() and attaches req.user when the JWT is valid', () => {
    const req = { headers: { authorization: `Bearer ${makeToken()}` } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 1, username: 'alice', role: 'USER' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no Authorization header at all', () => {
    const req = { headers: {} } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'No authentication token provided' })
    );
  });

  it('returns 401 when the header is present but missing the "Bearer " prefix', () => {
    const req = { headers: { authorization: makeToken() } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 with "Token expired" when the JWT has expired', () => {
    // Sign a token that expired 1 second ago
    const expiredToken = makeToken(
      { id: 2, username: 'bob', role: 'USER' },
      SECRET,
      { expiresIn: -1 }  // already expired
    );
    const req = { headers: { authorization: `Bearer ${expiredToken}` } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Token expired' })
    );
  });

  it('returns 401 with "Invalid token" when the JWT is signed with the wrong secret', () => {
    const tamperedToken = makeToken({}, 'wrong_secret');
    const req = { headers: { authorization: `Bearer ${tamperedToken}` } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid token' })
    );
  });

  it('returns 401 when the token is a completely malformed string', () => {
    const req = { headers: { authorization: 'Bearer not.a.jwt.at.all' } } as AuthRequest;
    const res = makeMockRes();
    const next: NextFunction = jest.fn();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
