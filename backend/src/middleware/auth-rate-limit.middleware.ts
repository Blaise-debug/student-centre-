import { rateLimit } from 'express-rate-limit';

const windowMs = 15 * 60 * 1000;

function createAuthRateLimit(limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please wait and try again.' },
  });
}

export const registerRateLimit = createAuthRateLimit(10);
export const loginRateLimit = createAuthRateLimit(10);
export const verificationRateLimit = createAuthRateLimit(8);
export const resendVerificationRateLimit = createAuthRateLimit(4);
export const passwordResetRequestRateLimit = createAuthRateLimit(5);
export const passwordResetCompleteRateLimit = createAuthRateLimit(8);
