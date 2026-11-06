import { Schema, model, Document, Types } from 'mongoose';

export interface IEmailVerificationReservation extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  reservationId: string;
  cooldownUntil: Date;
  leaseExpiresAt: Date;
  createdAt: Date;
}

const emailVerificationReservationSchema =
  new Schema<IEmailVerificationReservation>(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
      },
      reservationId: {
        type: String,
        required: true,
      },
      cooldownUntil: {
        type: Date,
        required: true,
      },
      leaseExpiresAt: {
        type: Date,
        required: true,
      },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
  );

emailVerificationReservationSchema.index(
  { leaseExpiresAt: 1 },
  { expireAfterSeconds: 0 }
);

export const EmailVerificationReservation =
  model<IEmailVerificationReservation>(
    'EmailVerificationReservation',
    emailVerificationReservationSchema
  );