//The message.controller.ts file

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';

const DEFAULT_PAGE_SIZE = 30;

export async function sendMessage(req: Request, res: Response) {
  try {
    const senderId = req.user?.userId;

if (!senderId) {
  return res.status(401).json({ message: 'Authentication required' });
}

const { conversationId, content, attachmentUrl, attachmentType } = req.body;

    if (!conversationId || !Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Valid conversationId is required' });
    }

    if ((!content || content.trim().length === 0) && !attachmentUrl) {
      return res.status(400).json({ message: 'Message must have content or an attachment' });
    }

    if (content && content.length > 5000) {
      return res.status(400).json({ message: 'Message too long (max 5000 characters)' });
    }

    // Confirm sender is actually a participant of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: senderId,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      content: content?.trim() || '',
      attachmentUrl: attachmentUrl || undefined,
      attachmentType: attachmentType || null,
      readBy: [senderId],
      deliveredTo: [senderId],
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populatedMessage = await message.populate('sender', 'username displayName avatarUrl');

    return res.status(201).json({ message: populatedMessage });
  } catch (error) {
    console.error('[Message] Send error:', error);
    return res.status(500).json({ message: 'Failed to send message' });
  }
}

export async function getMessages(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;

if (!userId) {
  return res.status(401).json({ message: 'Authentication required' });
}

const rawConversationId = req.params.conversationId;
const conversationId = Array.isArray(rawConversationId)
  ? rawConversationId[0]
  : rawConversationId;

const { before, limit } = req.query;

if (
  typeof conversationId !== 'string' ||
  !Types.ObjectId.isValid(conversationId)
) {
      return res.status(400).json({ message: 'Invalid conversation ID' });
    }

    // Confirm requester is a participant
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const pageSize = Math.min(Number(limit) || DEFAULT_PAGE_SIZE, 100);

    const query: Record<string, unknown> = {
      conversation: conversationId,
      isDeleted: false,
    };

    // Cursor-based pagination: fetch messages older than the given message ID
    if (before && Types.ObjectId.isValid(before as string)) {
      const beforeMessage = await Message.findById(before);
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    const messages = await Message.find(query)
      .populate('sender', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .limit(pageSize);

    // Reverse so the client receives oldest-first for natural rendering
    return res.status(200).json({ messages: messages.reverse() });
  } catch (error) {
    console.error('[Message] GetMessages error:', error);
    return res.status(500).json({ message: 'Failed to fetch messages' });
  }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;

if (!userId) {
  return res.status(401).json({ message: 'Authentication required' });
}

const rawConversationId = req.params.conversationId;
const conversationId = Array.isArray(rawConversationId)
  ? rawConversationId[0]
  : rawConversationId;

if (
  typeof conversationId !== 'string' ||
  !Types.ObjectId.isValid(conversationId)
) {
      return res.status(400).json({ message: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    await Message.updateMany(
      {
        conversation: conversationId,
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      }
    );

    return res.status(200).json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('[Message] MarkAsRead error:', error);
    return res.status(500).json({ message: 'Failed to mark messages as read' });
  }
}

export async function deleteMessage(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;

if (!userId) {
  return res.status(401).json({ message: 'Authentication required' });
}

const rawMessageId = req.params.messageId;
const messageId = Array.isArray(rawMessageId)
  ? rawMessageId[0]
  : rawMessageId;

if (
  typeof messageId !== 'string' ||
  !Types.ObjectId.isValid(messageId)
) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (message.sender.toString() !== userId) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    message.isDeleted = true;
    message.content = '';
    message.attachmentUrl = undefined;
    await message.save();

    return res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error('[Message] Delete error:', error);
    return res.status(500).json({ message: 'Failed to delete message' });
  }
}
export const uploadAttachment = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Construct the relative path to access the file via static middleware
    const relativePath = `/uploads/${req.file.filename}`;
    const isImage = req.file.mimetype.startsWith('image/');

    // Return all keys (url, mediaUrl, filePath) to ensure frontend compatibility
    return res.status(200).json({
      url: relativePath,
      mediaUrl: relativePath,
      filePath: relativePath,
      type: isImage ? 'image' : 'file',
      filename: req.file.filename,
    });
  } catch (error: any) {
    console.error('[Upload Controller Error]:', error);
    return res.status(500).json({ message: 'Failed to process uploaded file.' });
  }
};



