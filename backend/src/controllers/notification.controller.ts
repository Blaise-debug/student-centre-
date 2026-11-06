import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Notification } from '../models/Notification';

const DEFAULT_PAGE_SIZE = 30;

export async function getMyNotifications(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
  return res.status(401).json({ message: 'Authentication required' });
    }
    
    const { before, limit } = req.query;

    const pageSize = Math.min(Number(limit) || DEFAULT_PAGE_SIZE, 100);

    const query: Record<string, unknown> = { recipient: userId };

    if (before && Types.ObjectId.isValid(before as string)) {
      const beforeNotif = await Notification.findById(before);
      if (beforeNotif) {
        query.createdAt = { $lt: beforeNotif.createdAt };
      }
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'username displayName avatarUrl')
      .sort({ createdAt: -1 })
      .limit(pageSize);

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    return res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('[Notification] GetMyNotifications error:', error);
    return res.status(500).json({ message: 'Failed to fetch notifications' });
  }
}

export async function markNotificationRead(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;

if (!userId) {
  return res.status(401).json({ message: 'Authentication required' });
}

const rawNotificationId = req.params.notificationId;
const notificationId = Array.isArray(rawNotificationId)
  ? rawNotificationId[0]
  : rawNotificationId;

if (
  typeof notificationId !== 'string' ||
  !Types.ObjectId.isValid(notificationId)
) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.status(200).json({ notification });
  } catch (error) {
    console.error('[Notification] MarkRead error:', error);
    return res.status(500).json({ message: 'Failed to mark notification as read' });
  }
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;

    if (!userId) {
  return res.status(401).json({ message: 'Authentication required' });
    }

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[Notification] MarkAllRead error:', error);
    return res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
}