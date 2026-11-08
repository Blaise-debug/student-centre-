import bcrypt from 'bcryptjs';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { PasswordReset } from '../models/PasswordReset';
import { PasswordResetReservation } from '../models/PasswordResetReservation';
import { User } from '../models/User';
import { sendPasswordResetEmail } from './email.service';

const TOKEN_EXPIRY_MINUTES = 30;
const RESEND_COOLDOWN_SECONDS = 60;
const RESERVATION_LEASE_MINUTES = 5;
const SALT_ROUNDS = 12;

function hashResetToken(token: string): string {
  return createHmac('sha256', env.JWT_SECRET)
    .update(`students-centre-password-reset:${token}`)
    .digest('hex');
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

export async function createAndSendPasswordResetLink(
  userId: string,
  email: string
): Promise<void> {
  const userObjectId = new Types.ObjectId(userId);
  const now = new Date();
  const reservationId = randomUUID();
  const cooldownUntil = new Date(
    now.getTime() + RESEND_COOLDOWN_SECONDS * 1000
  );
  const leaseExpiresAt = new Date(
    now.getTime() + RESERVATION_LEASE_MINUTES * 60 * 1000
  );

  let reservation;
  try {
    reservation = await PasswordResetReservation.findOneAndUpdate(
      {
        user: userObjectId,
        cooldownUntil: { $lte: now },
        leaseExpiresAt: { $lte: now },
      },
      { $set: { reservationId, cooldownUntil, leaseExpiresAt } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new Error('PASSWORD_RESET_COOLDOWN');
    }
    throw error;
  }

  if (!reservation) {
    throw new Error('PASSWORD_RESET_RESERVATION_FAILED');
  }

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(
    Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000
  );
  const resetUrl = `${env.APP_SCHEME}://reset-password?token=${encodeURIComponent(token)}`;

  try {
    await PasswordReset.findOneAndUpdate(
      { user: userObjectId },
      { $set: { tokenHash, expiresAt } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const ownsReservation = await PasswordResetReservation.exists({
      _id: reservation._id,
      reservationId,
      leaseExpiresAt: { $gt: new Date() },
    });
    if (!ownsReservation) {
      await PasswordReset.deleteOne({ user: userObjectId, tokenHash });
      throw new Error('PASSWORD_RESET_RESERVATION_EXPIRED');
    }

    await sendPasswordResetEmail(email, resetUrl, TOKEN_EXPIRY_MINUTES);
  } catch (error) {
    await PasswordReset.deleteOne({ user: userObjectId, tokenHash });
    throw error;
  } finally {
    await PasswordResetReservation.updateOne(
      { _id: reservation._id, reservationId },
      [{ $set: { leaseExpiresAt: '$cooldownUntil' } }]
    );
  }
}

export async function consumePasswordReset(
  token: string,
  newPassword: string
): Promise<boolean> {
  if (!/^[a-f\d]{64}$/i.test(token)) {
    return false;
  }

  const tokenHash = hashResetToken(token);
  const candidate = await PasswordReset.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  }).select('+tokenHash');

  if (!candidate) {
    return false;
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const session = await mongoose.startSession();
  let passwordChanged = false;

  try {
    await session.withTransaction(async () => {
      passwordChanged = false;
      const activeReset = await PasswordReset.findOne({
        _id: candidate._id,
        user: candidate.user,
        tokenHash,
        expiresAt: { $gt: new Date() },
      })
        .select('+tokenHash')
        .session(session);

      if (!activeReset) {
        return;
      }

      const consumed = await PasswordReset.deleteOne(
        {
          _id: activeReset._id,
          user: activeReset.user,
          tokenHash,
          expiresAt: { $gt: new Date() },
        },
        { session }
      );
      if (consumed.deletedCount !== 1) {
        return;
      }

      const updatedUser = await User.updateOne(
        { _id: activeReset.user, isVerified: true },
        {
          $set: { passwordHash },
          $inc: { authVersion: 1 },
        },
        { session }
      );

      if (updatedUser.matchedCount !== 1) {
        throw new Error('PASSWORD_RESET_ACCOUNT_UPDATE_FAILED');
      }

      passwordChanged = true;
    });

    return passwordChanged;
  } finally {
    await session.endSession();
  }
}
