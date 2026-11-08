import { Document, model, Schema, Types } from 'mongoose';

export interface IAcademicProfile extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  country: string;
  institution: string;
  levelOfStudy: string;
  yearOfStudy: string;
  program: string;
  mainUnits: string[];
  commonUnits: string[];
  otherUnits: string[];
  activeUnit: string;
  shareCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const unitSchema = {
  type: String,
  trim: true,
  minlength: 1,
  maxlength: 60,
};

const academicProfileSchema = new Schema<IAcademicProfile>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    country: { type: String, required: true, trim: true, maxlength: 80 },
    institution: { type: String, required: true, trim: true, maxlength: 120 },
    levelOfStudy: { type: String, required: true, trim: true, maxlength: 40 },
    yearOfStudy: { type: String, required: true, trim: true, maxlength: 30 },
    program: { type: String, required: true, trim: true, maxlength: 120 },
    mainUnits: { type: [unitSchema], default: [] },
    commonUnits: { type: [unitSchema], default: [] },
    otherUnits: { type: [unitSchema], default: [] },
    activeUnit: { type: String, required: true, trim: true, maxlength: 60 },
    shareCode: {
      type: String,
      required: true,
      uppercase: true,
      match: /^[A-F0-9]{16}$/,
      unique: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const AcademicProfile = model<IAcademicProfile>(
  'AcademicProfile',
  academicProfileSchema
);
