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

interface TypingPayload {
  conversationId: string;
}

interface DeleteMessagesPayload {
  conversationId: string;
  messageIds: string[];
  mode: 'me' | 'everyone';
}

export function registerMessageHandlers(io: Server, socket: AuthenticatedSocket) {
  const userId = socket.userId!;

  socket.on('conversation:join', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('conversation:leave', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
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
      const { conversationId, messageIds, mode } = payload;

      if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
        return ack?.({ error: 'Invalid conversation ID' });
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

  socket.on('typing:start', (payload: TypingPayload) => {
    socket.to(`conversation:${payload.conversationId}`).emit('typing:update', {
      userId,
      conversationId: payload.conversationId,
      isTyping: true,
    });
  });

  socket.on('typing:stop', (payload: TypingPayload) => {
    socket.to(`conversation:${payload.conversationId}`).emit('typing:update', {
      userId,
      conversationId: payload.conversationId,
      isTyping: false,
    });
  });

  socket.on('message:read', async (payload: { conversationId: string }) => {
    try {
      const { conversationId } = payload;
      if (!Types.ObjectId.isValid(conversationId)) return;

      await Message.updateMany(
        { conversation: conversationId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      io.to(`conversation:${conversationId}`).emit('message:read:update', {
        conversationId,
        readerId: userId,
      });
    } catch (error) {
      console.error('[Socket] message:read error:', error);
    }
  });
}
