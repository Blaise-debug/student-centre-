import { Server } from 'socket.io';
import { Types } from 'mongoose';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { createNotification } from '../utils/notify';
import { getOnlineSocketIds } from './presence.socket';
import { AuthenticatedSocket } from './socketAuth.middleware';

interface SendMessagePayload {
  conversationId: string;
  content?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'file' | null;
  replyTo?: string | null;
}

interface DeleteMessagesPayload {
  conversationId: string;
  messageIds: string[];
  mode: 'me' | 'everyone';
}

type SocketAck = (response: { success?: true; error?: string }) => void;

export interface MessageSocketDependencies {
  isConversationParticipant: (
    conversationId: string,
    userId: string
  ) => Promise<boolean>;
  markMessagesRead: (conversationId: string, userId: string) => Promise<void>;
}

const defaultDependencies: MessageSocketDependencies = {
  async isConversationParticipant(conversationId, userId) {
    return Boolean(
      await Conversation.exists({
        _id: conversationId,
        participants: userId,
      })
    );
  },
  async markMessagesRead(conversationId, userId) {
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: userId },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function registerMessageHandlers(
  io: Server,
  socket: AuthenticatedSocket,
  dependencies: MessageSocketDependencies = defaultDependencies
) {
  const userId = socket.userId!;

  socket.on('conversation:join', async (conversationId: unknown, ack?: SocketAck) => {
    if (
      typeof conversationId !== 'string' ||
      !Types.ObjectId.isValid(conversationId)
    ) {
      return ack?.({ error: 'Invalid conversation ID' });
    }

    try {
      const isParticipant = await dependencies.isConversationParticipant(
        conversationId,
        userId
      );
      if (!isParticipant) {
        return ack?.({ error: 'Conversation not found' });
      }

      await socket.join(`conversation:${conversationId}`);
      ack?.({ success: true });
    } catch (error) {
      console.error('[Socket] conversation:join error:', error);
      ack?.({ error: 'Failed to join conversation' });
    }
  });

  socket.on('conversation:leave', async (conversationId: unknown, ack?: SocketAck) => {
    if (
      typeof conversationId !== 'string' ||
      !Types.ObjectId.isValid(conversationId)
    ) {
      return ack?.({ error: 'Invalid conversation ID' });
    }

    try {
      // Leaving is safe even if membership has since been revoked; always clear a stale room.
      await socket.leave(`conversation:${conversationId}`);
      const isParticipant = await dependencies.isConversationParticipant(
        conversationId,
        userId
      );
      if (!isParticipant) {
        return ack?.({ error: 'Conversation not found' });
      }
      ack?.({ success: true });
    } catch (error) {
      console.error('[Socket] conversation:leave error:', error);
      ack?.({ error: 'Failed to leave conversation' });
    }
  });

  socket.on('message:send', async (payload: SendMessagePayload, ack) => {
    try {
      const { conversationId, content, attachmentUrl, attachmentType, replyTo } = payload;

      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        return ack?.({ error: 'Invalid conversation ID' });
      }
      if ((!content || content.trim().length === 0) && !attachmentUrl) {
        return ack?.({ error: 'Message must have content or an attachment' });
      }

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: userId,
      });

      if (!conversation) {
        return ack?.({ error: 'Conversation not found' });
      }

      const message = await Message.create({
        conversation: conversationId,
        sender: userId,
        content: content?.trim() || '',
        attachmentUrl: attachmentUrl || undefined,
        attachmentType: attachmentType || null,
        replyTo: replyTo && Types.ObjectId.isValid(replyTo) ? replyTo : null,
        readBy: [userId],
        deliveredTo: [userId],
      });

      conversation.lastMessage = message._id;
      conversation.lastMessageAt = new Date();
      await conversation.save();

      const populatedMessage = await message.populate([
        { path: 'sender', select: 'username displayName avatarUrl' },
        {
          path: 'replyTo',
          select: 'content sender',
          populate: { path: 'sender', select: 'username displayName' },
        },
      ]);

      io.to(`conversation:${conversationId}`).emit('message:new', {
        message: populatedMessage,
      });

      const otherParticipants = conversation.participants.filter(
        (p) => p.toString() !== userId
      );

      for (const participantId of otherParticipants) {
        const socketIds = getOnlineSocketIds(participantId.toString());
        if (socketIds.length === 0) {
          await createNotification({
            recipientId: participantId.toString(),
            senderId: userId,
            type: 'message',
            content: content?.trim().slice(0, 100) || 'Sent an attachment',
            relatedConversationId: conversationId,
          });
        }
      }

      ack?.({ success: true, message: populatedMessage });
    } catch (error) {
      console.error('[Socket] message:send error:', error);
      ack?.({ error: 'Failed to send message' });
    }
  });

  socket.on('message:delete', async (payload: DeleteMessagesPayload, ack) => {
    try {
      if (!isRecord(payload) || typeof payload.conversationId !== 'string') {
        return ack?.({ error: 'Invalid conversation ID' });
      }

      const { conversationId, messageIds, mode } = payload;

      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        return ack?.({ error: 'Invalid conversation ID' });
      }

      const isParticipant = await dependencies.isConversationParticipant(
        conversationId,
        userId
      );
      if (!isParticipant) {
        return ack?.({ error: 'Conversation not found' });
      }

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return ack?.({ error: 'messageIds must be a non-empty array' });
      }
      if (messageIds.some((id) => !Types.ObjectId.isValid(id))) {
        return ack?.({ error: 'One or more message IDs are invalid' });
      }
      if (mode !== 'me' && mode !== 'everyone') {
        return ack?.({ error: "mode must be 'me' or 'everyone'" });
      }

      const messages = await Message.find({
        _id: { $in: messageIds },
        conversation: conversationId,
      });

      if (messages.length !== messageIds.length) {
        return ack?.({ error: 'One or more messages not found' });
      }

      if (mode === 'everyone') {
        const notSender = messages.some((m) => m.sender.toString() !== userId);
        if (notSender) {
          return ack?.({ error: 'Can only delete-for-everyone your own messages' });
        }
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: { isDeleted: true, content: '', attachmentUrl: undefined } }
        );
        // Broadcast — this changes what everyone in the room sees
        io.to(`conversation:${conversationId}`).emit('message:deleted', {
          conversationId,
          messageIds,
          mode,
        });
      } else {
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $addToSet: { deletedFor: userId } }
        );
        // "Delete for me" is local to the deleter — no broadcast
      }

      ack?.({ success: true, messageIds, mode });
    } catch (error) {
      console.error('[Socket] message:delete error:', error);
      ack?.({ error: 'Failed to delete messages' });
    }
  });

  async function handleTyping(
    event: 'typing:start' | 'typing:stop',
    payload: unknown,
    ack?: SocketAck
  ) {
    if (
      !isRecord(payload) ||
      typeof payload.conversationId !== 'string' ||
      !Types.ObjectId.isValid(payload.conversationId)
    ) {
      return ack?.({ error: 'Invalid conversation ID' });
    }

    try {
      const conversationId = payload.conversationId;
      const isParticipant = await dependencies.isConversationParticipant(
        conversationId,
        userId
      );
      if (!isParticipant) {
        return ack?.({ error: 'Conversation not found' });
      }

      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        userId,
        conversationId,
        isTyping: event === 'typing:start',
      });
      ack?.({ success: true });
    } catch (error) {
      console.error(`[Socket] ${event} error:`, error);
      ack?.({ error: 'Failed to update typing status' });
    }
  }

  socket.on('typing:start', (payload: unknown, ack?: SocketAck) => {
    return handleTyping('typing:start', payload, ack);
  });

  socket.on('typing:stop', (payload: unknown, ack?: SocketAck) => {
    return handleTyping('typing:stop', payload, ack);
  });

  socket.on('message:read', async (payload: unknown, ack?: SocketAck) => {
    if (
      !isRecord(payload) ||
      typeof payload.conversationId !== 'string' ||
      !Types.ObjectId.isValid(payload.conversationId)
    ) {
      return ack?.({ error: 'Invalid conversation ID' });
    }

    const conversationId = payload.conversationId;

    try {
      const isParticipant = await dependencies.isConversationParticipant(
        conversationId,
        userId
      );
      if (!isParticipant) {
        return ack?.({ error: 'Conversation not found' });
      }

      await dependencies.markMessagesRead(conversationId, userId);
      io.to(`conversation:${conversationId}`).emit('message:read:update', {
        conversationId,
        readerId: userId,
      });
      ack?.({ success: true });
    } catch (error) {
      console.error('[Socket] message:read error:', error);
      ack?.({ error: 'Failed to mark messages as read' });
    }
  });
}
