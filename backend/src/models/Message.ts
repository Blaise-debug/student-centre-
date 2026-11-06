import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'file' | null;
  readBy: Types.ObjectId[];
  deliveredTo: Types.ObjectId[];
  isDeleted: boolean;
  replyTo?: Types.ObjectId | null;
  deletedFor: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    attachmentUrl: {
      type: String,
    },
    attachmentType: {
      type: String,
      enum: ['image', 'video', 'file', null],
      default: null,
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    deliveredTo: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

// Speeds up "load messages for this conversation, newest first"
messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = model<IMessage>('Message', messageSchema);
