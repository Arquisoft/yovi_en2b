import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/request';
import { AuthService } from '../services/AuthService';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

const userRepository = AppDataSource.getRepository(User);

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];

  try {
    if (!token) {
      return res.status(401).json({
        error: 'No authentication token provided'
      });
    }

    const decoded = AuthService.verifyToken(token);

    const user = await userRepository.findOne({
      where: { id: decoded.id },
      select: ['id', 'username', 'role', 'isActive']
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Invalid authentication token'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account deactivated',
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    next();
  } catch (error: any) {
    if (error instanceof TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please login again.'
      });
    }

    if (error instanceof JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is invalid.'
      });
    }

    res.status(401).json({ error: error.message });
  }
};
