import { Request, Response } from 'express';
import { User } from '../models/User';

export async function getUserProfile(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('[User] GetProfile error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
}

export async function updateOwnProfile(req: Request, res: Response) {
  try {
    const userId = req.user?.userId;
    const { displayName, bio, avatarUrl } = req.body;

    const updates: Partial<{ displayName: string; bio: string; avatarUrl: string }> = {};

    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.trim().length === 0) {
        return res.status(400).json({ message: 'Display name cannot be empty' });
      }
      if (displayName.length > 50) {
        return res.status(400).json({ message: 'Display name too long (max 50 chars)' });
      }
      updates.displayName = displayName.trim();
    }

    if (bio !== undefined) {
      if (typeof bio !== 'string' || bio.length > 160) {
        return res.status(400).json({ message: 'Bio must be 160 characters or fewer' });
      }
      updates.bio = bio;
    }

    if (avatarUrl !== undefined) {
      if (typeof avatarUrl !== 'string') {
        return res.status(400).json({ message: 'Invalid avatar URL' });
      }
      updates.avatarUrl = avatarUrl;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('[User] UpdateProfile error:', error);
    return res.status(500).json({ message: 'Failed to update profile' });
  }
}

export async function searchUsers(req: Request, res: Response) {
  try {
    const { q } = req.query;
    const currentUserId = req.user?.userId;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchRegex = new RegExp(q.trim(), 'i');

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [{ username: searchRegex }, { displayName: searchRegex }],
    })
      .select('username displayName avatarUrl status')
      .limit(20);

    return res.status(200).json({ users });
  } catch (error) {
    console.error('[User] SearchUsers error:', error);
    return res.status(500).json({ message: 'Search failed' });
  }
}