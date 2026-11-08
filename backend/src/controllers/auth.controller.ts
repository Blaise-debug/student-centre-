
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { IUser, User } from '../models/User';
import { signToken } from '../utils/jwt';
import {
  isValidEmail,
  isValidUsername,
  isValidPassword,
} from '../utils/validators';
import {
  createAndSendVerificationCode,
  verifyEmailAndActivateAccount,
} from '../services/email-verification.service';
import { createAndSendPasswordResetLink, consumePasswordReset } from '../services/password-reset.service';

const SALT_ROUNDS = 12;

function toSafeUser(user: IUser) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    status: user.status,
    lastSeen: user.lastSeen,
    isVerified: user.isVerified,
    onboardingComplete: Boolean(user.onboardingComplete),
  };
}

export async function register(req: Request, res: Response) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { username, email, password, displayName } = body;

    if (
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof displayName !== 'string' ||
      !username.trim() ||
      !email.trim() ||
      !password ||
      !displayName.trim()
    ) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!isValidUsername(username.trim())) {
      return res.status(400).json({
        message: 'Username must be 3-30 characters, letters/numbers/underscores only',
      });
    }

    if (!isValidEmail(email.trim())) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters, include a letter and a number, and be no more than 72 bytes',
      });
    }

    if (displayName.trim().length > 50) {
      return res.status(400).json({ message: 'Display name must be 50 characters or fewer' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { username: normalizedUsername },
      ],
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Username or email already in use',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      displayName: displayName.trim(),
    });

    try {
      await createAndSendVerificationCode(
        user._id.toString(),
        user.email
      );
    } catch (emailError) {
      console.error('[Auth] Verification email error:', emailError);

      return res.status(503).json({
        message: 'Account created, but verification email could not be sent. Please request a new code.',
        code: 'VERIFICATION_EMAIL_FAILED',
      });
    }

    return res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error('[Auth] Register error:', error);

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      return res.status(409).json({
        message: 'Username or email already in use',
      });
    }

    return res.status(500).json({ message: 'Registration failed' });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';

    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({
        message: 'A valid email address and six-digit code are required',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification code',
      });
    }

    if (user.isVerified) {
      return res.status(409).json({
        message: 'Email is already verified',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }

    const isVerified = await verifyEmailAndActivateAccount(
      user._id.toString(),
      code
    );

    if (!isVerified) {
      // Another request may have verified the address; never issue a token without the code.
      const latestUser = await User.findById(user._id).select('isVerified');

      if (latestUser?.isVerified) {
        return res.status(409).json({
          message: 'Email is already verified. Please sign in.',
          code: 'EMAIL_ALREADY_VERIFIED',
        });
      }

      return res.status(400).json({
        message: 'Invalid or expired verification code',
      });
    }

    const verifiedUser = await User.findById(user._id).select('+authVersion');
    if (!verifiedUser) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const token = signToken({
      userId: verifiedUser._id.toString(),
      tokenVersion: verifiedUser.authVersion ?? 0,
    });

    return res.status(200).json({
      message: 'Email verified successfully.',
      token,
      user: toSafeUser(verifiedUser),
    });
  } catch (error) {
    console.error('[Auth] Verify email error:', error);
    return res.status(500).json({
      message: 'Email verification failed',
    });
  }
}

export async function resendVerification(req: Request, res: Response) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'A valid email address is required',
      });
    }

    const user = await User.findOne({ email });

    // Use the same response for unknown and already verified accounts.
    if (!user || user.isVerified) {
      return res.status(200).json({
        message: 'If the account requires verification, a new code will be sent.',
      });
    }

    await createAndSendVerificationCode(
      user._id.toString(),
      user.email
    );

    return res.status(200).json({
      message: 'A new verification code has been sent.',
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'VERIFICATION_RESEND_COOLDOWN'
    ) {
      return res.status(429).json({
        message: 'Please wait before requesting another verification code.',
      });
    }

    console.error('[Auth] Resend verification error:', error);

    return res.status(503).json({
      message: 'Unable to send a verification code at this time.',
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { emailOrUsername, password } = body;

    if (typeof emailOrUsername !== 'string' || typeof password !== 'string' || !password) {
      return res.status(400).json({
        message: 'Email/username and password are required',
      });
    }

    const identifier = String(emailOrUsername).trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select('+passwordHash +authVersion');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    const token = signToken({
      userId: user._id.toString(),
      tokenVersion: user.authVersion ?? 0,
    });

    return res.status(200).json({
      token,
      user: toSafeUser(user),
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = await User.findById(req.user?.userId).select(
      'username email displayName avatarUrl bio status lastSeen isVerified onboardingComplete'
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user: toSafeUser(user) });
  } catch (error) {
    console.error('[Auth] GetMe error:', error);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
}

export async function requestPasswordReset(req: Request, res: Response) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const user = await User.findOne({ email, isVerified: true }).select('_id email');
    if (user) {
      try {
        await createAndSendPasswordResetLink(user._id.toString(), user.email);
      } catch (error) {
        if (!(error instanceof Error && error.message === 'PASSWORD_RESET_COOLDOWN')) {
          console.error('[Auth] Password reset request failed:', error);
        }
      }
    }

    return res.status(200).json({
      message: 'If an eligible account exists for that email, a reset link has been sent.',
    });
  } catch (error) {
    console.error('[Auth] Password reset request error:', error);
    return res.status(503).json({ message: 'Password reset is temporarily unavailable.' });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!token || !isValidPassword(newPassword)) {
      return res.status(400).json({
        message: 'Use a valid reset link and a password with at least 8 characters, a letter, a number, and no more than 72 bytes.',
      });
    }

    const changed = await consumePasswordReset(token, newPassword);
    if (!changed) {
      return res.status(400).json({
        message: 'This reset link is invalid or expired. Request a new one.',
      });
    }

    return res.status(200).json({
      message: 'Password updated. Please sign in with your new password.',
    });
  } catch (error) {
    console.error('[Auth] Password reset completion error:', error);
    return res.status(500).json({ message: 'Unable to reset the password right now.' });
  }
}
