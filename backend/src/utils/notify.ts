import { Notification, NotificationType } from '../models/Notification';

interface CreateNotificationParams {
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  content: string;
  relatedConversationId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification = await Notification.create({
      recipient: params.recipientId,
      sender: params.senderId,
      type: params.type,
      content: params.content,
      relatedConversation: params.relatedConversationId,
    });

    return notification;
  } catch (error) {
    console.error('[Notify] Failed to create notification:', error);
    return null;
  }
}