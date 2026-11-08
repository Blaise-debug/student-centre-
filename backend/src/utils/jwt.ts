import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  tokenVersion: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: 'HS256',
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  const verified = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
  });

  if (
    typeof verified !== 'object' ||
    typeof verified.userId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(verified.userId)
  ) {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }

  // Older sessions did not include a token version; they map to version zero.
  const tokenVersion = verified.tokenVersion ?? 0;
  if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
    throw new jwt.JsonWebTokenError('Invalid token version');
  }

  return { userId: verified.userId, tokenVersion };
}
