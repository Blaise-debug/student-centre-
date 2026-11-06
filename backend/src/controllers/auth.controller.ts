
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
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

const SALT_ROUNDS = 12;

export async function register(req: Request, res: Response) {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password || !displayName) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({
        message: 'Username must be 3-30 characters, letters/numbers/underscores only',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters with a letter and a number',
      });
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
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
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
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || '').trim();

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
      return res.status(200).json({
        message: 'Email is already verified',
      });
    }

    const isVerified = await verifyEmailAndActivateAccount(
  user._id.toString(),
  code
);

if (!isVerified) {
  // Another request may have verified this account concurrently.
  const latestUser = await User.findById(user._id).select('isVerified');

  if (latestUser?.isVerified) {
    return res.status(200).json({
      message: 'Email is already verified',
    });
  }

  return res.status(400).json({
    message: 'Invalid or expired verification code',
  });
}

    return res.status(200).json({
      message: 'Email verified successfully. You can now log in.',
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
    const email = String(req.body.email || '').trim().toLowerCase();

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
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({
        message: 'Email/username and password are required',
      });
    }

    const identifier = String(emailOrUsername).trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select('+passwordHash');

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
      });
    }

    user.status = 'online';
    user.lastSeen = new Date();
    await user.save();

    const token = signToken({ userId: user._id.toString() });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({ message: 'Login failed' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const user = await User.findById(req.user?.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('[Auth] GetMe error:', error);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
}
