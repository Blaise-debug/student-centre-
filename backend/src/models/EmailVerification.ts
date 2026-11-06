import { Schema, model, Document, Types } from 'mongoose';

export interface IEmailVerification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emailVerificationSchema = new Schema<IEmailVerification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    codeHash: {
      type: String,
      required: true,
      select: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSentAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

emailVerificationSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

export const EmailVerification = model<IEmailVerification>(
  'EmailVerification',
  emailVerificationSchema
);
