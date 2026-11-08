import { Document, model, Schema, Types } from 'mongoose';

export interface IPasswordResetReservation extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  reservationId: string;
  cooldownUntil: Date;
  leaseExpiresAt: Date;
  createdAt: Date;
}

const passwordResetReservationSchema =
  new Schema<IPasswordResetReservation>(
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
      },
      reservationId: { type: String, required: true },
      cooldownUntil: { type: Date, required: true },
      leaseExpiresAt: { type: Date, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
  );

passwordResetReservationSchema.index(
  { leaseExpiresAt: 1 },
  { expireAfterSeconds: 0 }
);

export const PasswordResetReservation = model<IPasswordResetReservation>(
  'PasswordResetReservation',
  passwordResetReservationSchema
);
