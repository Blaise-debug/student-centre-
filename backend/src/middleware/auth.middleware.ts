
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required',
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      message: 'Authentication required',
    });
  }

  try {
    const payload = verifyToken(token);

    if (!payload.userId) {
      return res.status(401).json({
        message: 'Invalid or expired token',
      });
    }

    const user = await User.findById(payload.userId)
      .select('isVerified +authVersion')
      .exec();

    if (!user) {
      return res.status(401).json({
        message: 'Invalid authentication account',
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before accessing this resource.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    if ((user.authVersion ?? 0) !== payload.tokenVersion) {
      return res.status(401).json({
        message: 'Session expired. Please sign in again.',
      });
    }

    req.user = { userId: payload.userId };

    return next();
  } catch (error) {
    // Invalid JWTs and database failures must be handled separately.
    if (
      error instanceof Error &&
      (error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError' ||
        error.name === 'NotBeforeError')
    ) {
      return res.status(401).json({
        message: 'Invalid or expired token',
      });
    }

    console.error('[Auth] Authentication middleware error:', error);

    return res.status(500).json({
      message: 'Authentication service temporarily unavailable',
    });
  }
}
