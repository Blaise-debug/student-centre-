import { Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';

export interface AuthenticatedSocket extends Socket {
  userId?: string;
}

export async function socketAuthMiddleware(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): Promise<void> {
  const token = socket.handshake.auth?.token;

  if (typeof token !== 'string' || !token.trim()) {
    return next(new Error('Authentication required'));
  }

  try {
    const payload = verifyToken(token);

    if (!payload.userId) {
      return next(new Error('Invalid or expired token'));
    }

    const user = await User.findById(payload.userId)
      .select('isVerified')
      .exec();

    if (!user) {
      return next(new Error('Invalid authentication account'));
    }

    if (!user.isVerified) {
      return next(new Error('EMAIL_NOT_VERIFIED'));
    }

    socket.userId = payload.userId;

    return next();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError' ||
        error.name === 'NotBeforeError')
    ) {
      return next(new Error('Invalid or expired token'));
    }

    console.error('[Socket Auth] Authentication error:', error);

    return next(new Error('Authentication service temporarily unavailable'));
  }
}
