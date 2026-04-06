import { Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AuthRequest } from '../types/request';

const JWT_SECRET = process.env.JWT_SECRET || 'please_dont_tell_anyone';

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];

  try {
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
    };

    req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
      });
    }
    if (error instanceof JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid.',
      });
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Like `authMiddleware` but allows unauthenticated (guest) requests.
 * - No token → `req.user` is left undefined (guest).
 * - Valid token → `req.user` is populated as usual.
 * - Invalid / expired token → 401, so forged tokens are still rejected.
 */
export const optionalAuthMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
    };
    req.user = { id: decoded.id, username: decoded.username, role: decoded.role };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.',
      });
    }
    return res.status(401).json({
      error: 'Invalid token',
      message: 'Authentication token is invalid.',
    });
  }
};
