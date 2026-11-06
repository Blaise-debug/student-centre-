import { Schema, model, Document, Types } from 'mongoose';

export type NotificationType =
  | 'message'
  | 'mention'
  | 'friend_request'
  | 'system';

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  sender?: Types.ObjectId;
  type: NotificationType;
  content: string;
  relatedConversation?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: ['message', 'mention', 'friend_request', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 200,
    },
    relatedConversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = model<INotification>('Notification', notificationSchema);