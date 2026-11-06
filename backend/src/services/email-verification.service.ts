import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'crypto';

import { User } from '../models/User';

import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { EmailVerificationReservation } from '../models/EmailVerificationReservation';
import { EmailVerification } from '../models/EmailVerification';
import { sendVerificationEmail } from './email.service';

const CODE_EXPIRY_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHmac('sha256', env.JWT_SECRET)
    .update(`students-centre-email-verification:${code}`)
    .digest('hex');
}

function compareHashes(
  submittedHash: string,
  storedHash: string
): boolean {
  const submitted = Buffer.from(submittedHash, 'hex');
  const stored = Buffer.from(storedHash, 'hex');

  if (submitted.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(submitted, stored);
}

export async function createAndSendVerificationCode(
  userId: string,
  email: string
): Promise<void> {
  const userObjectId = new Types.ObjectId(userId);
  const now = new Date();
  const reservationId = randomUUID();

  const cooldownUntil = new Date(
    now.getTime() + RESEND_COOLDOWN_SECONDS * 1000
  );

  // Allow a sending operation up to five minutes to complete.
  const leaseExpiresAt = new Date(
    now.getTime() + 5 * 60 * 1000
  );

  let reservation;

  try {
    reservation = await EmailVerificationReservation.findOneAndUpdate(
      {
        user: userObjectId,
        cooldownUntil: { $lte: now },
        leaseExpiresAt: { $lte: now },
      },
      {
        $set: {
          reservationId,
          cooldownUntil,
          leaseExpiresAt,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      throw new Error('VERIFICATION_RESEND_COOLDOWN');
    }

    throw error;
  }

  if (!reservation) {
    throw new Error('VERIFICATION_RESERVATION_FAILED');
  }

  const code = randomInt(100000, 1000000).toString();
  const codeHash = hashCode(code);

  try {
    await sendVerificationEmail(
      email,
      code,
      CODE_EXPIRY_MINUTES
    );

    // Ensure this operation still owns the reservation.
    const ownsReservation =
      await EmailVerificationReservation.exists({
        _id: reservation._id,
        reservationId,
        leaseExpiresAt: { $gt: new Date() },
      });

    if (!ownsReservation) {
      throw new Error('VERIFICATION_RESERVATION_EXPIRED');
    }

    await EmailVerification.findOneAndUpdate(
      { user: userObjectId },
      {
        $set: {
          codeHash,
          expiresAt: new Date(
            Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000
          ),
          attempts: 0,
          lastSentAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );
  } finally {
    // Release the sending lease while preserving the cooldown.
    await EmailVerificationReservation.updateOne(
      {
        _id: reservation._id,
        reservationId,
      },
      [
        {
          $set: {
            leaseExpiresAt: '$cooldownUntil',
          },
        },
      ]
    );
  }
}








export async function verifyEmailAndActivateAccount(
  userId: string,
  submittedCode: string
): Promise<boolean> {
  if (!/^\d{6}$/.test(submittedCode)) {
    return false;
  }

  const userObjectId = new Types.ObjectId(userId);
  const submittedHash = hashCode(submittedCode);
  const now = new Date();

  // Find the current, unexpired verification record.
  const verification = await EmailVerification.findOne({
    user: userObjectId,
    expiresAt: { $gt: now },
    attempts: { $lt: MAX_ATTEMPTS },
  }).select('+codeHash');

  if (!verification) {
    return false;
  }

  // Count invalid attempts atomically.
  if (!compareHashes(submittedHash, verification.codeHash)) {
    await EmailVerification.updateOne(
      {
        _id: verification._id,
        codeHash: verification.codeHash,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: MAX_ATTEMPTS },
      },
      {
        $inc: { attempts: 1 },
      }
    );

    return false;
  }

  const session = await mongoose.startSession();
  let isVerified = false;

  try {
    await session.withTransaction(async () => {
      // Transaction callbacks may be retried.
      isVerified = false;

      // Re-read the record within the transaction.
      const activeVerification = await EmailVerification.findOne({
        _id: verification._id,
        user: userObjectId,
        expiresAt: { $gt: new Date() },
        attempts: { $lt: MAX_ATTEMPTS },
      })
        .select('+codeHash')
        .session(session);

      if (!activeVerification) {
        return;
      }

      if (
        !compareHashes(
          submittedHash,
          activeVerification.codeHash
        )
      ) {
        return;
      }

      // Consume this exact active code first.
      const codeDeletion = await EmailVerification.deleteOne(
        {
          _id: activeVerification._id,
          user: userObjectId,
          codeHash: activeVerification.codeHash,
          expiresAt: { $gt: new Date() },
          attempts: { $lt: MAX_ATTEMPTS },
        },
        { session }
      );

      if (codeDeletion.deletedCount !== 1) {
        return;
      }

      // Activate the account in the same transaction.
      const userUpdate = await User.updateOne(
        {
          _id: userObjectId,
          isVerified: false,
        },
        {
          $set: { isVerified: true },
        },
        { session }
      );

      if (userUpdate.matchedCount !== 1) {
        throw new Error('VERIFICATION_ACCOUNT_UPDATE_FAILED');
      }

      isVerified = true;
    });

    return isVerified;
  } finally {
    await session.endSession();
  }
}

export async function deleteVerificationCode(
  userId: string
): Promise<void> {
  await EmailVerification.deleteOne({
    user: new Types.ObjectId(userId),
  });
}
