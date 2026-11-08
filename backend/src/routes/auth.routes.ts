import { Router } from 'express';
import {
  getMe,
  login,
  register,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import {
  loginRateLimit,
  passwordResetCompleteRateLimit,
  passwordResetRequestRateLimit,
  registerRateLimit,
  resendVerificationRateLimit,
  verificationRateLimit,
} from '../middleware/auth-rate-limit.middleware';

const router = Router();

router.post('/register', registerRateLimit, register);
router.post('/login', loginRateLimit, login);
router.post('/verify-email', verificationRateLimit, verifyEmail);
router.post('/resend-verification', resendVerificationRateLimit, resendVerification);
router.post('/password-reset/request', passwordResetRequestRateLimit, requestPasswordReset);
router.post('/password-reset/complete', passwordResetCompleteRateLimit, resetPassword);
router.get('/me', requireAuth, getMe);

export default router;
