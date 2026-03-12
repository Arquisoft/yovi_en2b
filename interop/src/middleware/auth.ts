// ──────────────────────────────────────────────────────────────────────────────
// middleware/auth.ts
//
// JWT verification middleware for the webapp backend.
//
// Tokens are ISSUED by the users service (users/src/services/AuthService.ts)
// and VERIFIED here.  Both must use the same secret — read from JWT_SECRET in
// the environment (ADR-006: HS256 shared secret, injected at runtime via env
// vars per ADR-007).
//
// On success: attaches req.user = { id, username, role } for controllers.
// On failure: responds with the same error shape as the users auth middleware
//             so the frontend only needs to handle one error format.
// ──────────────────────────────────────────────────────────────────────────────

import type { Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import type { AuthRequest } from '../types/request';

// Must match the value used in users/src/services/AuthService.ts
const JWT_SECRET = process.env.JWT_SECRET ?? 'please_dont_tell_anyone';

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No authentication token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
    };

    // Attach the decoded claims so controllers can read req.user.id, etc.
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
    };

    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
      });
      return;
    }
    if (err instanceof JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid.',
      });
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  }
};