//The conversation.controller.ts file

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Conversation } from '../models/Conversation';
import { User } from '../models/User';


export async function createConversation(req: Request, res: Response) {
  try {
    const currentUserId = req.user?.userId;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { participantId, isGroup, groupName, participantIds } = req.body;

    if (isGroup) {
      if (!Array.isArray(participantIds) || participantIds.length < 2) {
        return res.status(400).json({
          message: 'Group conversations require at least 2 other participants',
        });
      }

      if (
        !groupName ||
        typeof groupName !== 'string' ||
        groupName.trim().length === 0
      ) {
        return res.status(400).json({ message: 'Group name is required' });
      }

      const uniqueIds = [...new Set(participantIds)];

      if (
        uniqueIds.some(
          (id) => typeof id !== 'string' || !Types.ObjectId.isValid(id)
        )
      ) {
        return res.status(400).json({ message: 'Invalid participant ID' });
      }

      if (uniqueIds.includes(currentUserId)) {
        return res.status(400).json({
          message: 'Do not include yourself in participantIds',
        });
      }

      const allParticipants = [currentUserId, ...uniqueIds];

      const users = await User.find({
        _id: { $in: uniqueIds },
      }).select('_id');

      if (users.length !== uniqueIds.length) {
        return res.status(404).json({
          message: 'One or more participants were not found',
        });
      }

      const conversation = await Conversation.create({
        participants: allParticipants,
        isGroup: true,
        groupName: groupName.trim(),
      });

      return res.status(201).json({ conversation });
    }

    if (
      typeof participantId !== 'string' ||
      !Types.ObjectId.isValid(participantId)
    ) {
      return res.status(400).json({
        message: 'Valid participantId is required',
      });
    }

    if (participantId === currentUserId) {
      return res.status(400).json({
        message: 'Cannot create a conversation with yourself',
      });
    }

    const otherUser = await User.findById(participantId);

    if (!otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existing = await Conversation.findOne({
      isGroup: false,
      participants: {
        $all: [currentUserId, participantId],
        $size: 2,
      },
    });

    if (existing) {
      return res.status(200).json({ conversation: existing });
    }

    const conversation = await Conversation.create({
      participants: [currentUserId, participantId],
      isGroup: false,
    });

    return res.status(201).json({ conversation });
  } catch (error) {
    console.error('[Conversation] Create error:', error);
    return res.status(500).json({
      message: 'Failed to create conversation',
    });
  }
}



















export async function getMyConversations(req: Request, res: Response) {
  try {
    const currentUserId = req.user?.userId;

    const conversations = await Conversation.find({
      participants: currentUserId,
    })
      .populate('participants', 'username displayName avatarUrl status lastSeen')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error('[Conversation] GetMyConversations error:', error);
    return res.status(500).json({ message: 'Failed to fetch conversations' });
  }
}

export async function getConversationById(req: Request, res: Response) {
  try {
    const currentUserId = req.user?.userId;

if (!currentUserId) {
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
      participants: currentUserId,
    }).populate('participants', 'username displayName avatarUrl status lastSeen');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    return res.status(200).json({ conversation });
  } catch (error) {
    console.error('[Conversation] GetById error:', error);
    return res.status(500).json({ message: 'Failed to fetch conversation' });
  }
}