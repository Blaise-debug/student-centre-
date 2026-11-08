import { Document, model, Schema, Types } from 'mongoose';

export interface IPost extends Document {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  courseUnit: string;
  courseUnitKey: string;
  text: string;
  mediaUrl: string;
  mediaPublicId: string;
  mediaResourceType: 'image' | 'video' | '';
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseUnit: { type: String, required: true, trim: true, maxlength: 60 },
    courseUnitKey: { type: String, required: true, trim: true, maxlength: 60 },
    text: { type: String, trim: true, maxlength: 5000, default: '' },
    mediaUrl: { type: String, default: '' },
    mediaPublicId: { type: String, default: '' },
    mediaResourceType: { type: String, enum: ['image', 'video', ''], default: '' },
  },
  { timestamps: true }
);

postSchema.index({ courseUnitKey: 1, createdAt: -1, _id: -1 });

export const Post = model<IPost>('Post', postSchema);
