import { rateLimit } from 'express-rate-limit';

export const postWriteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'You have made too many post changes. Please try again later.' },
});
